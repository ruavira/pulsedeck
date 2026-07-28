# Automatic Gamma → PulseDeck sync

The facilitator-side Chrome extension in
`integrations/gamma-sync-extension/` keeps a live PulseDeck session aligned to
the card currently shown in Gamma. Gamma remains the visual presentation surface;
PulseDeck remains the authenticated interaction and results system.

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
session snapshot. Map every Gamma card—not only activity cards—so moving away
from a poll immediately advances PulseDeck to a neutral content placeholder and
closes the previous response surface.

## Facilitator setup

1. In Chrome, open `chrome://extensions`, enable **Developer mode**, choose
   **Load unpacked**, and select `integrations/gamma-sync-extension/`.
2. Start the mapped PulseDeck deck and copy its complete **Remote** URL.
3. Open the extension while any mapped Gamma deck is active, paste the remote
   URL, and choose **Connect live session**.
4. Present Gamma normally. The extension watches Gamma's `#card-{id}` navigation
   signal (with a visible-card fallback) and sends authenticated index jumps to
   PulseDeck. Polls, word clouds, scales, rankings, and open text auto-open using
   PulseDeck's existing session rules. On join and activity cards, it also adds a
   live right-side PulseDeck panel using the public `auto` embed; the panel is
   removed again on ordinary content cards. No permanent iframe blocks are added
   to the Gamma file.
5. The extension badge reads `ON` when healthy, `–` for an unmapped Gamma card,
   and `!` after an API/network error.

## Security and failure behavior

- Only `gamma.app`, `pulsedeck-live.netlify.app`, and the future
  `pulsedeck.app` origin are permitted.
- The presenter key is never written to local persistent storage or logs.
- Duplicate Gamma navigation events are idempotent and do not reopen a poll.
- If sync stops, the existing PulseDeck phone remote remains the manual fallback.
- Starting a new live session requires reconnecting with that session's remote URL.

## Verification

Run the pure mapping/security tests with:

```bash
npm run test:gamma-sync
```

Then run an end-to-end rehearsal with one presenter browser and one audience
phone before the training event.
