# PulseDeck Supabase Source Control

This source tree was recovered from Netlify and then reconnected to GitHub. The production Supabase project is the source of truth for already-applied migration versions.

## Production migration ledger

Verified against Supabase production on 2026-07-19:

| Version | Name |
| --- | --- |
| 20260710213235 | core_schema |
| 20260710213330 | rpcs |
| 20260710213349 | safety |
| 20260710213522 | server_gate |
| 20260710230540 | contract_fixes |
| 20260711004416 | server_delete_media |
| 20260711032016 | warmup_kinds |
| 20260711040852 | join_kind |
| 20260711233713 | accounts_billing |
| 20260712033017 | join_session_participant_cap |
| 20260712122225 | response_latency_telemetry |
| 20260715213631 | ops_feedback_and_telemetry |
| 20260718145231 | lms_bridge |
| 20260719040753 | ruavira_moodle_events_tables |
| 20260719040843 | ruavira_dashboard_users_and_rls |
| 20260719040907 | ruavira_rollup_views |
| 20260719040949 | ruavira_secrets_table |
| 20260719141544 | security_and_perf_polish |
| 20260719141710 | harden_function_execute_grants |
| 20260722114255 | embed_live_session |
| 20260722150519 | fix_get_results_total |
| 20260722152339 | embed_live_session_scale_axis |

## Cleanup notes

- `.env*`, `.netlify`, `.next`, `node_modules`, build output, and local TypeScript build metadata are ignored and must stay out of Git.
- The recovered `001_*.sql` through `004_*.sql` files are legacy source snapshots from the archive. Do not use that short-name pattern for new database work.
- New database work should be timestamped, committed under `supabase/migrations`, and checked against the production migration ledger before deployment.
- `20260722114255_embed_live_session` (PulseDeck Embeds) is **applied to production** (verified 2026-07-22) — it adds the read-only, public/live `get_live_session_for_deck(uuid)` RPC (granted to anon/authenticated), returning only the public fields the stage already shows.
- Keep public-schema tables protected with RLS. Views exposed through the client should use `security_invoker = true`.
