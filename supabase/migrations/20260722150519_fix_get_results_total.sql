-- Fix: get_results returned `total` = count of DISTINCT answered options for
-- poll/quiz/ranking (because count(*) ran over the GROUP BY subquery), instead of
-- the number of responses. That made the stage bar-chart percentage labels
-- (count/total) and any "N responses" readout wrong — e.g. an 80-vote poll spread
-- across 4 options reported total=4, rendering the leader at 850%. The
-- wordcloud/scale/open_text branches already computed total as the response count.
-- Only the total for the choice-based branch changes; counts and everything else
-- are byte-for-byte identical to the prior definition. Verified live: an 80-vote
-- poll now returns total=80 (leader 43%). Applied to production 2026-07-22.
create or replace function public.get_results(p_session_id uuid, p_slide_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
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
    select jsonb_build_object('kind', v_kind,
      'total', (select count(*) from public.responses
                where session_id = p_session_id and slide_id = p_slide_id),
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
  else
    select jsonb_build_object('kind', 'open_text', 'total', count(*),
      'entries', coalesce(jsonb_agg(jsonb_build_object('text', payload->>'text') order by created_at desc), '[]'::jsonb))
    into v_out from (
      select payload, created_at from public.responses
      where session_id = p_session_id and slide_id = p_slide_id
      order by created_at desc limit 100) t;
  end if;

  v_out := coalesce(v_out, jsonb_build_object('kind', v_kind, 'total', 0));

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
end $function$;
