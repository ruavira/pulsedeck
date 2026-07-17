EXECUTOR VERDICT

(1) Sharpest critiques through the shipping lens:
- Mentimeter: proof that realtime is the whole product — they died at 35k concurrent on a weaker provider and rebuilt on Ably. Lesson: your transport layer IS the risk. Also proof that quiz scoring is the hardest realtime feature (their only hard cap, 2,000, is on quizzes).
- Kahoot!: speed-based scoring punishes slow venue Wi-Fi and invites bot-flooding ("smashers"). Both are self-inflicted complexity. Their 2-step join exists because they shipped an attack surface.
- AhaSlides: reconnect UI added only after drop complaints; no undo; Safari bugs. Cheap builds die at the edges — reconnection and browser matrix are not polish, they're core.
- Wooclap: 1,000-participant ceiling with degradation "near" it — never trust a stated cap; the real cap is lower. Word-cloud rendering is their scale bottleneck: unbounded-cardinality aggregation on the presenter screen.

(2) MUST DO tonight, in build order:
1. Join flow + session state machine (QR → short code → anonymous participant row, presenter advances slides via Supabase broadcast). This is 50% of the risk; build and test first.
2. Poll + word cloud + open-ended on ONE aggregation pattern: participants INSERT answers; a Postgres function or presenter-side debounced query aggregates; broadcast counts, never raw rows, to audience. Cap word cloud display at top 50 terms.
3. Quiz with SERVER timestamps (submitted_at from Postgres, not client clock) and correctness-first scoring — copy Kahoot's Accuracy mode, not Classic. Leaderboard computed in SQL, top 10 only.
4. Q&A + upvote (trivial once 2 works). Presenter-side moderation toggle, default off.
5. Static slide rendering: PDF/PPTX → images at import (Mentimeter/Wooclap both do this; it's fine). Markdown slides native.
6. CSV export + results summary page.
MUST AVOID: AI in the live path (generation is authoring-time only, behind a button, fully skippable); per-participant Supabase realtime channels (one channel per session, presenter fans out); video embeds in audience view; animations import; accounts for participants; speed scoring; anything Enterprise (SSO, teams, branding).

Stress-testing hours: (a) 1,000 simulated clients via k6/artillery hitting join + answer-burst within a 10-second window — that's the real event shape; (b) kill/restore network mid-quiz on a phone, verify auto-reconnect and state resync from DB (not from missed broadcasts — state must be pull-on-reconnect); (c) presenter refresh mid-session must restore exactly.

(3) Trade-offs accepted: static slides (no animations), top-50 word cloud, accuracy-only scoring, no async mode, no LMS, image-based export. Ugly-but-alive beats elegant-and-down. Answers land in Postgres = nothing is ever lost even if broadcast hiccups; that's the one guarantee worth everything.