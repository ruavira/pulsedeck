-- Ops feedback, bug reporting, client error capture, and low-cost product telemetry.
-- This migration mirrors the live production schema recovered after the Netlify source restore.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

comment on table public.admin_users is
  'PulseDeck ops/admin dashboard role list. Managed server-side or by database admins.';

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references auth.users(id) on delete set null,
  reporter_email text,
  title text not null check (char_length(title) >= 3 and char_length(title) <= 160),
  description text,
  steps_to_reproduce text,
  expected_behavior text,
  actual_behavior text,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'new' check (status in ('new', 'triaged', 'in_progress', 'waiting', 'resolved', 'closed', 'wont_fix')),
  category text not null default 'bug' check (category in ('bug', 'feedback', 'feature_request', 'question', 'content', 'performance')),
  route text,
  browser text,
  device text,
  screenshot_url text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}',
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

comment on table public.bug_reports is
  'Tester and user bug reports, feedback, feature requests, and support observations.';

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid default auth.uid() references auth.users(id) on delete set null,
  event_name text not null check (char_length(event_name) >= 2 and char_length(event_name) <= 120),
  feature_key text,
  route text,
  session_id text,
  deck_id uuid,
  event_source text not null default 'web' check (event_source in ('web', 'server', 'pwa', 'powerpoint_addin', 'admin', 'unknown')),
  properties jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.app_events is
  'Low-cost product telemetry for behavior tracking. Keep properties free of secrets and sensitive content.';

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid default auth.uid() references auth.users(id) on delete set null,
  message text not null,
  stack text,
  route text,
  source text not null default 'browser' check (source in ('browser', 'server', 'edge', 'api', 'powerpoint_addin', 'unknown')),
  severity text not null default 'error' check (severity in ('info', 'warning', 'error', 'fatal')),
  status text not null default 'new' check (status in ('new', 'triaged', 'resolved', 'ignored')),
  fingerprint text generated always as (
    md5(coalesce(message, '') || '|' || coalesce(route, '') || '|' || coalesce(source, ''))
  ) stored,
  browser text,
  device text,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.client_errors is
  'Client/server error capture for grouping and triage in the ops dashboard.';

create table if not exists public.feature_catalog (
  feature_key text primary key,
  name text not null,
  category text not null default 'core' check (category in ('core', 'auth', 'studio', 'live_session', 'audience', 'billing', 'admin', 'integration', 'support')),
  route_pattern text,
  status text not null default 'live' check (status in ('planned', 'live', 'beta', 'paused', 'deprecated')),
  description text,
  expected_behavior text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.feature_catalog is
  'Living map of PulseDeck routes and features for product documentation and ops reporting.';

create index if not exists bug_reports_status_created_at_idx on public.bug_reports (status, created_at desc);
create index if not exists bug_reports_category_severity_idx on public.bug_reports (category, severity);
create index if not exists bug_reports_reporter_created_at_idx on public.bug_reports (reporter_id, created_at desc);
create index if not exists app_events_occurred_at_idx on public.app_events (occurred_at desc);
create index if not exists app_events_feature_occurred_at_idx on public.app_events (feature_key, occurred_at desc);
create index if not exists app_events_actor_occurred_at_idx on public.app_events (actor_id, occurred_at desc);
create index if not exists app_events_event_name_idx on public.app_events (event_name);
create index if not exists client_errors_fingerprint_idx on public.client_errors (fingerprint, occurred_at desc);
create index if not exists client_errors_status_created_at_idx on public.client_errors (status, created_at desc);
create index if not exists client_errors_route_idx on public.client_errors (route);

drop trigger if exists bug_reports_set_updated_at on public.bug_reports;
create trigger bug_reports_set_updated_at
before update on public.bug_reports
for each row execute function public.set_updated_at();

drop trigger if exists client_errors_set_updated_at on public.client_errors;
create trigger client_errors_set_updated_at
before update on public.client_errors
for each row execute function public.set_updated_at();

drop trigger if exists feature_catalog_set_updated_at on public.feature_catalog;
create trigger feature_catalog_set_updated_at
before update on public.feature_catalog
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.bug_reports enable row level security;
alter table public.app_events enable row level security;
alter table public.client_errors enable row level security;
alter table public.feature_catalog enable row level security;

drop policy if exists "admin users can read their own role" on public.admin_users;
create policy "admin users can read their own role"
on public.admin_users for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "anonymous users can create public bug reports" on public.bug_reports;
create policy "anonymous users can create public bug reports"
on public.bug_reports for insert
to anon
with check (reporter_id is null);

drop policy if exists "authenticated users can create own bug reports" on public.bug_reports;
create policy "authenticated users can create own bug reports"
on public.bug_reports for insert
to authenticated
with check (reporter_id = (select auth.uid()));

drop policy if exists "reporters can read their own bug reports" on public.bug_reports;
create policy "reporters can read their own bug reports"
on public.bug_reports for select
to authenticated
using (reporter_id = (select auth.uid()));

drop policy if exists "admins can read all bug reports" on public.bug_reports;
create policy "admins can read all bug reports"
on public.bug_reports for select
to authenticated
using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.role in ('owner', 'admin')
  )
);

drop policy if exists "admins can update bug reports" on public.bug_reports;
create policy "admins can update bug reports"
on public.bug_reports for update
to authenticated
using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.role in ('owner', 'admin')
  )
);

drop policy if exists "anonymous users can write app events" on public.app_events;
create policy "anonymous users can write app events"
on public.app_events for insert
to anon
with check (actor_id is null);

drop policy if exists "authenticated users can write app events" on public.app_events;
create policy "authenticated users can write app events"
on public.app_events for insert
to authenticated
with check (actor_id = (select auth.uid()) or actor_id is null);

drop policy if exists "admins can read app events" on public.app_events;
create policy "admins can read app events"
on public.app_events for select
to authenticated
using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.role in ('owner', 'admin')
  )
);

drop policy if exists "anonymous users can write client errors" on public.client_errors;
create policy "anonymous users can write client errors"
on public.client_errors for insert
to anon
with check (actor_id is null);

drop policy if exists "authenticated users can write client errors" on public.client_errors;
create policy "authenticated users can write client errors"
on public.client_errors for insert
to authenticated
with check (actor_id = (select auth.uid()) or actor_id is null);

drop policy if exists "admins can read client errors" on public.client_errors;
create policy "admins can read client errors"
on public.client_errors for select
to authenticated
using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.role in ('owner', 'admin')
  )
);

drop policy if exists "admins can update client errors" on public.client_errors;
create policy "admins can update client errors"
on public.client_errors for update
to authenticated
using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.role in ('owner', 'admin')
  )
);

drop policy if exists "admins can read feature catalog" on public.feature_catalog;
create policy "admins can read feature catalog"
on public.feature_catalog for select
to authenticated
using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.role in ('owner', 'admin')
  )
);

drop policy if exists "admins can maintain feature catalog" on public.feature_catalog;
create policy "admins can maintain feature catalog"
on public.feature_catalog for all
to authenticated
using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
      and au.role in ('owner', 'admin')
  )
);

drop view if exists public.ops_bug_summary;
create view public.ops_bug_summary
with (security_invoker = true) as
select
  status,
  severity,
  category,
  count(*) as report_count,
  min(created_at) as oldest_report_at,
  max(created_at) as newest_report_at
from public.bug_reports
group by status, severity, category;

drop view if exists public.ops_event_daily;
create view public.ops_event_daily
with (security_invoker = true) as
select
  date_trunc('day', occurred_at)::date as event_date,
  coalesce(feature_key, 'uncategorized') as feature_key,
  event_name,
  count(*) as event_count,
  count(distinct actor_id) filter (where actor_id is not null) as signed_in_users
from public.app_events
group by date_trunc('day', occurred_at)::date, coalesce(feature_key, 'uncategorized'), event_name;

drop view if exists public.ops_error_groups;
create view public.ops_error_groups
with (security_invoker = true) as
select
  fingerprint,
  left(message, 240) as message_sample,
  route,
  source,
  severity,
  status,
  count(*) as occurrence_count,
  min(occurred_at) as first_seen_at,
  max(occurred_at) as last_seen_at
from public.client_errors
group by fingerprint, left(message, 240), route, source, severity, status;

drop view if exists public.ops_feature_health;
create view public.ops_feature_health
with (security_invoker = true) as
select
  fc.feature_key,
  fc.name,
  fc.category,
  fc.status,
  fc.route_pattern,
  count(ae.id) filter (where ae.occurred_at >= now() - interval '7 days') as events_7d,
  count(ce.id) filter (where ce.occurred_at >= now() - interval '7 days') as errors_7d,
  count(br.id) filter (where br.created_at >= now() - interval '7 days') as reports_7d,
  max(ae.occurred_at) as last_event_at
from public.feature_catalog fc
left join public.app_events ae on ae.feature_key = fc.feature_key
left join public.client_errors ce on ce.metadata ->> 'feature_key' = fc.feature_key
left join public.bug_reports br on br.metadata ->> 'feature_key' = fc.feature_key
group by fc.feature_key, fc.name, fc.category, fc.status, fc.route_pattern;

grant select on public.admin_users to authenticated;
grant select, insert, update on public.bug_reports to authenticated;
grant insert on public.bug_reports to anon;
grant select, insert on public.app_events to authenticated;
grant insert on public.app_events to anon;
grant select, insert, update on public.client_errors to authenticated;
grant insert on public.client_errors to anon;
grant select, insert, update, delete on public.feature_catalog to authenticated;
grant select on public.ops_bug_summary, public.ops_event_daily, public.ops_error_groups, public.ops_feature_health to authenticated;

insert into public.feature_catalog (feature_key, name, category, route_pattern, status, description, expected_behavior)
values
  ('auth-login', 'Authentication and login', 'auth', '/login, /signup, /auth/callback', 'live', 'Presenter authentication using Google, email password, and magic-link flows.', 'Approved users can reach Studio after sign-in; unapproved users see invitation-only messaging.'),
  ('studio-home', 'Presenter Studio', 'studio', '/studio', 'live', 'Primary workspace for presenters after login.', 'Presenters can view, create, and manage decks from the studio.'),
  ('deck-builder', 'Deck builder', 'studio', '/studio/decks/*', 'live', 'Interactive deck authoring for slides and activities.', 'Presenters can add/edit slides, polls, quizzes, word clouds, Q&A, and media.'),
  ('audience-join', 'Audience join flow', 'audience', '/j', 'live', 'Audience entry point using a live presentation code or QR link.', 'Participants can join an active room without creating an account.'),
  ('live-session', 'Live presentation session', 'live_session', '/present/*, /session/*', 'live', 'Presenter-controlled live room for audience participation.', 'Presenters can start sessions and audience responses update live.'),
  ('polls', 'Poll activities', 'live_session', null, 'live', 'Multiple-choice and activity responses collected during sessions.', 'Audience responses are recorded and results can be displayed.'),
  ('quizzes', 'Quiz activities', 'live_session', null, 'live', 'Scored quiz interactions and leaderboard behavior.', 'Participants can answer quizzes and presenters can review results.'),
  ('word-clouds', 'Word clouds', 'live_session', null, 'live', 'Open-text activity with aggregated visual results.', 'Audience responses feed a live word cloud.'),
  ('qa', 'Q&A', 'live_session', null, 'live', 'Audience questions and upvotes during a session.', 'Participants can ask/upvote questions and presenters can moderate.'),
  ('billing', 'Billing and plans', 'billing', '/pricing, /account, /api/billing/checkout', 'beta', 'Free/Pro plan surface and Stripe checkout handoff.', 'Signed-in users can view plans and start checkout when billing is configured.'),
  ('support-policy', 'Support and policy pages', 'support', '/support, /privacy, /terms', 'live', 'Public support, privacy, and terms documentation.', 'Visitors can understand support channels, privacy practices, and terms.'),
  ('powerpoint-addin', 'PowerPoint add-in', 'integration', null, 'beta', 'PowerPoint add-in integration described in PulseDeck policy pages.', 'Add-in users follow the same account and content rules as the web app.'),
  ('ops-dashboard', 'Ops feedback and telemetry dashboard', 'admin', '/admin/ops', 'live', 'Admin-only bug tracking, feedback, client errors, and product-behavior telemetry.', 'Admins can triage feedback and understand how PulseDeck behaves in real use.')
on conflict (feature_key) do update set
  name = excluded.name,
  category = excluded.category,
  route_pattern = excluded.route_pattern,
  status = excluded.status,
  description = excluded.description,
  expected_behavior = excluded.expected_behavior,
  updated_at = now();

insert into public.admin_users (user_id, role, notes)
select u.id, 'owner', 'Seeded owner for PulseDeck ops dashboard.'
from auth.users u
where lower(u.email) = lower('ayodeji.esamuels@gmail.com')
on conflict (user_id) do update set role = excluded.role;
