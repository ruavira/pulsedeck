-- PulseDeck Embeds — public live-session resolver for deck-scoped iframe widgets.
--
-- PUBLIC / LIVE DATA ONLY. This function returns exactly what the projector (the
-- /present stage) already shows publicly during a live session: the join code,
-- the current phase, the running slide index, a live participant count, and the
-- PUBLIC-SAFE fields of the current slide. It deliberately NEVER returns anything
-- deck-private: no presenter_secret, no deck_snapshot, no correct-answer indices,
-- no speaker notes, no PII. Embeds resolve a deck (paste-once URL) to whatever
-- session is live right now, then consume aggregate results via the granted
-- get_results RPC and realtime broadcasts — same surface an audience phone sees.
--
-- Mirrors the public shape of get_session_state / get_results (see 002_rpcs.sql).

create or replace function public.get_live_session_for_deck(p_deck_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_session public.sessions;
  v_slide jsonb;
  v_current_slide jsonb := null;
  v_count int;
begin
  -- The deck's currently-live session. If several are live (rare), take the most
  -- recently started one.
  select * into v_session
  from public.sessions
  where deck_id = p_deck_id and status = 'live'
  order by started_at desc nulls last, created_at desc
  limit 1;

  if v_session.id is null then
    return null; -- nothing live for this deck right now (pre-live / ended)
  end if;

  -- Current slide from the frozen snapshot, reduced to PUBLIC-SAFE fields only.
  -- This mirrors exactly what the stage renders publicly for the running slide;
  -- correct-answer indices, notes, background images and every other authoring
  -- field are intentionally omitted.
  v_slide := v_session.deck_snapshot -> 'slides' -> v_session.current_slide_index;
  if v_slide is not null and jsonb_typeof(v_slide) = 'object' then
    v_current_slide := jsonb_strip_nulls(jsonb_build_object(
      'id', v_slide ->> 'id',
      'kind', v_slide ->> 'kind',
      'title', v_slide ->> 'title',
      'body', jsonb_strip_nulls(jsonb_build_object(
        'prompt', v_slide -> 'body' ->> 'prompt',
        'options', v_slide -> 'body' -> 'options',
        'optionImages', v_slide -> 'body' -> 'optionImages'
      )),
      'settings', jsonb_strip_nulls(jsonb_build_object(
        'timeLimitSec', (v_slide -> 'settings' ->> 'timeLimitSec')::int
      ))
    ));
  end if;

  select count(*)::int into v_count
  from public.participants where session_id = v_session.id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'code', v_session.code,
    'phase', v_session.phase,
    'status', v_session.status,
    'current_slide_index', v_session.current_slide_index,
    'participant_count', v_count,
    'current_slide', v_current_slide
  );
end $$;

-- Public read surface, same as the other audience-facing RPCs.
grant execute on function public.get_live_session_for_deck(uuid) to anon, authenticated;
