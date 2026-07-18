# PulseDeck Supabase Source Control

This source tree was recovered from Netlify and then reconnected to GitHub. The production Supabase project is the source of truth for already-applied migration versions.

## Production migration ledger

Verified against Supabase production on 2026-07-15:

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

## Cleanup notes

- `.env*`, `.netlify`, `.next`, `node_modules`, build output, and local TypeScript build metadata are ignored and must stay out of Git.
- The recovered `001_*.sql` through `004_*.sql` files are legacy source snapshots from the archive. Do not use that short-name pattern for new database work.
- New database work should be timestamped, committed under `supabase/migrations`, and checked against the production migration ledger before deployment.
- Keep public-schema tables protected with RLS. Views exposed through the client should use `security_invoker = true`.
