-- Security + performance polish sweep (addresses Supabase advisor findings).
-- All changes are idempotent and preserve the anonymous audience-RPC contract
-- described in ARCHITECTURE.md.

-- 1. Close the one real RLS hole: moodle_ingest_log was public + RLS-disabled,
--    i.e. readable/writable by anyone holding the anon key. Make it
--    service-role-only (RLS on, no anon/authenticated policy) to match the
--    sibling public.ruavira_secrets table. The webhook ingest path writes via
--    the service role, which bypasses RLS.
alter table public.moodle_ingest_log enable row level security;

-- 2. Media bucket: a public bucket serves object URLs without any SELECT policy
--    on storage.objects. The broad "public read media" policy additionally let
--    anyone LIST every file in the bucket. Drop it -- public object URLs keep
--    working; enumeration stops.
drop policy if exists "public read media" on storage.objects;

-- 3. Revoke EXECUTE from anon/authenticated on functions never called directly
--    by clients: content-moderation helpers run inside SECURITY DEFINER RPCs (as
--    owner), the trigger functions do not need a caller grant, and
--    server_broadcast is server-only. is_server() is intentionally NOT touched
--    because RLS policies invoke it and therefore the querying role needs EXECUTE.
--    NOTE: these functions also carry PostgreSQL's default EXECUTE grant to
--    PUBLIC; that is revoked in the follow-up migration 20260719141710.
revoke execute on function public._blocklist() from anon, authenticated;
revoke execute on function public.is_text_clean(uuid, text) from anon, authenticated;
revoke execute on function public.clean_words(uuid, jsonb) from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.touch_updated_at() from anon, authenticated;
revoke execute on function public.server_broadcast(text, text, text, jsonb) from anon, authenticated;
grant execute on function public.server_broadcast(text, text, text, jsonb) to service_role;

-- 4. Pin search_path on the five functions the linter flagged as mutable
--    (matches the existing search_path=public convention used by is_server /
--    handle_new_user). Prevents search-path hijacking.
alter function public._blocklist() set search_path = public;
alter function public.is_text_clean(uuid, text) set search_path = public;
alter function public.clean_words(uuid, jsonb) set search_path = public;
alter function public.touch_updated_at() set search_path = public;
alter function public._session_open_slide(uuid) set search_path = public;

-- 5. Covering indexes for unindexed foreign keys. The first four are on the hot
--    live-session join/aggregate paths; the rest are ops tables.
create index if not exists sessions_deck_id_idx        on public.sessions(deck_id);
create index if not exists responses_participant_id_idx on public.responses(participant_id);
create index if not exists qa_questions_participant_idx on public.qa_questions(participant_id);
create index if not exists qa_upvotes_participant_idx   on public.qa_upvotes(participant_id);
create index if not exists admin_users_created_by_idx   on public.admin_users(created_by);
create index if not exists bug_reports_assigned_to_idx  on public.bug_reports(assigned_to);
create index if not exists client_errors_actor_id_idx   on public.client_errors(actor_id);

-- 6. Collapse per-row re-evaluation of auth.uid()/is_server() in RLS policies to
--    a single initplan by wrapping them in scalar subqueries. Semantics unchanged.
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using (((select auth.uid()) = id) or (select public.is_server()));

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (((select auth.uid()) = id) or (select public.is_server()))
  with check (((select auth.uid()) = id) or (select public.is_server()));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (((select auth.uid()) = id) or (select public.is_server()));

drop policy if exists subscriptions_self_read on public.subscriptions;
create policy subscriptions_self_read on public.subscriptions for select
  using (((select auth.uid()) = user_id) or (select public.is_server()));

drop policy if exists subscriptions_server_write on public.subscriptions;
create policy subscriptions_server_write on public.subscriptions for all
  using ((select public.is_server()))
  with check ((select public.is_server()));

drop policy if exists ruavira_dash_self on public.ruavira_dashboard_users;
create policy ruavira_dash_self on public.ruavira_dashboard_users for select
  to authenticated using (user_id = (select auth.uid()));
