# PulseDeck User Guide

**PulseDeck** — Presentations with a pulse. Live polls, word clouds, quizzes, Q&A and real slides your audience joins from their phones in seconds. No app, no accounts, nothing to install.

**Your platform:** https://pulsedeck-live.netlify.app
**Install as an app:** open the site in Chrome/Edge → click the install icon in the address bar (desktop), or browser menu → *Add to Home Screen* (phone).

---

## 1. The five-minute mental model

PulseDeck has three surfaces, each designed for one person's job:

- **The Studio** (`/studio`) — where *you* build decks: slides, activities, imports, AI.
- **The Stage** (`/present/…`) — what the *projector* shows: slides, live results, the QR code.
- **The Audience app** (`/j/CODE`) — what *their phones* show: one question at a time, big buttons.

Plus a fourth for your pocket: **the Remote** (`/remote/…`) — drive the whole show from your phone.

A **deck** is what you build. A **session** is one live run of it: pressing **Present** freezes a copy of the deck, mints a 6-letter join code and QR, and opens the doors. Editing a deck never disturbs a running session. All state lives on the server — any screen can crash, refresh, or swap devices and the show resumes exactly where it was.

---

## 2. Building a deck (the Studio)

Open **https://pulsedeck-live.netlify.app/studio** → **New deck**, or start from:

- **Generate with AI** — a topic or pasted outline becomes a full interactive deck (needs nothing from the audience; you can regenerate or edit freely).
- **Import** — PowerPoint (.pptx → editable slides, up to 300MB, parsed right in your browser), PDF (pixel-perfect page images, up to 150 pages), or Markdown (headings become slides; `?poll Question | opt1 | opt2` syntax creates activities). Images you add anywhere (drops, uploads, imports) are auto-compressed to web size — hand PulseDeck a 40MB photo and it ships a fast-loading slide.
- **Templates** — the *Icebreaker warm-up pack* (7 ready slides) or the *Demo tour*.

The editor is three panes: **slide rail** (left — drag to reorder, hover for duplicate/delete), **canvas** (center — live preview; drag an image file straight onto it), and **inspector** (right — every setting for the selected slide). Autosave runs continuously ("Saved" in the top bar); ⌘Z undoes; **Preview** shows a phone mockup of what the audience will see.

### Slide types (9)

| Type | What it does | Key settings |
|---|---|---|
| **Content** | Real slides: headings, text, bullets, images, video, quotes, big stats | 5 layouts, 4 animations |
| **Poll** | Multiple choice, live bar chart on stage | Multi-select, live results on/off |
| **Word cloud** | Audience words grow on screen (profanity-filtered) | Words per person (1–5) |
| **Quiz** | Timed, scored, leaderboard — the competition | Time limit, points, optional speed bonus (max +20%) |
| **Scale** | 1–10 style rating with live average | Min/max + labels |
| **Ranking** | Audience orders options; stage shows weighted result | Options list |
| **Open text** | Free-text answers on a card wall | 250-char limit built in |
| **Q&A** | Questions + upvotes, sorted by votes | Moderation on/off |
| **Timer** | Giant break countdown on stage | Duration, label ("Back in") |
| **Breathing** | Guided breathing circle — audience phones breathe along | Rounds, inhale/hold/exhale seconds |

**Video on content slides:** paste a **YouTube, Vimeo, or Loom** link (auto-detected), a direct **.mp4/.webm** URL, or **Upload video** (≤200MB) to host the clip on your own storage. Video plays on the stage only — audience phones deliberately don't stream it.

**Q&A is ambient:** if enabled in session settings, the audience can ask questions from *any* slide via the **?** button — you don't need a Q&A slide (though one puts the wall on the big screen).

---

## 3. Presenting

### Going live
**Present** button (top right of the editor) → a session is created → open the **Stage link** on the projector machine (press **F** for fullscreen) and scan the **Remote QR** with your phone. The audience joins via the QR docked on every stage slide, or by typing the 6-letter code at your site. Codes never expire mid-session.

### The phase flow (interactive slides)
Every activity moves through: **Show** (question visible, voting closed) → **Open** (voting live) → **Closed** → **Reveal** (results/correct answer). One contextual button on the Remote walks the flow; on the stage keyboard it's **O / C / R**. Quizzes **auto-close at 0:00** — you never have to catch the timer.

### Stage keyboard
| Key | Action |
|---|---|
| → / Space / PgDn | Next slide |
| ← / PgUp | Previous slide |
| O / C / R | Open / Close / Reveal |
| L | Leaderboard overlay |
| Q | Giant QR overlay (the "everyone scan now" moment) |
| B | Blackout |
| T | Restart timer (on a timer slide) |
| F | Fullscreen |
| ? | Show shortcuts |

### The Remote (your phone)
Current + next slide, live response counter, the one contextual phase button, giant Next, a **Q&A tab** for moderating (approve / mark answered / archive), and the **panic bar**: close voting now, **lock room** (stops new joins; existing phones stay), toggle moderation, end session. Keep it in your pocket; the screen stays awake.

### Rehearsal mode
Before the real thing, open the Remote in a session and tap **Simulate 20 participants** — phantom attendees join, vote plausibly, and ask questions so you can run the entire show solo.

### Quiz scoring (worth knowing)
Scoring is **accuracy-first**: a correct answer earns full points whether it arrived in 2 seconds or 20 — slow venue wifi never decides the winner. If you *want* speed pressure, enable the per-question **speed bonus** (caps at +20%). All scoring happens server-side from server clocks; answers lock on submission; a phone that dies and rejoins keeps its identity, score, and streak.

---

## 4. After the show

**End session** from the remote/panic bar, then open the **Report** (Sessions button in the editor lists every run with links). You get: per-activity results, the leaderboard, the full Q&A log, **Download .xlsx** (three sheets: leaderboard, every response, Q&A), **CSV**, **Print/PDF**, and **Summarize Q&A with AI** — themes ready for your follow-up email. Decks export to **.pptx** anytime (Export menu) — your content is never hostage.

---

## 5. The extras

- **Themes:** the *Theme* button (landing page or Studio) switches all surfaces between **Ice & Azure** (default), **Sky Navy**, **Teal Fresh**, **Sunrise**, and **Deep Navy** (for dark venues). Per-browser — your projector laptop can run a different theme than your phone.
- **PowerPoint add-in:** embeds your *live stage* inside a PowerPoint slide (Insert → Add-ins → Developer Add-ins → PulseDeck Live; paste your stage link once). Manifest: `pulsedeck-live.netlify.app/addin/manifest.xml`.
- **Gamma workflow:** design in Gamma → export .pptx → Import in the Studio → sprinkle activities between the slides.
- **Audience niceties:** emoji avatars, vibration on vote-lock, animated score pops, and a personal recap card (rank, score, streak) when the session ends.
- **Safety:** profanity filtering is always on across nicknames, words, text, and questions; the remote can ban specific words mid-show; open text caps at 250 chars; submissions are rate-limited per device.

---

## 6. Kahoot features — what PulseDeck has (and does differently)

| Kahoot feature | In PulseDeck? | Notes |
|---|---|---|
| Timed quiz with points | ✅ | Configurable timer + base points per question |
| Live leaderboard | ✅ | Top-10 theatrical reveal + confetti for #1 |
| Answer streaks | ✅ | Tracked server-side, shown on phones + recap |
| Join by PIN/QR, no account | ✅ | 6-letter codes (clearer than 7-digit PINs), never expire mid-game |
| Nickname generator | ✅ | "Surprise me" button |
| Speed-based scoring | ⚙️ Optional | Off by default — accuracy-first (Kahoot's own "Accuracy mode", but as our default); enable per-question speed bonus if you want the race |
| Auto-advancing question timer | ✅ | Auto-closes at 0:00 |
| Answer reveal (correct/wrong) | ✅ | Stage highlights correct; phones show +points or the right answer |
| Podium / end summary | ✅ | Personal recap card per player (rank, score, streak) |
| Content slides between questions | ✅ | Full slide system, not an add-on |
| Host controls (skip, lock) | ✅ | Panic bar: close, lock room, skip, end |
| Player cap | ✅ Better | Certified at 1,000 concurrent (Kahoot free: 10 players) |
| Nickname/content filtering | ✅ | Always on, plus custom banned words |
| Lobby music & characters | ❌ | Deliberate — professional register by default |
| Puzzle / slider / type-answer / pin-on-image questions | ❌ Yet | Roadmap; MCQ is the scored type today |
| Team mode / assignments (self-paced) | ❌ Yet | Live-only for now |

**The one-line summary:** everything that makes Kahoot *competitive fun* is in — minus the childish register, the speed-scoring unfairness, and the 10-player free cap.

---

## 7. If something goes wrong (rehearsed failure scripts)

- **"It's not loading!"** → "Type the six-letter code at the site on screen." Works in any browser.
- **Projector laptop dies** → reopen the stage bookmark anywhere; the show resumes exactly.
- **Your phone dies** → the stage keyboard does everything.
- **Venue wifi dies** → audience is on their own data already; run the remote on yours.
- **Someone posts something ugly** → the filter caught it before the screen; anything borderline is one tap to hide, or ban the word from the remote.
- **Room fills with gatecrashers** → **Lock room** on the panic bar.

---

## 8. What's next (the roadmap)

**Near-term:** more question types (2×2 matrix, pin-on-image, brainstorm with AI clustering), a presenter view with speaker notes + next-slide preview, publishing the PowerPoint add-in to Microsoft AppSource so anyone can one-click install.
**Structural:** accounts and workspaces (today decks live in the browser that made them — share across devices with claim links), private realtime channels, custom domain, team collaboration.
**Expansion:** Teams/Zoom meeting apps, LMS/LTI for education, a public API + MCP server so AI agents can build and run sessions, per-participant learning analytics, SMS voting fallback.

*Built with a 25-agent research council, certified at 1,000 concurrent participants with zero failures. Enjoy the show.* 🎤
