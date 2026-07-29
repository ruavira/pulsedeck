-- A human action from the private Remote must outrank every Chrome controller
-- until the hold expires. The prior predicate allowed the expired lease branch
-- to bypass that hold; keep the hold as a mandatory outer condition.

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

revoke all on function public.claim_gamma_controller_lease(uuid, uuid, boolean, int) from public;
grant execute on function public.claim_gamma_controller_lease(uuid, uuid, boolean, int) to anon, authenticated;
