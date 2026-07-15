-- PulseDeck RPCs — the ONLY write/read surface for anonymous audience clients.
-- All functions are SECURITY DEFINER and validate session state server-side.

-- Helper: current open-phase guard
create or replace function public._session_open_slide(p_session_id uuid)
returns table (slide jsonb, phase text, phase_opened_at timestamptz) language sql stable as $$
  select s.deck_snapshot->'slides'->s.current_slide_index, s.phase, s.phase_opened_at
  from public.sessions s where s.id = p_session_id and s.status = 'live';
$$;

-- ============ join_session ============
create or replace function public.join_session(p_code text, p_nickname text, p_device_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_session public.sessions; v_participant public.participants;
begin
  select * into v_session from public.sessions
    where upper(code) = upper(p_code) and status <> 'ended'
    order by created_at desc limit 1;
  if v_session.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  -- Room lock: existing participants may rejoin (device_key match); new ones are refused.
  if coalesce((v_session.settings->>'locked')::boolean, false)
     and not exists (select 1 from public.participants
       where session_id = v_session.id and device_key = p_device_key) then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;
  insert into public.participants (session_id, nickname, device_key)
    values (v_session.id, left(coalesce(nullif(trim(p_nickname),''),'Guest'), 40), p_device_key)
    on conflict (session_id, device_key)
    do update set nickname = excluded.nickname
    returning * into v_participant;
  return jsonb_build_object(
    'ok', true,
    'session', jsonb_build_object(
      'id', v_session.id, 'code', v_session.code, 'status', v_session.status,
      'currentSlideIndex', v_session.current_slide_index, 'phase', v_session.phase,
      'settings', v_session.settings, 'deck', v_session.deck_snapshot),
    'participant', jsonb_build_object(
      'id', v_participant.id, 'nickname', v_participant.nickname, 'score', v_participant.score)
  );
end $$;

-- ============ get_session_state (reconnect/fallback poll) ============
create or replace function public.get_session_state(p_session_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'status', s.status, 'currentSlideIndex', s.current_slide_index,
    'phase', s.phase, 'phaseOpenedAt', s.phase_opened_at, 'settings', s.settings)
  from public.sessions s where s.id = p_session_id;
$$;

-- ============ submit_response (idempotent upsert; server-authoritative scoring) ============
create or replace function public.submit_response(
  p_session_id uuid, p_slide_id uuid, p_participant_id uuid, p_device_key text, p_payload jsonb)
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
  -- clean_words/is_text_clean are defined in migration 003 (late-bound at call time).
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
    v_correct_idx := v_slide->'body'->'correct';   -- array of correct option indexes
    v_correct := (v_correct_idx @> (p_payload->'choice')) or
                 (jsonb_typeof(p_payload->'choice') = 'number' and v_correct_idx @> jsonb_build_array(p_payload->'choice'));
    if v_correct then
      -- COUNCIL RULING: accuracy-based scoring by default (network jitter must not
      -- decide points). Optional speed bonus capped at 20% of base when enabled.
      v_points := v_base_points;
      if coalesce((v_slide->'settings'->>'speedBonus')::boolean, false) then
        v_points := v_base_points +
          least((v_base_points * 0.2 * (1.0 - v_ms::float / v_time_limit_ms))::int, v_base_points / 5);
      end if;
    end if;
  end if;

  insert into public.responses (session_id, slide_id, participant_id, payload, answered_ms, is_correct, points)
    values (p_session_id, p_slide_id, p_participant_id, p_payload, v_ms, v_correct, v_points)
    on conflict (slide_id, participant_id) do update
      set payload = case when public.responses.is_correct is null then excluded.payload else public.responses.payload end
    returning points, is_correct, (xmax = 0) into v_points, v_correct, v_inserted;

  -- Score exactly once: only on the genuinely-new row (xmax=0 ⇔ fresh insert).
  if v_is_quiz and v_inserted then
    update public.participants set
      score = score + v_points,
      streak = case when v_correct then streak + 1 else 0 end
      where id = p_participant_id;
  end if;

  return jsonb_build_object('ok', true, 'isCorrect', v_correct, 'points', v_points);
end $$;

-- ============ get_results (aggregates; called by stage view poller) ============
create or replace function public.get_results(p_session_id uuid, p_slide_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_kind text; v_session public.sessions; v_slide jsonb; v_out jsonb;
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

  return coalesce(v_out, jsonb_build_object('kind', v_kind, 'total', 0));
end $$;

-- ============ leaderboard ============
create or replace function public.get_leaderboard(p_session_id uuid, p_limit int default 10)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'nickname', nickname, 'score', score, 'streak', streak) order by score desc), '[]'::jsonb)
  from (select nickname, score, streak from public.participants
        where session_id = p_session_id order by score desc, joined_at asc limit p_limit) t;
$$;

create or replace function public.get_my_rank(p_session_id uuid, p_participant_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('rank', r.rank, 'score', r.score) from (
    select id, score, rank() over (order by score desc) as rank
    from public.participants where session_id = p_session_id) r
  where r.id = p_participant_id;
$$;

-- ============ Q&A ============
create or replace function public.submit_question(
  p_session_id uuid, p_participant_id uuid, p_device_key text, p_text text, p_anonymous boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_participant public.participants; v_session public.sessions; v_q public.qa_questions;
declare v_status text := 'visible';
begin
  select * into v_session from public.sessions where id = p_session_id and status = 'live';
  if v_session.id is null then return jsonb_build_object('ok', false, 'error', 'session_not_live'); end if;
  select * into v_participant from public.participants
    where id = p_participant_id and session_id = p_session_id and device_key = p_device_key;
  if v_participant.id is null then return jsonb_build_object('ok', false, 'error', 'bad_participant'); end if;
  if (select count(*) from public.qa_questions
      where participant_id = p_participant_id and created_at > now() - interval '30 seconds') >= 3 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  if coalesce((v_session.settings->>'qaModerated')::boolean, false) then v_status := 'pending'; end if;
  if not public.is_text_clean(p_session_id, p_text) then
    return jsonb_build_object('ok', false, 'error', 'filtered');
  end if;
  insert into public.qa_questions (session_id, participant_id, author_nickname, text, status)
    values (p_session_id, p_participant_id,
      case when p_anonymous then 'Anonymous' else coalesce(nullif(v_participant.nickname,''),'Anonymous') end,
      left(trim(p_text), 500), v_status)
    returning * into v_q;
  return jsonb_build_object('ok', true, 'id', v_q.id, 'status', v_q.status);
end $$;

create or replace function public.toggle_upvote(
  p_question_id uuid, p_participant_id uuid, p_device_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_exists boolean; v_count int; v_session_id uuid;
begin
  select session_id into v_session_id from public.qa_questions where id = p_question_id;
  if not exists (select 1 from public.participants
      where id = p_participant_id and session_id = v_session_id and device_key = p_device_key) then
    return jsonb_build_object('ok', false, 'error', 'bad_participant');
  end if;
  select exists(select 1 from public.qa_upvotes
    where question_id = p_question_id and participant_id = p_participant_id) into v_exists;
  if v_exists then
    delete from public.qa_upvotes where question_id = p_question_id and participant_id = p_participant_id;
  else
    insert into public.qa_upvotes (question_id, participant_id) values (p_question_id, p_participant_id)
      on conflict do nothing;
  end if;
  update public.qa_questions q set upvotes =
    (select count(*) from public.qa_upvotes u where u.question_id = q.id)
    where q.id = p_question_id returning upvotes into v_count;
  return jsonb_build_object('ok', true, 'upvoted', not v_exists, 'upvotes', v_count);
end $$;

create or replace function public.get_questions(p_session_id uuid, p_participant_id uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'text', q.text, 'author', q.author_nickname, 'status', q.status,
    'upvotes', q.upvotes, 'createdAt', q.created_at,
    'mine', (q.participant_id = p_participant_id),
    'upvotedByMe', exists(select 1 from public.qa_upvotes u
      where u.question_id = q.id and u.participant_id = p_participant_id))
    order by case q.status when 'answered' then 1 else 0 end, q.upvotes desc, q.created_at asc), '[]'::jsonb)
  from public.qa_questions q
  where q.session_id = p_session_id and q.status in ('visible','answered');
$$;

-- ============ participant count (for stage header) ============
create or replace function public.get_participant_count(p_session_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.participants where session_id = p_session_id;
$$;

-- Lock down: revoke everything by default, grant execute selectively
revoke all on all functions in schema public from anon, authenticated;
grant execute on function public.join_session(text, text, text) to anon, authenticated;
grant execute on function public.get_session_state(uuid) to anon, authenticated;
grant execute on function public.submit_response(uuid, uuid, uuid, text, jsonb) to anon, authenticated;
grant execute on function public.get_results(uuid, uuid) to anon, authenticated;
grant execute on function public.get_leaderboard(uuid, int) to anon, authenticated;
grant execute on function public.get_my_rank(uuid, uuid) to anon, authenticated;
grant execute on function public.submit_question(uuid, uuid, text, text, boolean) to anon, authenticated;
grant execute on function public.toggle_upvote(uuid, uuid, text) to anon, authenticated;
grant execute on function public.get_questions(uuid, uuid) to anon, authenticated;
grant execute on function public.get_participant_count(uuid) to anon, authenticated;
