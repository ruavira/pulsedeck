# PulseDeck — Architecture Contract

Every build agent MUST read this file plus `src/lib/types.ts` before writing code, and MUST
conform to the contracts here. Do not invent alternative data shapes, channel names, or routes.

## Product

PulseDeck: an all-in-one interactive presentation platform. Presenter builds a deck of slides
(content slides + interactive activities), goes live, audience joins on phones via QR/6-char
code, big screen shows slides + live results. Kahoot-style quiz scoring, Mentimeter-style
polls/word clouds, Slido-style Q&A with upvoting. AI (Anthropic) generation is optional —
every feature works without it.

## Stack

- Next.js 16 (App Router, `src/` dir, TypeScript, Tailwind CSS v4) — deployed on Vercel
- Supabase: Postgres + RPCs (all audience access) + Realtime broadcast + Storage (`media` bucket)
- No auth provider for v1: presenter routes are protected by `presenter_secret` (per deck),
  passed as `x-presenter-key` header to `/api/presenter/*` routes which use the service role.
  Audience is anonymous: `device_key` (random, localStorage) + participant UUID.

## Realtime topology (DO NOT DEVIATE)

- ONE channel per session: `session:{sessionId}` (see `sessionChannel()` in types.ts)
- `state` events: broadcast by presenter API routes after every state mutation. Tiny payloads.
  Audience + stage subscribe. On (re)connect, clients call `get_session_state` RPC to resync.
- Results aggregation: ONLY the stage view polls `get_results` (700ms while phase==='open',
  2500ms otherwise, +/- jitter). The stage rebroadcasts compact `results` events (throttled
  ≥1.5s) for audience views that want live results. Audience clients NEVER poll results.
- Q&A: clients fetch `get_questions` on load, on `qa` broadcast nudges, and every 8s (jitter).
- Reactions: `react` broadcast events, client rate-limited (max 1/800ms per device).
- Every subscription must handle reconnect: on `SUBSCRIBED` after a drop, resync via RPC.

### Embeds & aggregator election

- Embeds preserve the single-poller contract via Realtime **Presence** (no new
  channel — presence rides the existing `session:{id}` channel). The stage tracks
  presence `role:'stage'`; embeds track `role:'embed'` with a stable per-tab
  `clientId`. Every client computes the same winner from the same presence snapshot:
  if a `stage` is present it is the aggregator (embeds NEVER poll); otherwise the
  present embed with the lexicographically smallest `clientId` polls. Exactly one
  poller results. Election has ~750ms hysteresis; the winner's leading `get_results`
  fetch is gap-free and consumers keep last-known results, so handoff is seamless.
  Hooks: `use-aggregator-election`, `use-embed-session` (deck→live-session resolver),
  reusing `use-session-channel` (now presence-capable) + `use-results-poller`.

## Data flow rules

- Audience clients: ONLY call the granted RPCs (join_session, get_session_state,
  submit_response, submit_question, toggle_upvote, get_questions, get_results — stage only,
  get_leaderboard, get_my_rank, get_participant_count). Never touch tables.
- Presenter/deck management: ONLY via `/api/presenter/*` and `/api/decks/*` server routes
  (service role). Client sends `x-presenter-key`.
- A live session runs off `sessions.deck_snapshot` (frozen at go-live). Editing a deck never
  affects a running session.
- Quiz scoring is 100% server-side (submit_response RPC). Never trust client timing.

## Route map

| Route | Purpose |
|---|---|
| `/` | Landing: join-by-code (primary), create/open studio |
| `/studio` | Deck list (localStorage holds deck ids + presenter keys) |
| `/studio/[deckId]` | Deck editor: slide list, canvas, per-kind config panel, AI panel, import/export |
| `/present/[sessionId]` | STAGE view (projector): slides, live charts, QR overlay, leaderboard, Q&A wall |
| `/remote/[sessionId]` | Presenter phone remote: next/prev, open/close/reveal, Q&A moderation, participant count |
| `/j/[code]` | Audience app (also `/j` with manual code entry) |
| `/report/[sessionId]` | Post-session report + exports (xlsx/csv, print-to-PDF view) |
| `/embed/deck/[deckId]/[widget]` | Host-agnostic, read-only, live embed widget (iframe). `widget` ∈ auto\|poll\|quiz\|ranking\|wordcloud\|qa\|leaderboard\|join. Deck-scoped so one pasted URL works every session. Public/live data only — no deck-private data ever. `/embed/*` allows framing from any host (`frame-ancestors *`) |

## API routes (server, service role)

- `POST /api/decks` create; `GET/PUT /api/decks/[id]` load/save (requires presenter key on PUT)
- `POST /api/decks/[id]/sessions` -> creates session (code, snapshot), returns session + urls
- `POST /api/presenter/[sessionId]/advance` body: `{index}` | `{phase}` | `{status}` — mutates
  session, broadcasts `state`
- `POST /api/presenter/[sessionId]/qa` moderate: `{questionId, status}`
- `POST /api/ai/deck` `{topic|outline, slideCount?, audience?}` -> Deck JSON (Anthropic)
- `POST /api/ai/quiz` `{topic|sourceText, count}` -> quiz slides JSON
- `POST /api/ai/summarize-qa` `{sessionId}` -> themes/summary of questions
- `POST /api/import/pptx` (multipart) -> extracted slides JSON
- `POST /api/upload` (multipart) -> Storage `media` bucket, returns public URL
- `GET /api/export/results/[sessionId]?format=xlsx|csv` -> file download
- RPC `get_live_session_for_deck(p_deck_id uuid)` (anon/authenticated) -> the deck's
  currently-live session (or null) for embeds: `session_id, code, phase, status,
  current_slide_index, participant_count, current_slide` (PUBLIC-safe slide fields
  ONLY: id, kind, title, body.prompt/options/optionImages, settings.timeLimitSec —
  never correct answers, notes, snapshot or PII). Migration `20260722143000_embed_live_session`.
- AI routes degrade gracefully: if `ANTHROPIC_API_KEY` unset, return `{aiDisabled: true}` 501
  and the UI shows a friendly "AI is off" state. NOTHING else may depend on AI.

## Design system (dark-stage-first)

- Backgrounds: ink `#0B0E14` (stage/audience), panels `#131826`, borders `#232B3D`
- Text: `#F2F5FA` primary, `#8B94A7` secondary. Accent: violet `#7C5CFF`; cyan `#22D3EE`
- Categorical chart palette (color-blind safe, in order):
  `#7C5CFF #22D3EE #F59E0B #10B981 #F472B6 #94A3B8 #EF4444 #A3E635`
- Type: system stack; stage headings clamp(2.2rem, 6vw, 5rem); audience min font 16px
- Radii: 12px cards, 999px pills. Motion: 150–250ms ease-out; respect `prefers-reduced-motion`
- Charts: horizontal bars for polls/quiz (option labels can be long), animate width, value
  labels at bar end, never color-only distinction (labels always present)
- Tailwind v4: use the tokens defined in `src/app/globals.css` `@theme` block. No inline hex
  in components — use the CSS variables/utilities.
- Touch targets ≥44px on audience app. Stage text contrast ≥4.5:1. Focus rings visible.

## Conventions

- Files: kebab-case; components PascalCase in `src/components/{stage,audience,studio,shared}/`
- All client data hooks live in `src/hooks/` (`use-session-channel.ts`, `use-results-poller.ts`,
  `use-participant.ts`, `use-questions.ts`)
- No new dependencies without updating this file. Currently approved: @supabase/supabase-js,
  @anthropic-ai/sdk, qrcode.react, framer-motion, exceljs, pptxgenjs, jszip, fast-xml-parser,
  nanoid, server-only, pdfjs-dist (client, lazy-loaded)
- `npm run build` must pass with zero type errors before any agent reports done.
- Every interactive state has an empty state, a loading state, and an error state. No dead ends.

## Next.js 16 gotchas (verified against bundled docs — DO NOT use Next 14 idioms)

- `params` and `searchParams` are **Promises**. In pages/layouts/route handlers:
  `async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; }`
- Route handlers: `export async function POST(req: Request, ctx: { params: Promise<{id: string}> })`
- `fetch` is NOT cached by default. Use explicit `cache`/`revalidate` options when needed.
- Dev server runs Turbopack. `cookies()`/`headers()` are async too.
- Check `node_modules/next/dist/docs/` whenever unsure — do not trust training-data idioms.
