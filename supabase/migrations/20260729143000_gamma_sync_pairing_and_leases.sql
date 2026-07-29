-- Gamma Sync v0.4: scoped controller credentials, one-time pairing,
-- atomic presenter leases, and deck-level Gamma baselines.

create table if not exists public.gamma_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  code_hash text not null unique,
  label text not null default 'Chrome presenter',
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.gamma_controllers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'Chrome presenter',
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists gamma_controllers_session_idx
  on public.gamma_controllers(session_id) where revoked_at is null;

create table if not exists public.gamma_controller_leases (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  controller_id uuid references public.gamma_controllers(id) on delete set null,
  lease_expires_at timestamptz not null default now(),
  remote_hold_until timestamptz not null default '-infinity',
  updated_at timestamptz not null default now()
);

create table if not exists public.gamma_deck_baselines (
  deck_id uuid not null references public.decks(id) on delete cascade,
  document_slug text not null,
  fingerprint text not null,
  card_count int not null check (card_count > 0),
  captured_at timestamptz not null default now(),
  primary key (deck_id, document_slug)
);

alter table public.gamma_pairing_codes enable row level security;
alter table public.gamma_controllers enable row level security;
alter table public.gamma_controller_leases enable row level security;
alter table public.gamma_deck_baselines enable row level security;

-- Supabase's 2026 Data API defaults no longer expose new public tables. These
-- explicit grants are required by the server-gated anon client; RLS below keeps
-- ordinary anon/authenticated requests at zero rows.
grant select, insert, update, delete on public.gamma_pairing_codes to anon, authenticated;
grant select, insert, update, delete on public.gamma_controllers to anon, authenticated;
grant select, insert, update, delete on public.gamma_controller_leases to anon, authenticated;
grant select, insert, update, delete on public.gamma_deck_baselines to anon, authenticated;

create policy gamma_pairing_server_all on public.gamma_pairing_codes
  for all using ((select public.is_server())) with check ((select public.is_server()));
create policy gamma_controllers_server_all on public.gamma_controllers
  for all using ((select public.is_server())) with check ((select public.is_server()));
create policy gamma_leases_server_all on public.gamma_controller_leases
  for all using ((select public.is_server())) with check ((select public.is_server()));
create policy gamma_baselines_server_all on public.gamma_deck_baselines
  for all using ((select public.is_server())) with check ((select public.is_server()));

create or replace function public.claim_gamma_controller_lease(
  p_session_id uuid,
  p_controller_id uuid,
  p_force boolean default false,
  p_ttl_seconds int default 75
)
returns table (
  granted boolean,
  active_controller_id uuid,
  lease_expires_at timestamptz,
  remote_hold_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_ttl int := greatest(30, least(coalesce(p_ttl_seconds, 75), 180));
begin
  if not public.is_server() then
    raise insufficient_privilege using message = 'server_only';
  end if;

  insert into public.gamma_controller_leases (
    session_id, controller_id, lease_expires_at, remote_hold_until, updated_at
  ) values (
    p_session_id, p_controller_id, v_now + make_interval(secs => v_ttl), '-infinity', v_now
  )
  on conflict (session_id) do update
    set controller_id = excluded.controller_id,
        lease_expires_at = excluded.lease_expires_at,
        remote_hold_until = case
          when p_force then '-infinity'::timestamptz
          else public.gamma_controller_leases.remote_hold_until
        end,
        updated_at = v_now
    where public.gamma_controller_leases.remote_hold_until <= v_now
      and (
        public.gamma_controller_leases.controller_id = p_controller_id
        or public.gamma_controller_leases.lease_expires_at <= v_now
        or p_force
      );

  return query
    select
      l.controller_id = p_controller_id
        and l.lease_expires_at > v_now
        and l.remote_hold_until <= v_now,
      l.controller_id,
      l.lease_expires_at,
      l.remote_hold_until
    from public.gamma_controller_leases l
    where l.session_id = p_session_id;
end;
$$;

create or replace function public.release_gamma_controller_lease(
  p_session_id uuid,
  p_controller_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_server() then
    raise insufficient_privilege using message = 'server_only';
  end if;
  update public.gamma_controller_leases
    set controller_id = null, lease_expires_at = now(), updated_at = now()
    where session_id = p_session_id and controller_id = p_controller_id;
end;
$$;

create or replace function public.hold_gamma_controller_for_remote(
  p_session_id uuid,
  p_hold_seconds int default 30
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_until timestamptz := now() + make_interval(secs => greatest(10, least(coalesce(p_hold_seconds, 30), 300)));
begin
  if not public.is_server() then
    raise insufficient_privilege using message = 'server_only';
  end if;
  insert into public.gamma_controller_leases (
    session_id, controller_id, lease_expires_at, remote_hold_until, updated_at
  ) values (p_session_id, null, now(), v_until, now())
  on conflict (session_id) do update
    set controller_id = null,
        lease_expires_at = now(),
        remote_hold_until = v_until,
        updated_at = now();
  return v_until;
end;
$$;

revoke all on function public.claim_gamma_controller_lease(uuid, uuid, boolean, int) from public;
revoke all on function public.release_gamma_controller_lease(uuid, uuid) from public;
revoke all on function public.hold_gamma_controller_for_remote(uuid, int) from public;
grant execute on function public.claim_gamma_controller_lease(uuid, uuid, boolean, int) to anon, authenticated;
grant execute on function public.release_gamma_controller_lease(uuid, uuid) to anon, authenticated;
grant execute on function public.hold_gamma_controller_for_remote(uuid, int) to anon, authenticated;
