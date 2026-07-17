-- ============================================================================
-- Response-latency telemetry.
--
-- Adds an optional client tap-time column and surfaces, on every get_results
-- payload, the newest response's server time (created_at) and client tap time so
-- the stage can measure the respond→on-screen lapse. created_at (already present,
-- default now()) is the authoritative server clock; no new server-time column is
-- needed. All additions are backward-compatible.
-- ============================================================================

alter table public.responses
  add column if not exists client_ts_ms bigint; -- epoch ms from the phone (best-effort)

-- ---- submit_response: accept + store the client tap time -------------------
-- Drop the old 5-arg signature first so the new 6-arg version doesn't create an
-- ambiguous overload for PostgREST's named-argument resolution.
drop function if exists public.submit_response(uuid, uuid, uuid, text, jsonb);

create or replace function public.submit_response(
  p_session_id uuid, p_slide_id uuid, p_participant_id uuid, p_device_key text, p_payload jsonb,
  p_client_ts bigint default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_session public.sessions; v_slide jsonb; v_participant public.participants;
  v_is_quiz boolean; v_correct boolean := null; v_points int := 0; v_ms int := null;
  v_time_limit_ms int; v_base_points int; v_correct_idx jsonb; v_inserted boolean;
begin
  select * into v_session from public.sessions where id = p_session_id and status = 'live';
  if v_session.id is null then return jsonb_build_object('ok', false, 'error', 'session_not_live'); end if;
  if v_session.phase <> 'open' then return jsonb_build_object('ok', false, 'error', 'voting_closed'); end if;

  select * into v_participant from public.participants
    where id = p_participant_id and session_id = p_session_id and device_key = p_device_key;
  if v_participant.id is null then return jsonb_build_object('ok', false, 'error', 'bad_participant'); end if;

  v_slide := v_session.deck_snapshot->'slides'->v_session.current_slide_index;
  if coalesce(v_slide->>'id','') <> p_slide_id::text then
    return jsonb_build_object('ok', false, 'error', 'stale_slide');
  end if;

  -- Safety: sanitize free text (profanity filter is default-on, council P0 #9).
  if jsonb_typeof(p_payload->'words') = 'array' then
    p_payload := jsonb_set(p_payload, '{words}', public.clean_words(p_session_id, p_payload->'words'));
    if jsonb_array_length(p_payload->'words') = 0 then
      return jsonb_build_object('ok', false, 'error', 'filtered');
    end if;
  end if;
  if p_payload ? 'text' then
    if char_length(coalesce(p_payload->>'text','')) > 250 then
      p_payload := jsonb_set(p_payload, '{text}', to_jsonb(left(p_payload->>'text', 250)));
    end if;
    if not public.is_text_clean(p_session_id, coalesce(p_payload->>'text','')) then
      return jsonb_build_object('ok', false, 'error', 'filtered');
    end if;
  end if;

  v_is_quiz := (v_slide->>'kind') = 'quiz';
  if v_is_quiz then
    v_ms := least(greatest(0, (extract(epoch from (now() - v_session.phase_opened_at)) * 1000)::int), 600000);
    v_time_limit_ms := coalesce((v_slide->'settings'->>'timeLimitSec')::int, 30) * 1000;
    v_base_points := coalesce((v_slide->'settings'->>'points')::int, 1000);
    if v_ms > v_time_limit_ms + 1500 then
      return jsonb_build_object('ok', false, 'error', 'too_late');
    end if;
    v_correct_idx := v_slide->'body'->'correct';
    v_correct := (v_correct_idx @> (p_payload->'choice')) or
                 (jsonb_typeof(p_payload->'choice') = 'number' and v_correct_idx @> jsonb_build_array(p_payload->'choice'));
    if v_correct then
      v_points := v_base_points;
      if coalesce((v_slide->'settings'->>'speedBonus')::boolean, false) then
        v_points := v_base_points +
          least((v_base_points * 0.2 * (1.0 - v_ms::float / v_time_limit_ms))::int, v_base_points / 5);
      end if;
    end if;
  end if;

  insert into public.responses (session_id, slide_id, participant_id, payload, answered_ms, is_correct, points, client_ts_ms)
    values (p_session_id, p_slide_id, p_participant_id, p_payload, v_ms, v_correct, v_points, p_client_ts)
    on conflict (slide_id, participant_id) do update
      set payload = case when public.responses.is_correct is null then excluded.payload else public.responses.payload end,
          client_ts_ms = excluded.client_ts_ms
    returning points, is_correct, (xmax = 0) into v_points, v_correct, v_inserted;

  if v_is_quiz and v_inserted then
    update public.participants set
      score = score + v_points,
      streak = case when v_correct then streak + 1 else 0 end
      where id = p_participant_id;
  end if;

  return jsonb_build_object('ok', true, 'isCorrect', v_correct, 'points', v_points);
end $$;

-- ---- get_results: attach latency meta to every payload ---------------------
create or replace function public.get_results(p_session_id uuid, p_slide_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_kind text; v_session public.sessions; v_slide jsonb; v_out jsonb;
  v_last_at timestamptz; v_last_client bigint;
begin
  select * into v_session from public.sessions where id = p_session_id;
  v_slide := (
    select sl from jsonb_array_elements(v_session.deck_snapshot->'slides') sl
    where sl->>'id' = p_slide_id::text limit 1);
  v_kind := v_slide->>'kind';

  if v_kind in ('poll','quiz','ranking') then
    select jsonb_build_object('kind', v_kind, 'total', count(*),
      'counts', coalesce(jsonb_object_agg(k, c) filter (where k is not null), '{}'::jsonb))
    into v_out from (
      select coalesce(r.payload->>'choice', ch.value::text) as k, count(*) as c
      from public.responses r
      left join lateral jsonb_array_elements_text(case when jsonb_typeof(r.payload->'choices')='array'
        then r.payload->'choices' else '[]'::jsonb end) ch on true
      where r.session_id = p_session_id and r.slide_id = p_slide_id
      group by 1) t;
  elsif v_kind = 'wordcloud' then
    v_out := jsonb_build_object(
      'kind', v_kind,
      'total', (select count(*) from public.responses
                where session_id = p_session_id and slide_id = p_slide_id),
      'words', coalesce((
        select jsonb_object_agg(w, c) from (
          select lower(trim(w.value)) as w, count(*) as c
          from public.responses r,
            lateral jsonb_array_elements_text(r.payload->'words') w
          where r.session_id = p_session_id and r.slide_id = p_slide_id and trim(w.value) <> ''
          group by 1 order by c desc limit 60) t
      ), '{}'::jsonb));
  elsif v_kind = 'scale' then
    v_out := jsonb_build_object(
      'kind', v_kind,
      'total', (select count(*) from public.responses
                where session_id = p_session_id and slide_id = p_slide_id),
      'avg', (select round(avg((payload->>'value')::numeric), 2) from public.responses
              where session_id = p_session_id and slide_id = p_slide_id),
      'counts', coalesce((
        select jsonb_object_agg(v, c) from (
          select payload->>'value' as v, count(*) as c
          from public.responses
          where session_id = p_session_id and slide_id = p_slide_id
          group by 1) t
      ), '{}'::jsonb));
  else -- open_text
    select jsonb_build_object('kind', 'open_text', 'total', count(*),
      'entries', coalesce(jsonb_agg(jsonb_build_object('text', payload->>'text') order by created_at desc), '[]'::jsonb))
    into v_out from (
      select payload, created_at from public.responses
      where session_id = p_session_id and slide_id = p_slide_id
      order by created_at desc limit 100) t;
  end if;

  v_out := coalesce(v_out, jsonb_build_object('kind', v_kind, 'total', 0));

  -- Latency meta: newest response's server time + client tap time (if any).
  select max(created_at),
         (array_agg(client_ts_ms order by created_at desc) filter (where client_ts_ms is not null))[1]
    into v_last_at, v_last_client
    from public.responses
    where session_id = p_session_id and slide_id = p_slide_id;

  if v_last_at is not null then
    v_out := v_out || jsonb_strip_nulls(jsonb_build_object(
      'lastResponseAt', to_char(v_last_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'lastClientTs', v_last_client));
  end if;

  return v_out;
end $$;
