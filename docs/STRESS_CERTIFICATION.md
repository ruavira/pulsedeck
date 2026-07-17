# PulseDeck — Stress & Verification Certification
**Build:** deploy `6a51937a…` (frozen) · **Date:** July 10–11, 2026 · **Target event:** ~50–300 participants · **Certified at:** 1,000 concurrent

## Functional verification (production, 36/36 assertions)
Deck lifecycle & auth (create/load/save/delete, key required, 401 on missing key) · join idempotency (same device = same participant, score preserved) · profane nickname sanitized · vote gating (rejected while closed, accepted while open, change-vote upsert, exactly-once aggregation) · **quiz scoring integrity** (correct = exactly 1000 accuracy points, wrong = 0, answers immutable after grading, device-key spoofing rejected, leaderboard exact, rank exact) · wordcloud profanity filtering (dirty terms silently dropped; all-dirty submissions rejected) · Q&A (submit, upvote toggle, list with ownership, profane blocked, moderation states) · room lock (new devices refused, known devices re-admitted) · participant counting · xlsx + csv export · session end (further votes refused).

## Load scenarios (all against production: Netlify edge + functions + Supabase ca-central-1)

| Scenario | Load | Result | Latency (p50/p95/p99) |
|---|---|---|---|
| A — QR-scan stampede | 1,000 VUs join + vote over 60s | **0 failures / 2,000 req** | 69 / 104 / 194 ms |
| B — Quiz answer burst | 1,000 VUs join **and** answer inside 10s (200 rps) | **0 failures / 2,000 req** | 77 / 180 / 235 ms |
| C — Word-cloud flood | 800 VUs × 3 words in 30s incl. 4% profanity payloads | **0 failures / 1,600 req** | 70 / 93 / 131 ms |
| D — Reconnection storm | 500 VUs × 4 state resyncs in a 10s window | **0 failures / 2,000 req** | 163 / 367 / 433 ms |

**Integrity checks at scale:** poll aggregate = exactly 1,000 votes (no loss, no double-count); quiz aggregate = exactly 1,000 graded answers, every correct answer exactly 1,000 points; leaderboard consistent; word-cloud results contained **zero** profanity across 2,400 submitted words; aggregate query latency 0.3–0.6s under load (within the 500ms–2.5s stage polling budget with in-flight guard).

## Presenter recoverability
All session state lives in Postgres; the stage, remote, and audience surfaces resync from the database on reconnect, tab-wake, and a 15–20s heartbeat. Reopening any surface (new browser, new machine) with the presenter key resumes exactly. Verified via the reconnect scenario + presenter session GET path.

## Known trade-offs (documented, accepted for v1)
- Realtime broadcast channels are public per-session; a technically skilled attendee who extracts the session UUID could forge cosmetic channel events (never scores/votes — those are server-authoritative). Clients self-heal from the database within seconds. P2 hardening: private channels + realtime authorization.
- Browser-websocket delivery was protocol-verified from the build environment; the sandbox's proxy prevented a full in-browser realtime rehearsal. The resync/polling fallback guarantees correctness even with realtime fully down (worst case: results update every few seconds instead of instantly). **Recommended: run the rehearsal session from your own machine tonight — that is the definitive end-to-end check.**
- Free-tier Netlify/Supabase quotas comfortably cover a 300-person event (verified ~7,600 requests during certification without throttling).

**Deployment freeze in effect** — no code changes after this certification; content edits in the studio are safe.
