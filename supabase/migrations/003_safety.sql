-- Safety layer (council P0 #9): profanity filtering default-on for all audience
-- free text, plus per-session banned words (presenter "hide this word" kill switch).

create table public.banned_words (
  session_id uuid not null references public.sessions(id) on delete cascade,
  word text not null,
  primary key (session_id, word)
);
alter table public.banned_words enable row level security;

-- Compact multi-language blocklist; presenters can extend per session.
-- Deliberately conservative: only unambiguous slurs/profanity (substring-safe words
-- are matched as whole words to avoid the Scunthorpe problem).
create or replace function public._blocklist() returns text[] language sql immutable as $$
  select array[
    'fuck','fucking','fucker','shit','bullshit','bitch','cunt','asshole','dickhead',
    'nigger','nigga','faggot','retard','retarded','whore','slut','wanker','bollocks',
    'motherfucker','cocksucker','twat','spastic','tranny','kike','spic','chink','wetback',
    'porn','pussy','penis','vagina'
  ];
$$;

-- Whole-word check against global blocklist + session banned words.
create or replace function public.is_text_clean(p_session_id uuid, p_text text)
returns boolean language plpgsql stable as $$
declare w text;
begin
  foreach w in array public._blocklist() loop
    if p_text ~* ('\m' || w || '\M') then return false; end if;
  end loop;
  for w in select word from public.banned_words where session_id = p_session_id loop
    if p_text ~* ('\m' || regexp_replace(w, '([\\.^$|()\[\]{}*+?])', '\\\1', 'g') || '\M') then
      return false;
    end if;
  end loop;
  return true;
end $$;

-- Wire into submit_response: reject dirty words/text payloads (silent-clean for wordclouds).
create or replace function public.clean_words(p_session_id uuid, p_words jsonb)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(w), '[]'::jsonb) from (
    select lower(trim(value)) as w
    from jsonb_array_elements_text(p_words)
    where trim(value) <> ''
      and char_length(trim(value)) <= 40
      and public.is_text_clean(p_session_id, trim(value))
    limit 5
  ) t;
$$;

-- Nickname hygiene at join + text checks are enforced inside the v2 RPCs below.

-- Patch join_session: clean nicknames (fall back to 'Guest').
create or replace function public.join_session(p_code text, p_nickname text, p_device_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_session public.sessions; v_participant public.participants; v_nick text;
begin
  select * into v_session from public.sessions
    where upper(code) = upper(p_code) and status <> 'ended'
    order by created_at desc limit 1;
  if v_session.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if coalesce((v_session.settings->>'locked')::boolean, false)
     and not exists (select 1 from public.participants
       where session_id = v_session.id and device_key = p_device_key) then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;
  v_nick := left(coalesce(nullif(trim(p_nickname), ''), 'Guest'), 40);
  if not public.is_text_clean(v_session.id, v_nick) then v_nick := 'Guest'; end if;
  insert into public.participants (session_id, nickname, device_key)
    values (v_session.id, v_nick, p_device_key)
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

grant execute on function public.join_session(text, text, text) to anon, authenticated;
