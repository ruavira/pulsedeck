# PulseDeck Embeds

Host-agnostic, read-only, live, themeable widgets you can drop into any page via an
`<iframe>`. An embed shows **only what the projector already shows publicly** during
a live session — aggregate results, the current activity, the join code/QR. Nothing
deck-private (no presenter key, no full deck, no per-person data) is ever exposed.

## URL shape

```
/embed/deck/{deckId}/{widget}?theme=…&accent=…&compact=1&preset=gamma
```

`{widget}` is one of:

| widget | shows |
|---|---|
| `auto` | mirrors the live session's **current slide** (poll/quiz/word cloud/…); falls back to the join card between activities |
| `poll` `quiz` `ranking` `wordcloud` | that activity's live results when the current slide matches; otherwise a "waiting for the next …" idle card |
| `qa` | the live Q&A wall (upvote-sorted) |
| `leaderboard` | the session leaderboard (top scores) |
| `join` | join QR + code + live participant count |

### Why deck-scoped URLs

Embeds are addressed by **deck**, not by session. Paste the URL once and it keeps
working for every future session of that deck: the embed resolves the deck to
whichever session is live *right now*, shows a "session opens soon" card before you
go live, the live widget during the talk, "session ended" after, and then
automatically picks up your **next** session. No re-pasting per session.

## Embedding in Gamma

1. In Gamma, add an **Embed** card.
2. Paste your widget URL, e.g.
   `https://pulsedeck.app/embed/deck/DECK_ID/auto?theme=aurora&preset=gamma`.
3. `preset=gamma` gives a transparent, borderless look that blends into the slide.

The embed is transparent and auto-fits its content, so it sits cleanly inside the
card. `frame-ancestors *` is set on `/embed/*`, so Gamma (or any host) can frame it.

## Host-agnostic

The same URL works anywhere an iframe does — Notion (`/embed` a link), a plain
`<iframe src="…/embed/deck/DECK_ID/poll">`, a docs site, an internal wiki. There is
no Gamma-specific dependency; `preset=gamma` is just a styling convenience.

## Theming params

| param | effect |
|---|---|
| `theme` | one of the PulseDeck theme packs: `ice` `sky` `teal` `sunrise` `navy` `aurora` `sand` `pop` |
| `accent` | a `#hex` accent override (e.g. `accent=%23FF5A5F`) — the one dynamic color |
| `compact` | tighter layout for small cards (`compact=1`) |
| `preset=gamma` | transparent + borderless defaults tuned for Gamma embed cards |

The surface is always transparent (it lives in an iframe); the theme pack only
recolors the widget's text, bars and chrome to match your deck.

## How results stay live (the aggregator model)

PulseDeck's realtime contract allows **exactly one** client per session to poll
aggregate results and rebroadcast them; everyone else consumes. During a normal
talk the projector (stage) is that single poller, and embeds simply defer to it. If
no stage is open (you're driving from the phone remote, or the deck is only embedded
on a page), the embeds elect one of themselves via Realtime **Presence**: if a
`stage` is present it wins; otherwise the embed with the smallest client id becomes
the sole poller (with ~750ms hysteresis to avoid churn). The elected embed polls
`get_results` and rebroadcasts throttled `results`; every embed — including the
poller, via `broadcast: { self: true }` — renders from that single stream, so
handoff between pollers is seamless and the single-poller database contract is
preserved regardless of how many embeds are open.
