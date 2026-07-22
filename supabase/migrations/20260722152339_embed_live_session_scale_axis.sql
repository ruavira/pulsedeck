-- Embeds: expose the PUBLIC scale-axis fields (min/max + end labels) on the
-- current slide so a scale widget renders the deck's real axis instead of a
-- default 1-5. These are already shown publicly on the projector's scale slide;
-- still no correct-answer indices, notes, snapshot, secret or PII. Everything
-- else identical to 20260722114255_embed_live_session.
create or replace function public.get_live_session_for_deck(p_deck_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_session public.sessions;
  v_slide jsonb;
  v_current_slide jsonb := null;
  v_count int;
begin
  select * into v_session
  from public.sessions
  where deck_id = p_deck_id and status = 'live'
  order by started_at desc nulls last, created_at desc
  limit 1;

  if v_session.id is null then
    return null;
  end if;

  v_slide := v_session.deck_snapshot -> 'slides' -> v_session.current_slide_index;
  if v_slide is not null and jsonb_typeof(v_slide) = 'object' then
    v_current_slide := jsonb_strip_nulls(jsonb_build_object(
      'id', v_slide ->> 'id',
      'kind', v_slide ->> 'kind',
      'title', v_slide ->> 'title',
      'body', jsonb_strip_nulls(jsonb_build_object(
        'prompt', v_slide -> 'body' ->> 'prompt',
        'options', v_slide -> 'body' -> 'options',
        'optionImages', v_slide -> 'body' -> 'optionImages',
        'min', (v_slide -> 'body' ->> 'min')::int,
        'max', (v_slide -> 'body' ->> 'max')::int,
        'minLabel', v_slide -> 'body' ->> 'minLabel',
        'maxLabel', v_slide -> 'body' ->> 'maxLabel'
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

grant execute on function public.get_live_session_for_deck(uuid) to anon, authenticated;
