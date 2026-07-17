## 1. Sharpest critiques — the upside all four are blind to

All four sell a *session*. The session ends, the data dies in an Excel export nobody opens. Mentimeter runs 70k concurrent connections and turns it into... a PDF screenshot. Kahoot has 10+ years of answer data and no per-learner longitudinal model. Wooclap has the pedagogical depth (SCT, LaTeX) and buries it behind a 1,000-participant cap and no API. AhaSlides shipped an MCP server — the only one who noticed agents exist — and did nothing with it. None of them treat the *event as a data asset* or the *deck as a reusable artifact*. All four hold content hostage (no deck export, no SCORM, no API) — they think lock-in is a moat; it's actually their churn engine, proven by the vicious "alternatives-to-X" SEO war.

## 2. What the super-system MUST do (the wedge)

- **Own the artifact, not the session.** Export everything: .pptx deck out, markdown out, results as JSON/CSV, a shareable post-event recap page (auto-generated URL with charts, top Q&A, quiz winners). "Your data walks out the door with you" is a positioning weapon against all four — and costs one afternoon to build on this stack.
- **The post-event recap is the viral loop.** 300 attendees each get a link: their quiz rank, their answers vs. the room. That's 300 marketing impressions per event and the seed of per-participant longitudinal analytics — the most-cited market gap (Kvistly's entire pitch).
- **API-first by accident.** You're building on Supabase — the REST/realtime API already exists. Document it. Add an MCP server (a day's work with Anthropic in the stack). Nobody among the four has a public API; you'd have one at launch. Agents building decks and reading results is the 2027 distribution channel.
- **Markdown import as the developer/AI wedge.** All four import PPT as dead static images. Markdown → live deck means any LLM anywhere can author for your platform. Cheapest moat available.
- **Session-persistent participant identity** (anonymous UUID cookie, optional name/email claim) — enables streaks, cross-event leaderboards, async follow-up quizzes later without building them now.

## 3. Trade-offs I'd accept

- Skip PPT *embedding* add-ins entirely (flaky everywhere, months of work); import-to-image + markdown-native is enough.
- Skip LMS/LTI, SSO, SMS fallback, offline mode for tomorrow — schema-permitting, not built.
- Accept a worse animation story than PowerPoint in exchange for web-native decks that are queryable, exportable, and agent-writable.
- Accept single-tenant simplicity now; the recap-link loop and open API matter more than multi-workspace polish.

Build tomorrow's event; architect the recap link, the JSON export, and the MCP endpoint into the schema tonight. That's the platform the incumbents structurally can't copy — their business model is the export button not existing.