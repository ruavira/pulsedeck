# PulseDeck — Blueprint & Design Brief
### An all-in-one interactive presentation super-system
**Prepared:** July 10, 2026 · **Author:** Claude (Cowork) for Ayodeji · **Status:** Approved for overnight build → live event July 11, 2026

---

## Executive Summary

Four platforms dominate live audience interaction — Mentimeter, Kahoot!, AhaSlides, and Wooclap — and each is excellent at one thing and structurally weak at the rest. Mentimeter has polish and serious realtime infrastructure but hostile pricing mechanics (mid-event participant lockouts, expiring join codes, static-image imports below Pro, no deck export). Kahoot! owns quiz energy but ships a fairness bug as a feature (speed scoring that punishes slow venue Wi-Fi and disabled users identically), defaults to a childish register, and holds content hostage across a bewildering SKU ladder. AhaSlides wins on price and permanent join codes but users report connection drops at ~40 participants — disqualifying for real events. Wooclap has the deepest pedagogy and the field's only graceful-degradation story (SMS fallback) but chains the presenter to the lectern and degrades before its 1,000-participant cap.

This document specifies **PulseDeck**: a platform that keeps each incumbent's strength, deletes its structural weakness, and adds what none of them ship — a rehearsal mode, honest limits that never trip mid-session, accuracy-first scoring, a refresh-proof presenter, and AI that helps at authoring time but is never in the live path.

The design was produced by a two-stage multi-agent process: (1) a five-agent deep-research sweep across the four platforms and cross-platform user sentiment, and (2) a thirteen-member expert council — eight domain experts (keynote presenter, university educator, corporate trainer, UX designer, realtime systems architect, accessibility specialist, AV/event producer, privacy officer) plus five thinking-lens advisors (Contrarian, First Principles, Expansionist, Outsider, Executor) — whose anonymized responses were peer-reviewed and synthesized by a chairman into the verdict embedded in Part III.

The system is being built end-to-end by an autonomous multi-agent production pipeline (Part VII) on the most stable stack available to it — Next.js 16 on Vercel with Supabase Postgres + Realtime — and will not be considered done until it survives a 1,000-virtual-user stress test simulating the two burst moments that kill live events: the QR-scan join stampede and the synchronized quiz answer burst (Part VIII).

**The product in one sentence:** presenter shows a prompt → N phones submit → the server aggregates → the big screen renders, fast enough to feel alive — and nothing the audience or the network does can break it.

---

# Part I — Market Research

Five research agents produced current (July 2026) deep-dives on each platform plus a cross-platform sentiment sweep covering G2/Capterra/TrustRadius ratings, Reddit and educator-community sentiment, switching triggers, and the gaps users say all four share. Full reports are archived in `docs/research/`. The synthesis:

**Mentimeter** is the category's polish benchmark and the only incumbent that treats realtime as a hard engineering problem — it runs on Ably after its previous provider collapsed at ~35,000 concurrent connections. Its weaknesses are commercial mechanics that transfer risk onto the presenter: a 50-participant monthly free cap that locks out mid-event, join codes that expire roughly two days after use, imports rasterized to static images below Pro, Q&A moderation paywalled, annual-only billing, and no PowerPoint deck export at any tier.

**Kahoot!** owns the gamified quiz. Its leaderboard reveal is the genre's one earned emotional moment, and its two-step join flow exists because open PINs get flooded by bots — a lesson worth inheriting. Its structural faults: speed-based scoring converts network jitter into unfairness (their 2025 "Accuracy mode" is an admission), the audience register defaults to playful in professional rooms, nearly every professional feature sits behind one of a dozen overlapping SKUs, and created content is effectively held hostage to the subscription.

**AhaSlides** is the value player: permanent join codes, generous limits, one-off pricing, and it even shipped an MCP server before the giants. But the community reports connection instability at modest audience sizes (~40), no undo in the editor, no preview mode, and Safari inconsistencies — reliability is the entire product in this category, and it is the one thing AhaSlides has not secured.

**Wooclap** is the educator's platform: 20+ question types, sound pedagogy ("I'm confused" signal, competency thinking), EU privacy posture, and the field's only real degradation story (SMS voting fallback). Its costs: a dense editor, a presenter chained to the lectern, word clouds that visibly lag near its 1,000-participant cap, and a free tier that fell from 1,000 participants to two events per month.

**What users say is missing from all four:** honest, predictable limits; a rehearsal mode; presenter recoverability (refresh = resume); deck export / no lock-in; accuracy-fair scoring; a professional register by default; and pricing that doesn't punish occasional use.


---

# Part II — Feature Comparison Matrix

# Feature Comparison: Mentimeter vs Kahoot! vs AhaSlides vs Wooclap (July 2026)

| Dimension | Mentimeter | Kahoot! | AhaSlides | Wooclap |
|---|---|---|---|---|
| Activity/question types | ~13 interactive (MC, word cloud, open, scales, ranking, 2x2 grid, pin-on-image, 100 points, quiz, Quick Form) | Quiz-first: MCQ, T/F free; type answer, puzzle, slider, pin, poll, word cloud, open, brainstorm, NPS all paid | Wide: polls, word cloud, ranking, idea board, pin, spinner wheel; 5 quiz formats incl. match pairs, categorise | Widest (20+): incl. fill-in-blanks, matching, drag-drop, label-image, video/audio Qs, LaTeX math, SCT |
| Slide presenting | Content slides; polished themes; Mentimote remote | Static slides (paid) interleaved; hosting modes (Classic/Accuracy/Confidence) | Content slides, templates, phone remote, presenter notes | Slides interleaved with questions; presenter view; UI overhauled Sept 2025 |
| Quiz/gamification | Quiz Competition w/ leaderboard, music; 2,000-player quiz cap | Category-defining: points, music, characters, team modes | Leaderboards, Team Play, self-paced/homework mode | Competition mode, team mode, Spin the Wheel; lighter energy |
| Q&A + moderation | Q&A w/ upvoting; moderation Pro+; profanity filter | Q&A (2025) w/ upvoting; moderated queues on top tiers only | Live Q&A; moderation queue paid; profanity filter | Message Wall w/ upvoting; moderator interface Pro+ |
| AI features | Menti AI all tiers: deck gen from prompt/PDF, quiz gen, response grouping, insights | Quiz gen from topic/PDF/URL, 70 languages, US standards-aligned; needs heavy editing | AI deck maker, quiz from PDF/PPT, MCP server (unique); quota-gated | Question Builder (7 types) from docs/audio/video, Pro+; no deck gen |
| PPT/PDF/Slides import | .pptx/.key/.pdf as static images (Basic+); live embed Pro+ | .pptx/.key/.pdf static (80MB); Slide Sync keeps decks updated | PPT/PDF static; Google Slides add-on | PPT/PDF/Keynote static; Slides via link; add-ins keep animations |
| Results export | Excel (Basic+), PDF; none free | .xlsx reports, Google Drive; story reports on Plus+ | Excel/CSV (Essential+), pivot-ready v4 | Excel/PDF/CSV (Basic+); none free |
| Deck export | PDF only; no .pptx | None (content locked in) | PDF/JPG | None documented |
| QR/join flow | menti.com + 8-digit code, QR, link; no app | kahoot.it + PIN, QR, 2-step anti-bot join | ahaslides.com/CODE, permanent QR, custom codes (Pro) | Code, QR, link; SMS answering (Pro+) |
| Free plan limits | 50 participants/month, 30-day lockout; no export/import | 10 players (40 K-12); MCQ + T/F only | 50 participants; 5 quiz + 3 poll Qs/deck; unlimited events | 5 active questions per 30 days; 1,000 participants; no export |
| Paid pricing | $14–28/presenter/mo, annual only; conference $350–750 | Bronze $36/yr → 360 Ultra $948/yr; fragmented SKUs; events $199–799 | $7.95–15.95/mo (monthly OK); Edu from $2.95 | ~$8–15/presenter/mo; Campus/Corporate custom |
| Participant caps | Unlimited paid; quiz 2,000; 10k+ needs notice | 50→5,000 by tier; 5,000 hard cap | 100 → 2,500 (Pro); 100k Enterprise | 1,000 hard cap all standard plans |
| Integrations | PPT, Teams, Zoom, Webex, Canva, Miro; LMS LTI (Mar 2026) | PPT, Teams, Zoom; LTI 1.3 (Canvas, Moodle, etc.) | PPT, Google Slides, Zoom, Teams, Webex; no LMS | PPT, Slides, Teams, Zoom; LTI 1.3 w/ grade sync |
| API | Limited/partner-oriented; no Zapier | None public | None; MCP server instead | None public (LTI only) |
| UX praise | Ease of use, polish, anonymity, word clouds (G2 4.7) | Live energy, near-zero learning curve, content library (G2 4.6) | Ease of use, price, generous free tier, support (G2 4.7) | Question variety, beginner-friendly, support (G2 4.4) |
| UX complaints | Stingy free tier, annual-only billing, static imports, flaky PPT add-in | Aggressive paywalling, cost creep, cluttered UI, gimmicky for adults | Design ceiling, no undo, Safari issues, free question caps | Dense navigation, no presenter mobile app, mid-session freezes |
| Reliability at scale | Ably-backed; 70k+ concurrent; quiz weak point | Status page; bot attacks mitigated; Wi-Fi-sensitive scoring | Marketed 100k; drops needing reload reported; auto-reconnect UI | Lags near 1,000 cap; word clouds degrade |
| Offline support | None | None | None | None (SMS fallback partially mitigates) |
| Accessibility | Open Dyslexic font; multi-language | Character toggle; 70-language AI gen | 30+ audience languages | Anonymous mode; "I'm confused" button; — on specifics |
| Best-fit use case | Corporate presentations, sentiment capture | K-12/team quiz competitions, energizers | Budget-conscious educators/SMBs; live+async | Higher-ed lectures, LMS-graded teaching |
| Biggest weakness | Price + annual-only billing; free-tier lockout | Free tier gutted; non-quiz types paywalled; no API/export | No API/LMS; design ceiling; cap ambiguity | 1,000-participant hard cap; tightened free tier |

## Strengths summary

**Mentimeter** is the polish leader: best-in-class ease of use, professional visual design, robust Ably-backed infrastructure scaling past 70,000 concurrent users, AI bundled at every tier since Feb 2026, and newly shipped LMS LTI support closing its education gap.

**Kahoot!** owns gamified energy — music, leaderboards, characters, and a massive community quiz library make it the fastest path to an engaged room, with strong EDU standards alignment, LTI 1.3, multilingual AI generation, and one-time event pricing for occasional hosts.

**AhaSlides** is the value play: the most generous free tier (50 participants, unlimited events), monthly billing, Edu plans from $2.95, the widest quiz-format variety in its price class, self-paced mode, and a unique MCP server for AI-agent access.

**Wooclap** has the deepest pedagogy: 20+ question types including fill-in-blanks, LaTeX math, and Script Concordance Tests, LTI 1.3 with grade sync, SMS answering as a low-connectivity fallback, EU/GDPR posture, and fresh funding ($29M, 2025) fueling AI and North America expansion.

## Trade-offs summary

**Mentimeter** monetizes hard: annual-only per-presenter pricing, a 50-participant/month free cap with lockout, static-image imports below Pro, a 2,000-player quiz ceiling, weak API/automation, and Trustpilot-visible billing friction.

**Kahoot!** paywalls nearly everything beyond basic MCQ, cut its free tier to 10 players, sells through a confusing SKU maze, offers no public API or deck export, caps at 5,000 players, and reads as gimmicky to adult audiences.

**AhaSlides** hits a design ceiling quickly — limited customization, no undo, browser inconsistencies — and lacks the API, Zapier, and LMS hooks serious institutions need, with ambiguity around its Pro participant cap (2,500 vs 10,000).

**Wooclap** is capped at 1,000 real-time participants on every standard plan, has no public API or presenter mobile app, imports slides as static images, tightened its free tier to 5 active questions per month, and its per-presenter licensing gets expensive across departments.
---

## The Council Verdict (verbatim, binding)

The thirteen-member council's anonymized peer review round singled out the realtime-architect and executor responses as the strongest, and surfaced four blind spots no individual member caught (serverless connection exhaustion, venue-NAT rate limiting, load-testing through the full stack, and operational readiness as a discipline). The chairman's synthesis follows in full — it is the binding specification for the build.

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
---

# Part III — Product Blueprint

## Vision

PulseDeck is the presentation system where the audience is part of the deck. One artifact — a deck of slides — carries content, media, and interaction as equal citizens. One QR code, printed on every slide, gets a phone into the room in under ten seconds with no app and no account. One screen — the stage — renders slides and living results with theatrical clarity. The presenter can run the entire show from a phone in their pocket, and no failure of laptop, browser, or venue Wi-Fi can kill the session, because every scrap of state lives server-side and every client knows how to heal.

## Naming & brand

**PulseDeck** — "deck" anchors it in the presentation world; "pulse" is the live heartbeat of the room. Tagline: *Presentations with a pulse.* The visual identity is dark-stage-first: deep ink backgrounds engineered for projectors, an electric violet accent, cyan live-status signals, and a chart palette derived from the color-blind-safe Okabe–Ito set.

## Personas & primary jobs

1. **The keynote presenter (Ayodeji, tomorrow):** one person operating a 50–300 seat room alone. Needs: zero-friction join, a stage view that never embarrasses, a phone remote, panic controls, and total recoverability.
2. **The educator:** weekly sessions, 30–300 students, wants question variety, participation equity, accuracy-fair scoring, per-student export for credit — without per-seat pricing traps.
3. **The corporate trainer:** needs branding, moderation, results exports for reports, and a professional register for enterprise rooms.
4. **The audience member:** has one hand free, three seconds of patience, possibly one bar of LTE, possibly a screen reader. Everything they touch must be thumb-sized, legible, and instant.

## The One Loop (first-principles core)

Every feature is a payload on a single loop: **prompt → submit → aggregate → render**. The loop's physics: state fan-out (1→N slide sync), ingest (N→1 idempotent votes), aggregation (server-side tally), and render (throttled count broadcasts). The loop is hardened once, then every activity type — poll, word cloud, quiz, Q&A, scale, ranking, open text — is a skin over four interaction primitives: *choose-from-set, free-text, place-a-value, order-a-set*.

## Feature specification

### P0 — must work on stage (all built and stress-tested before handoff)
- **Join ritual:** permanent 6-character join code (unambiguous alphabet — no 0/O/1/I), QR + short URL persistently on every stage slide, join page light and edge-served, join <10s, survives a 300-scan burst. Room-lock toggle; locked rooms still re-admit known devices.
- **Slides:** content slides (heading/text/bullets/quote/big-stat/image/video blocks, five layouts), full-bleed image slides (PDF import target), and all seven interactive kinds.
- **Live polls** (single/multi choice) with horizontal-bar results animating on the stage; **word clouds** (top 60 terms, profanity-filtered server-side, per-participant word caps); **quizzes** with server-deadline timing, accuracy-first scoring (optional capped 20% speed bonus), streaks, and a top-10 leaderboard reveal as the show's one earned animation; **Q&A** with upvoting, optional moderation queue, answered/archive states, ambient submission from any slide; **scales** with live average; **ranking**; **open-text wall**.
- **Phase machine per activity:** show → open → closed → reveal, controlled from stage keys or phone remote; voting-closed states are explicit on every surface.
- **Scoring integrity:** all scoring server-side from server timestamps; votes are idempotent upserts keyed `(slide_id, participant_id)`; devices that reconnect keep identity, score, and votes via a localStorage UUID.
- **Presenter surfaces:** Stage (projector: ≥40px type, dark high-contrast theme, persistent QR corner, participant counter, connection badge, B-key blackout, arrow/space/click navigation); Remote (phone: giant advance button, phase controls, Q&A moderation, participant count, panic bar — close voting / hide entry / skip / blank); refresh-proof resume everywhere.
- **Audience surface:** one question per viewport, ≥44px touch targets, question text mirrored on the device (never "look at the screen to know what A means"), instant vote acknowledgment, "voting closed" and "reconnecting…" states, anonymity badge, aria-live announcements, reduced-motion respect, no autoplay audio.
- **Safety:** multi-language profanity blocklist on by default across nicknames, word clouds, open text, and Q&A; per-session banned-words kill switch; 250-char open-text cap; per-device submission throttles; RPC-only database surface (no client SELECT on raw rows; deny-by-default RLS).
- **Resilience:** one broadcast channel per session carrying tiny state events; the stage is the single aggregator (500ms polls while voting, rebroadcasting throttled counts); audience never polls aggregates; jittered reconnect with REST resync; background-tab wake resync; 15s heartbeat resync.
- **Rehearsal mode:** simulate a configurable phantom audience (default 20) that joins, votes plausibly, and asks questions — so the presenter can run the full show solo the night before. None of the four incumbents has this.

### P1 — built tonight after P0 verification
- **Import:** PowerPoint (.pptx) → editable native slides (text + images extracted) with an honest "animations don't survive import" notice; PDF → pixel-perfect full-bleed image slides rendered client-side; Markdown/outline → native slides instantly.
- **Export:** results workbook (.xlsx: leaderboard, every response, Q&A log) and CSV; print-optimized session report page (→ PDF via browser); deck export to .pptx with result snapshots.
- **AI studio (Anthropic, optional by construction):** topic → full interactive deck; outline/markdown → deck; source text → quiz set; post-session Q&A theme summarization. Every AI feature has a non-AI path, and the live path never calls AI.
- **Editor:** drag-reorder slide rail, per-kind config panels, live preview, autosave, themes.

### P2 — designed into the schema now, built post-event
Deck template gallery and sharing; co-presenter roles; per-participant longitudinal analytics (opt-in); recap links for attendees; public API + MCP server; LMS/LTI, SSO; SMS fallback; white-label branding; confidence-weighted scoring and participation-equity views.

---

# Part IV — Design Brief

## Three deliberately distinct surfaces

**Stage** is theater: ink background (#0B0E14), type that starts at 40px and scales with `clamp()`, one idea per screen, results as horizontal bars (labels never color-only), the join ritual (QR + code + URL) docked persistently in a corner, and motion used once per moment (bars growing, leaderboard reveal) at 150–250ms ease-out. Nothing scrolls on stage, ever.

**Remote** is a cockpit: current + next slide, a response ticker, one giant thumb-reachable Advance button, phase controls, and the panic bar. Everything reachable one-handed on a phone held at hip height in the dark.

**Phone (audience)** is a form: one prompt, big targets, instant feedback, zero chrome. The audience member never sees the product; they see their question.

## Design system

Tokens: ink `#0B0E14`, panel `#131826`, edge `#232B3D`, text `#F2F5FA`/`#8B94A7`, accent violet `#7C5CFF`, live cyan `#22D3EE`. Categorical chart palette (Okabe–Ito-derived, CVD-safe, always paired with text labels): violet, cyan, amber, emerald, rose, slate, red, lime. Radii 12px/999px. System font stack via Geist. Focus rings visible (cyan, 2px). WCAG 2.2 AA minimum: ≥4.5:1 text contrast everywhere, ≥7:1 on stage; 44px+ touch targets; `prefers-reduced-motion` collapses all animation; screen-reader announcements for phase changes; quiz equity — accuracy scoring plus generous server-side grace windows.

## The moments that must feel great

1. **The join wave** — the participant counter ticking up on stage as the room scans; social proof that this will be *that kind* of talk.
2. **First vote landing** — sub-second acknowledgment on the phone, bars breathing on the stage.
3. **The leaderboard reveal** — the one theatrical animation in the product, held back until it's earned.
4. **The save** — presenter's laptop dies; they open any browser, paste nothing, and the show resumes where it stood.

---

# Part V — Technical Architecture

## Stack (strongest / most stable / most efficient at each layer)

| Layer | Choice | Why it won |
|---|---|---|
| Framework | Next.js 16 (App Router, TS) | Server routes + static optimization in one artifact; Vercel-native |
| Hosting | Vercel | Edge network for the join burst; zero-ops; instant rollback |
| Data + realtime | Supabase (Postgres 17 + Realtime broadcast + Storage) | One system for state, votes, fan-out, and media; SQL RPCs give server-authoritative logic without extra services |
| Write path | PostgREST RPCs (SECURITY DEFINER) | Bypasses Vercel function cold starts and connection exhaustion — the council's #1 blind-spot finding; pooled by Supabase's infrastructure |
| AI | Anthropic API (server routes only) | Authoring-time only; hard-isolated from the live path |
| Exports | exceljs / pptxgenjs / print CSS | Mature, dependency-light, no headless browsers |
| Load testing | k6 | Industry standard; scriptable burst scenarios |

## Realtime topology (the council-hardened loop)

One broadcast channel per session (`session:{id}`). Presenter mutations flow through authenticated server routes → Postgres → a tiny `state` broadcast. Audience votes flow as idempotent HTTPS RPC calls straight into Postgres — never over the socket. The **stage view is the single aggregator**: it polls aggregate RPCs at 500ms while voting is open (one query per second per *session*, regardless of audience size) and rebroadcasts throttled compact counts. Every client heals: jittered reconnect → REST state resync; visibility-change resync for locked phones; 15–20s heartbeat resync as the final net. Rate limiting and dedup key on session/device tokens, never IP — 300 phones share one venue NAT egress.

## Data model

`decks` (theme, presenter secret) → `slides` (kind, body JSONB, settings JSONB, position) → `sessions` (join code, status, current index, phase machine, **deck_snapshot** frozen at go-live so mid-talk edits can't corrupt a running show) → `participants` (session-scoped, device-key idempotent, score/streak) → `responses` (UNIQUE(slide, participant) upsert; server-computed correctness/points/latency) + `qa_questions`/`qa_upvotes` + `banned_words`. All tables RLS-locked with zero anon policies; the entire anonymous surface is ten SECURITY DEFINER RPCs that validate session state, sanitize text, and enforce rate limits server-side.

## Security & privacy posture

Anonymous-by-default participation (visible badge); no accounts, no emails, no tracking pixels on audience devices; presenter authentication via per-deck secrets over TLS with server-side verification; service-role key confined to server routes; AI calls carry only presenter-authored content unless explicitly invoked on Q&A text; aggregate-first exports with per-participant data behind an explicit toggle; data deletable per session (PIPEDA/GDPR-friendly; Canadian region hosting).


---

# Part VI — Import, Export & AI Subsystem

**Import** has three honest paths. Markdown/outline is the native path — headings become slides, lists become bullets, interaction markers become activities, and it round-trips losslessly. PDF is the fidelity path — pages render client-side (pdf.js) into full-bleed slide backgrounds that look exactly like the source. PowerPoint is the editability path — slide text and embedded images are extracted server-side (JSZip + XML parse) into native, editable slides, with an explicit notice that animations and transitions do not survive any importer in this category (all four incumbents rasterize silently; we say so).

**Export** treats your data as yours: a results workbook (leaderboard sheet, per-response sheet with resolved option labels, Q&A log), CSV for pipelines, a print-optimized report page for PDF, and deck export to .pptx so content is never hostage — the switching trigger every incumbent ignores.

**AI** (Anthropic, server-side only) does four jobs: topic → full interactive deck; outline → deck; source text → quiz set; Q&A → themed summary. Three design laws: AI is never in the live path; every AI feature has a manual equivalent; AI failure degrades to a friendly "AI is off" state, never an error that blocks work.

---

# Part VII — The Multi-Agent Production System

The platform is built end-to-end by an orchestrated agent pipeline, with deterministic control flow and verification gates:

1. **Research fleet (5 agents)** — per-platform deep dives + cross-platform sentiment → structured findings (complete).
2. **Expert council (13 agents + 5 peer reviewers + chairman)** — domain critiques, anonymized peer review per LLM-Council methodology, synthesized verdict and prioritized requirements (complete; verdict in Part III).
3. **Architecture core (orchestrator-authored)** — the contract layer no agent may deviate from: database schema + RPCs, realtime hooks, shared types, design tokens, API route contracts (`ARCHITECTURE.md`).
4. **Build fleet (parallel feature agents)** — each owns a disjoint module against the frozen contract: landing/join, audience app, stage view, phone remote, studio editor, AI panel, import pipeline, export pipeline, report page, demo deck seeder. No agent edits shared contracts; every agent must leave `tsc`/`next build` green.
5. **Integration & review gate** — orchestrator integrates, typechecks, builds, then adversarial review agents hunt defects on the highest-risk paths (scoring integrity, reconnect storms, RLS surface).
6. **Deployment** — Supabase migrations applied and verified; Vercel production deploy; environment bake-in verified.
7. **Stress fleet** — k6 load scenarios (Part VIII) plus functional E2E verification against production; findings loop back to fix agents until green.
8. **Delivery** — demo deck seeded, QR generated, runbook written, docs archived to the Presentation Guru project.

---

# Part VIII — Stress & Pressure Test Plan

Target: the event is ~50–300 participants; the system is certified at **1,000 concurrent virtual users** (3–5× headroom), tested through the production stack (Vercel edge + Supabase), never against staging shortcuts.

**Scenario A — QR-scan stampede:** 1,000 VUs join within 60 seconds (peak 50 joins/s). Pass: p95 join round-trip < 2s, zero failed joins, participant counter accurate within 2s.
**Scenario B — Quiz answer burst:** 1,000 joined VUs submit within a 10-second window after `open`. Pass: 100% of submissions land (idempotent, once), p95 submit < 1.5s, aggregates correct to the vote, leaderboard consistent with hand-computed scores.
**Scenario C — Word-cloud flood:** 800 VUs submit 3 words each in 30s including profanity payloads. Pass: filter catches 100% of blocklist, top-60 aggregation stays < 500ms per poll tick.
**Scenario D — Reconnection storm:** kill and restore connectivity for 500 VUs simultaneously mid-quiz. Pass: all identities and scores survive; resync completes without a broadcast stampede.
**Scenario E — Presenter death drill:** kill the stage tab and remote mid-activity; resume from a cold browser. Pass: full state recovery < 5s, no audience disruption.
**Scenario F — Functional E2E:** scripted browser run of the full show — create, import, go live, join, vote each activity kind, quiz with scoring assertions, Q&A moderate, export, end. Pass: zero defects on the P0 path.

Exit criteria: all six scenarios green on production, then **deployment freeze** — no code changes after certification, only content.

---

# Part IX — Show-Day Runbook (July 11)

**Before doors:** open the stage URL and remote URL (bookmarked); run rehearsal mode once end-to-end; confirm participant counter at 0 and connection badge green; pre-warm by joining from your own phone; keep the printed QR one-pager as backup.
**The failure scripts:** phone won't join → "type the six-letter code at the URL on screen" (works on any browser, no app). Stage dies → reopen the bookmark; state resumes. Venue Wi-Fi dies → audience is on their own LTE already; you present from the remote on your data. Someone posts filth → it never reached the screen (filter), or one tap hides it (panic bar).
**After:** end session (prompts export), download the results workbook, AI-summarize the Q&A for your follow-up email.

## Post-event roadmap
Week 1: P2 exports (.pptx deck export shipped), template gallery, recap links. Month 1: accounts/workspaces, co-presenters, API + MCP server. Quarter: LMS/SSO/enterprise, longitudinal analytics, SMS fallback.

---

# Appendices

- **A. Full research reports** — `docs/research/research-{mentimeter,kahoot,ahaslides,wooclap,cross-platform}.md`
- **B. Council transcripts** — `docs/research/council-*.md` (13 members), `docs/research/review-*.md` (5 peer reviews)
- **C. Architecture contract** — `ARCHITECTURE.md`
- **D. Database schema & RPCs** — `supabase/migrations/*.sql`

*This blueprint was produced by a 25-agent research-and-council pipeline and governs the autonomous build. Where options existed, the most effective, strongest, most stable, most efficient option was chosen — and where the council disagreed, the chairman's resolution above is binding.*
