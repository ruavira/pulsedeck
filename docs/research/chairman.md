# COUNCIL VERDICT

## Where the Council Agrees

Thirteen voices, near-total convergence on the core physics and the core failures:

1. **The product is one loop**: presenter shows a prompt → N phones submit → server aggregates → big screen renders. Everything else is decoration. Scope every decision against this loop.
2. **Server-authoritative everything.** Votes land in Postgres via idempotent HTTPS POST (`UNIQUE(session_id, question_id, participant_id)` upsert), never over the realtime socket. Server timestamps score answers. Client clocks decide nothing. "Answers land in Postgres = nothing is ever lost" is the one guarantee worth everything.
3. **One broadcast channel per session, counts not rows.** 300 participants receive `slide_changed` and throttled aggregate deltas (250–500ms ticks). Never postgres_changes per participant, never per-vote fan-out, never Supabase Presence at 300. Per-vote fan-out is exactly why Wooclap's word clouds lag near their cap.
4. **Accuracy-based scoring by default.** Kahoot's speed scoring converts network jitter into unfairness — a fairness bug shipped as a feature, admitted via their 2025 Accuracy mode. Speed is at most an optional capped bonus.
5. **Reconnection is pull, not replay.** Jittered exponential backoff, then fetch current state via REST. A phone that sleeps rejoins mid-quiz with score intact via a localStorage UUID. Plus a 3–5s polling fallback if realtime dies entirely.
6. **Presenter recoverability is THE feature** for a single operator: all state in Postgres; refresh, laptop death, or a new device with the host token resumes exactly. Phone-as-remote.
7. **Join ritual**: one permanent, never-expiring QR + short code + plain URL, on every slide; tiny edge-cached join page (<50KB, <2s on one bar of LTE); zero accounts, zero app, under 10 seconds.
8. **No caps that trip mid-session** — Mentimeter's 50-participant lockout is the single most hostile pattern in the category. Nothing may stop working while people watch.
9. **Profanity filter on all free text, on by default**, plus instant hide/kill-switch. One slur on a 10-meter screen is an incident.
10. **AI is authoring-time only.** Never in the live path; everything works with AI off.
11. **Rehearsal/test mode with simulated audience** — none of the four incumbents has one, which is insane for a tool used live, once, with no second chance.
12. **Static-image PPT/PDF import is acceptable** (all four do it) — but be honest at upload: "your animations and videos become images." Markdown import is where we're natively better.
13. **Export is first-class** — locked-in data is the incumbents' churn engine.

## Where the Council Clashes

- **Scope.** Contrarian demands 5 slide types and cutting import/export/AI entirely; the educator wants 12+ pedagogical types; the expansionist wants APIs and recap loops. **Resolution (first-principles)**: four primitives — choose-from-set, free-text, place-a-point, order-a-set — implemented once, skinned as 6–8 UI types. Import/export stay (they're explicit requirements) but rasterized and simple.
- **Per-participant data.** Educator needs per-student CSV for gradebook credit; privacy-officer wants aggregate-only export by default and session-end purge. **Resolution**: aggregate by default, per-participant export behind an explicit toggle, visible anonymity badge on every phone, purge prompt at session close.
- **Video in slides.** AV-producer: locally-served MP4, no YouTube embeds. Contrarian/executor: cut it. **Resolution**: video renders on the presenter/stage output only, never pushed to audience phones; P1, not P0.
- **Q&A moderation default.** Keynote/educator say on by default; executor says off. **Resolution**: off for a known room, one toggle, shareable no-account moderator link either way.
- **Speed bonus.** Pure accuracy vs. accessibility's compromise (capped ≤10% speed bonus). **Resolution**: accuracy-only default; capped bonus as a toggle.
- **.pptx deck export.** The trainer calls it the switching trigger; the contrarian calls it a scope bomb. **Resolution**: P2 — schema supports it, nobody builds it tonight.

## Blind Spots the Council Caught

The peer reviews found what all thirteen missed:

1. **Vercel serverless → Postgres connection exhaustion.** 300 simultaneous answer POSTs through Next.js API routes will exhaust the pool before Realtime ever strains. Every write route MUST go through Supavisor transaction-mode pooling (or PostgREST direct writes). This is the real bottleneck on this exact stack.
2. **Venue NAT defeats naive rate limiting.** 300 phones behind one egress IP: per-IP rate limits lock out the whole room; per-IP dedup collapses everyone into one voter. Rate-limit and dedupe per session token, never per IP — and test it.
3. **Load-test through Vercel, not against Supabase directly** — the function-concurrency and cold-start layer is part of the system under test.
4. **RLS for anonymous writes**: open INSERT with rate limits, no SELECT on raw responses from clients.
5. **Operational readiness is not software**: pre-warm Vercel/Supabase before doors, deployment freeze after tonight's load test, presenter-visible monitoring (live connected count), hotspot failover drill, a named answer to "it's not loading" from row 40.
6. **A non-software Plan B**: a paid Mentimeter or Wooclap account with the same content pre-built — $50 of insurance against minute 12. Rehearse the failure script, not just the happy path.
7. **The expansionist's strategy (recap links, MCP, API-first) was unanimously flagged as misprioritized for tonight** — but its schema implications (stable participant UUIDs, JSON-exportable results) cost nothing and are adopted at the schema level only.

## Critique Summary: What Each Incumbent Gets Right and Wrong

- **Mentimeter** — Right: took realtime seriously (Ably, after dying at 35k); anonymity as trust; phone remote (Mentimote). Wrong: mid-session participant lockouts, expiring join codes, static-image import, quiz waiting room at cap, no deck export, annual-only billing.
- **Kahoot!** — Right: energy, leaderboard as earned moment, 2-step join acknowledges bot floods, Accuracy mode (eventually). Wrong: speed scoring punishes weak Wi-Fi and accessibility alike; childish register default-on; paywalled everything; content hostage; "smasher" attack surface.
- **AhaSlides** — Right: price, permanent join codes, shipped an MCP server. Wrong: connection drops at ~40 joins (disqualifying), no undo, no preview mode, Safari inconsistencies, "Reconnecting…" banner as apology.
- **Wooclap** — Right: real pedagogy (question breadth, "I'm confused"), SMS fallback (the field's only degradation story), EU privacy posture. Wrong: 1,000 cap with degradation before it, presenter chained to lectern, dense editor, free-tier bait-and-switch.

## The Recommendation

Build **the loop, hardened**, wearing a polished skin: a Next.js + Vercel + Supabase system where a single session drives one broadcast channel; all writes are idempotent HTTPS POSTs through pooled connections; the server aggregates and broadcasts counts on a 250–500ms throttle; every client can lose its socket and resync from REST; and the presenter can lose everything and resume from any browser. Six-to-eight activity types built on four primitives, rendered on three deliberately distinct surfaces (Stage / Presenter / Phone). Accuracy scoring, permanent QR, profanity filter, rehearsal mode, panic controls. Import rasterizes honestly; markdown is native; AI (Anthropic) generates decks and quizzes at authoring time only. Exports and the recap/API future are designed into the schema tonight and built after the event. Tonight ends with a 1,000-VU k6 test through Vercel, a deployment freeze, a runbook, and a $50 incumbent standby deck.

## Prioritized Requirements

**P0 — must work on stage tomorrow**
1. Schema: `sessions`, `slides`, `participants`, `responses` (+ `session_state` row as single source of truth); participant = localStorage UUID; RLS: anonymous INSERT only, no client SELECT on raw responses.
2. Join: permanent QR + 6-char code + short URL on every slide; static edge-cached join page <50KB; join <10s; survives 300-scan burst.
3. Transport: one broadcast channel per session; votes via HTTPS POST → Supavisor transaction-mode pooling; idempotent UNIQUE upsert; per-token (not per-IP) rate limiting; room-lock button.
4. Aggregation: server-side tally; throttled count broadcasts (250–500ms); word cloud top ~60 terms, stem-merged, 500ms batches, one-tap ranked-list view.
5. Activities: MC poll, word cloud, MC quiz (server-deadline window, accuracy scoring, SQL top-10 leaderboard), Q&A + upvote (hide-one-entry moderation), content slide (image/markdown).
6. Resilience: jittered-backoff reconnect + REST state resync; 3–5s polling fallback; queued answers on the client; "Reconnecting…" with cached question.
7. Presenter: refresh-proof resume via host token; phone remote (next/prev/reveal); clicker keys (arrows/PageUp/Down/space, B = blackout); live connected count; panic bar (close voting, hide entry, skip, blank).
8. Surfaces: Stage (≥40px type, 7:1 contrast dark theme, persistent QR corner, no scrollbars); Presenter (current + next, response ticker, one giant Advance); Phone (one question per viewport, 56px targets, full question text on device, aria-live announcements, CVD-safe Okabe-Ito palette, `prefers-reduced-motion`, no autoplay audio).
9. Safety: profanity filter default-on all free text; anonymity badge; ~250-char open-text cap; per-client submission throttle.
10. Rehearsal mode with ~20 simulated participants.
11. Ops tonight: k6 at 1,000 VUs through Vercel (join burst + 10-second answer burst); kill-network-mid-quiz phone test; presenter-refresh test; shared-NAT test; verify/raise Supabase realtime connection quota; deployment freeze; pre-warm plan; printed runbook; standby Mentimeter/Wooclap deck.

**P1 — build tonight if P0 is stable**
1. PDF/PPTX → rasterized image import with honest upload warning; first-class markdown import.
2. Exports: results CSV/xlsx (aggregate default, per-participant toggle), results summary page; "export before closing?" purge prompt.
3. Extra skins on the primitives: rating/scale, ranking, open-ended wall.
4. Shareable no-account moderator link; Q&A moderation queue.
5. AI deck/quiz generation — one "draft this for me" entry point, fully skippable, zero-retention API config, never sends participant text without explicit presenter action.
6. Editor undo + autosave; leaderboard reveal as the one earned animation; two pre-validated themes (dark stage, light room).
7. Locally-served MP4 on stage output only; next-slide prefetch; self-hosted fonts.

**P2 — designed-in now, built post-event**
1. .pptx deck export, branded PDF report, JSON export, post-event recap link per participant.
2. Documented API + MCP server; per-participant longitudinal analytics (opt-in, retention-governed).
3. Confidence-weighted scoring, extended-time flags, "I'm confused" signal, participation-equity view.
4. LMS/LTI, SSO, SMS fallback, branding/white-label, multi-workspace.

## The One Thing to Build First

**The join-and-advance loop**: QR scan → participant row minted → presenter presses Advance → `slide_changed` broadcast → 300 phones follow — with the write path already routed through transaction-mode pooling and the reconnect-resync path working. This is 50% of the total risk, it exercises the exact two burst moments that can kill the event, and every activity type is a payload on top of it. Build it first, load-test it at 1,000 tonight, and freeze.