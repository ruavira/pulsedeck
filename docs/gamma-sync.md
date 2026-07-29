# Automatic Gamma → PulseDeck sync

The facilitator-side Chrome extension (v0.3.0) in
`integrations/gamma-sync-extension/` keeps a live PulseDeck session aligned to
the card currently shown in Gamma. Gamma remains the visual presentation surface;
PulseDeck remains the authenticated interaction and results system. Version
0.3 adds a latest-card-wins controller, bounded retry, authoritative
reconciliation, a prewarmed verified overlay, single-tab ownership, and a
presenter preflight.

## Why the controller is an extension

Public PulseDeck embeds are intentionally read-only. Putting a presenter key in
an iframe URL would let anyone with the Gamma link control the live room. Gamma
Sync instead stores the key in `chrome.storage.session`, sends it only to the
trusted PulseDeck origin, and clears it when Chrome exits or the facilitator
disconnects. Gamma receives no credential.

## Deck mapping contract

Every slide in the live PulseDeck deck may carry:

```json
{
  "settings": {
    "gammaSync": {
      "documentSlug": "DFQI-Part-1-Session-1-Signal-or-Noise-xo0sc2rct0ranmy",
      "cardId": "4igd7qm6fghnfdt"
    }
  }
}
```

The extension reads these mappings from the presenter-authenticated frozen
session snapshot. For a stable document, map every Gamma card—not only activity
cards—so moving away from a poll advances PulseDeck to a neutral placeholder.
For a merged document with newly inserted teaching cards, every activity must
be mapped exactly; an additional content card becomes a safe neutral transition
that closes the response surface and hides the panel.

Gamma preserves some card IDs during duplication and merging. The extension may
use a slug-independent card-ID match only when that ID is globally unambiguous
inside the authenticated PulseDeck snapshot.

## Facilitator setup

1. In Chrome, open `chrome://extensions`, enable **Developer mode**, choose
   **Load unpacked**, and select `integrations/gamma-sync-extension/`.
2. Start the mapped PulseDeck deck and copy its complete **Remote** URL.
3. Open the extension while any mapped Gamma deck is active, paste the remote
   URL, and choose **Connect live session**.
4. Confirm that the popup reads **Ready to present**. Its preflight checks the
   PulseDeck snapshot, live session, active Gamma document, mapped interactions,
   and prewarmed panel.
5. Present Gamma normally. The extension combines the `#card-{id}` route with
   the most-visible `[data-card-id]`, settles transitions for 140 ms, and retains
   only the newest requested card. Interactive kinds auto-open using PulseDeck's
   existing session rules.
6. The public `auto` embed remains mounted and realtime-connected while hidden.
   On an activity it appears after reporting the expected PulseDeck slide, with
   a backward-compatible load fallback. Runtime modes are `compact`, `side`,
   `focus`, and `hidden`; nothing is permanently added to Gamma.
7. The badge reads `ON` when healthy, `↻` while syncing, `Ⅱ` while paused for
   mobile control, `–` for an unsupported location, and `!` after an unrecovered
   failure.

## Controller and fallback behavior

- Rapid navigation aborts stale work; the final Gamma card wins.
- Transient failures retry with bounded backoff.
- An eight-second heartbeat reads authoritative PulseDeck state and repairs
  mobile-remote or network drift.
- **Force sync now** bypasses cached state and verifies the real session.
- **Pause for mobile control** prevents Gamma and the phone remote from
  competing. **Resume automatic sync** immediately restores Gamma authority.
- Only the Gamma tab selected at connection time can drive the session.
- **Copy diagnostics** exports redacted card/index/latency events only.

## Security and failure behavior

- Only `gamma.app`, `pulsedeck-live.netlify.app`, and the future
  `pulsedeck.app` origin are permitted.
- The presenter key is never written to local persistent storage or logs.
- Duplicate Gamma navigation events are idempotent and do not reopen a poll.
- Duplicate mappings are rejected instead of silently overwriting each other.
- Disconnect and owner-tab closure hide the panel and clear presenter access.
- If sync stops, the existing PulseDeck phone remote remains the manual fallback.
- Starting a new live session requires reconnecting with that session's remote URL.

## Verification

Run the pure mapping/security tests with:

```bash
npm run test:gamma-sync
```

Then run an end-to-end rehearsal with one presenter browser and one audience
phone before the training event.
