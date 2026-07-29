-- Cover the foreign keys used during session/controller deletion and satisfy
-- the Supabase performance advisor for the v0.4 Gamma Sync tables.

create index if not exists gamma_pairing_codes_session_idx
  on public.gamma_pairing_codes(session_id);

create index if not exists gamma_controller_leases_controller_idx
  on public.gamma_controller_leases(controller_id)
  where controller_id is not null;
