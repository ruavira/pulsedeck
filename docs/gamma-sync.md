# Automatic Gamma → PulseDeck sync

The facilitator-side Chrome extension (v0.4.1) in
`integrations/gamma-sync-extension/` keeps a live PulseDeck session aligned to
the card currently shown in Gamma. Gamma remains the visual presentation surface;
PulseDeck remains the authenticated interaction and results system. Version
0.4 adds one-time secure pairing, session-scoped controller credentials,
exclusive presenter leases, automatic standby/failover, Gamma version
fingerprints, efficient Present-mode navigation detection, and rehearsal-safe
cleanup on top of the v0.3 controller and prewarmed overlay.

## Why the controller is an extension

Public PulseDeck embeds are intentionally read-only. Putting a presenter key in
an iframe URL would let anyone with the Gamma link control the live room. The
Remote now creates a 15-minute, one-use pairing code. PulseDeck exchanges it
for a random session-scoped controller token, stores only its SHA-256 hash on
the server, and keeps the token in `chrome.storage.session`. Gamma receives no
credential. The private Remote URL remains a recovery option; the extension
exchanges its key immediately and never retains that full key.

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
2. Start the mapped PulseDeck deck. On its private **Remote**, choose **Create
   Gamma pairing code** and copy the displayed code.
3. Open the extension while the mapped Gamma deck is active, paste the code,
   and choose **Pair this Chrome**.
4. Confirm that the popup reads **Ready to present**. Its preflight checks the
   PulseDeck snapshot, live session, active Gamma document, mapped interactions,
   and prewarmed panel.
5. Freeze the Gamma version when prompted. This stores a one-way fingerprint of
   the card order and content—not the Gamma text. A later edit produces a clear
   preflight warning until the facilitator deliberately accepts the new version.
6. Present Gamma normally. Present mode trusts the `#card-{id}` route and an
   `IntersectionObserver` supplies the visible-card fallback without scanning
   all cards on every event. Only the newest requested card is retained.
   Interactive kinds auto-open using PulseDeck's existing session rules.
7. The public `auto` embed remains mounted and realtime-connected while hidden.
   On an activity it appears after reporting the expected PulseDeck slide, with
   a backward-compatible load fallback. Runtime modes are `compact`, `side`,
   `focus`, and `hidden`; nothing is permanently added to Gamma.
8. The badge reads `ON` when healthy, `↻` while syncing, `Ⅱ` while paused for
   mobile control, `◇` in standby, `–` for an unsupported location, and `!`
   after an unrecovered failure.

## Controller and fallback behavior

- Rapid navigation aborts stale work; the final Gamma card wins.
- Transient failures retry with bounded backoff.
- An eight-second heartbeat reads authoritative PulseDeck state and repairs
  mobile-remote or network drift.
- Exactly one Chrome controller holds the renewable session lease. Other paired
  Chromes remain in safe standby and can deliberately **Take Control** after a
  failure. They never race the active presenter.
- A mobile Remote action receives a 30-second priority window. Gamma Sync enters
  standby instead of immediately undoing the facilitator's phone action.
- **Force sync now** bypasses cached state and verifies the real session.
- **Pause for mobile control** releases the Chrome lease. **Resume automatic
  sync** reclaims it when available.
- Only the Gamma tab selected at connection time can drive the session.
- **Copy diagnostics** exports redacted card/index/latency events only.

## Security and failure behavior

- Only `gamma.app`, `pulsedeck-live.netlify.app`, and the future
  `pulsedeck.app` origin are permitted.
- The presenter key is never written to local persistent storage or logs; the
  scoped controller token disappears when the Chrome session ends.
- Pairing codes are high-entropy, expire after 15 minutes, and can be redeemed
  once. Generation uses rejection sampling to avoid modulo bias.
- Controller and baseline endpoints return no-store, no-referrer and nosniff
  response headers. New tables use RLS and server-only policies.
- Duplicate Gamma navigation events are idempotent and do not reopen a poll.
- Duplicate mappings are rejected instead of silently overwriting each other.
- Disconnect and owner-tab closure hide the panel and clear presenter access.
- If sync stops, the existing PulseDeck phone remote remains the manual fallback.
- Starting a new live session requires a new pairing code. Two rehearsals may
  reuse a session, and **Clear rehearsal data** removes only simulated users,
  their responses and questions; it does not delete real participants.

## Verification

Run the pure mapping/security tests with:

```bash
npm run test:gamma-sync
npm run package:gamma-sync
```

The package command creates a reviewed ZIP and SHA-256 checksum in `.release/`
without including source maps, local configuration or secrets. Then run an
end-to-end rehearsal with one active Chrome, one standby Chrome/profile, and one
audience phone before the training event.
