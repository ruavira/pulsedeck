# PulseDeck

An all-in-one interactive presentation platform. A presenter builds a deck of
slides (content + interactive activities), goes live, and the audience joins
from their phones via a QR code or 6-character code. The big screen shows the
slides and live results; phones drive the interaction.

- **Kahoot-style quizzes** — server-side timed scoring, leaderboards, live ranks
- **Mentimeter-style polls & word clouds** — animated horizontal-bar results
- **Slido-style Q&A** — audience submits questions, upvotes, presenter moderates
- **Reactions, scales, open text, breathing/timer slides**
- **Optional AI generation** (Anthropic) — every feature works without it
- **Exports** — xlsx/csv results, print-to-PDF report, PPTX import
- **Accounts & billing** (Supabase Auth + Stripe), PWA, LMS bridge (Moodle)

## Stack

- **Next.js 16** (App Router, `src/`, TypeScript, Tailwind CSS v4) — deployed on Netlify/Vercel
- **Supabase** — Postgres + RPCs (all anonymous audience access), Realtime
  broadcast, and Storage (`media` bucket)
- No auth provider for the live-session path: presenter routes are protected by a
  per-deck `presenter_secret` (sent as `x-presenter-key` to `/api/presenter/*`);
  audience is anonymous (`device_key` + participant UUID). Signed-in accounts
  (Supabase Auth) layer on top for deck ownership, billing, and analytics.

## Getting started

```bash
npm install
npm run dev   # http://localhost:3000
```

Environment variables (see your Supabase/Stripe/Anthropic dashboards):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client Supabase access |
| `SUPABASE_SERVICE_ROLE_KEY` | Server routes (service role) |
| `SUPABASE_SERVER_SECRET` | Gates `is_server()` in RLS/RPCs |
| `ANTHROPIC_API_KEY` | Optional — AI deck/quiz generation (degrades gracefully if unset) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing |

## Key routes

| Route | Purpose |
| --- | --- |
| `/` | Landing: join-by-code, create/open studio |
| `/studio` · `/studio/[deckId]` | Deck list · deck editor |
| `/present/[sessionId]` | Stage view (projector): slides, live charts, QR, leaderboard, Q&A |
| `/remote/[sessionId]` | Presenter phone remote |
| `/j/[code]` · `/j` | Audience app |
| `/report/[sessionId]` | Post-session report + exports |

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — **the contract.** Data shapes, realtime
  topology, RPC/route map, and the design system. Read this before writing code.
- [`AGENTS.md`](./AGENTS.md) — notes for AI coding agents working in this repo.
- [`supabase/README.md`](./supabase/README.md) — migration ledger and database
  source-control conventions.

## Database

The Supabase schema lives in `supabase/migrations/` as timestamped SQL. The
production project is the source of truth for applied versions — see the ledger
in [`supabase/README.md`](./supabase/README.md). Public-schema tables are
protected with RLS; all anonymous audience access goes through a fixed set of
`SECURITY DEFINER` RPCs rather than direct table access.
