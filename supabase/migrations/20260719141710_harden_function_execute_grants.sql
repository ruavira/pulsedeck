-- Follow-up to security_and_perf_polish: the previous REVOKE ... FROM anon,
-- authenticated was ineffective because these functions retain PostgreSQL's
-- default EXECUTE grant to PUBLIC, which anon/authenticated inherit. Revoke from
-- PUBLIC (and the specific roles) so the internal/server-only functions are no
-- longer reachable via /rest/v1/rpc. is_server() is deliberately left alone: RLS
-- policies invoke it, so the querying role must keep EXECUTE.
--
-- Safe because: the moderation helpers are only ever called from SECURITY
-- DEFINER RPCs owned by `postgres` (which retains EXECUTE); handle_new_user and
-- touch_updated_at are triggers (execution bypasses the EXECUTE privilege check);
-- and server_broadcast is only invoked by the service role.
revoke execute on function public._blocklist() from public, anon, authenticated;
revoke execute on function public.is_text_clean(uuid, text) from public, anon, authenticated;
revoke execute on function public.clean_words(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.server_broadcast(text, text, text, jsonb) from public, anon, authenticated;

-- Keep the server path working (service role continues to sign + broadcast).
grant execute on function public.server_broadcast(text, text, text, jsonb) to service_role;
