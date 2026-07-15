-- PulseDeck core schema
-- Architecture: writes go through SECURITY DEFINER RPCs (idempotent, server-authoritative
-- scoring); reads go through aggregate RPCs. Direct table access from anon is denied by RLS.
-- Realtime: tiny state broadcasts on channel session:{id}; the stage view is the single
-- aggregator (polls aggregate RPCs) so DB load is O(1) in audience size.

create extension if not exists pgcrypto;

-- ============ decks ============
create table public.decks (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled deck',
  presenter_secret text not null default encode(gen_random_bytes(24), 'hex'),
  theme jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ slides ============
-- kind: content | poll | wordcloud | quiz | qa | scale | ranking | open_text
create table public.slides (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  position int not null default 0,
  kind text not null default 'content'
    check (kind in ('content','poll','wordcloud','quiz','qa','scale','ranking','open_text')),
  title text not null default '',
  body jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index slides_deck_pos on public.slides (deck_id, position);

-- ============ sessions (a live run of a deck) ============
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  code text not null unique,
  status text not null default 'lobby' check (status in ('lobby','live','ended')),
  current_slide_index int not null default 0,
  -- phase of the current interactive slide: show | open | closed | reveal
  phase text not null default 'show' check (phase in ('show','open','closed','reveal')),
  phase_opened_at timestamptz,
  deck_snapshot jsonb,            -- frozen copy of slides at go-live (stable during a run)
  settings jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index sessions_code on public.sessions (code) where status <> 'ended';

-- ============ participants ============
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  nickname text not null default '',
  device_key text not null,
  score int not null default 0,
  streak int not null default 0,
  joined_at timestamptz not null default now(),
  unique (session_id, device_key)
);
create index participants_session on public.participants (session_id);
create index participants_leaderboard on public.participants (session_id, score desc);

-- ============ responses (one per participant per slide; upsert) ============
create table public.responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  slide_id uuid not null,
  participant_id uuid not null references public.participants(id) on delete cascade,
  payload jsonb not null,          -- {choice}|{choices}|{text}|{words}|{value}|{ranking}
  answered_ms int,
  is_correct boolean,
  points int not null default 0,
  created_at timestamptz not null default now(),
  unique (slide_id, participant_id)
);
create index responses_slide on public.responses (session_id, slide_id);

-- ============ Q&A ============
create table public.qa_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete set null,
  author_nickname text not null default 'Anonymous',
  text text not null check (char_length(text) between 1 and 500),
  status text not null default 'visible'
    check (status in ('pending','visible','answered','archived')),
  upvotes int not null default 0,
  created_at timestamptz not null default now()
);
create index qa_session on public.qa_questions (session_id, status, upvotes desc);

create table public.qa_upvotes (
  question_id uuid not null references public.qa_questions(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (question_id, participant_id)
);

-- ============ RLS: deny-by-default; all access via RPC or service role ============
alter table public.decks enable row level security;
alter table public.slides enable row level security;
alter table public.sessions enable row level security;
alter table public.participants enable row level security;
alter table public.responses enable row level security;
alter table public.qa_questions enable row level security;
alter table public.qa_upvotes enable row level security;
-- No policies: anon/authenticated cannot touch tables directly. RPCs are SECURITY DEFINER.
