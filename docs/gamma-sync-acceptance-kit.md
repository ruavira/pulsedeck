# Gamma Sync production acceptance kit

This permanent, isolated rehearsal kit certifies the Gamma Sync integration
without touching a real training deck, session, participant or response.

## Assets

- Gamma: `https://gamma.app/docs/PulseDeck-Gamma-Production-Acceptance-Rehearsal-Kit-9dr3ul4d5a5wsdd`
- PulseDeck deck ID: `2d277960-ded0-48de-89b1-b48bb03758f1`
- Protected local session record: `.pulsedeck-local/gamma-sync-acceptance-kit.json`
- Duration: approximately 10 minutes

The protected record is ignored by Git, stored with mode `0600`, and contains
the current Remote, Stage and audience links. Never paste that file into an
issue, commit, chat or screen share.

## Mapping

| Gamma card | PulseDeck kind | Display mode | Acceptance purpose |
|---|---|---|---|
| `h7noxevoqod7ndz` | Content | Hidden | Clean start |
| `kq44gz2qdo598ae` | Content | Hidden | Preflight |
| `xxvf9jvk1ys3alb` | Poll | Compact | Auto-open and voting |
| `oigpuxorblnj9ne` | Content | Hidden | Auto-close transition |
| `dh8daoczs8rbwsx` | Scale | Compact | Numeric response |
| `tpsrhpp6l7i8j1f` | Ranking | Compact | Ordered response |
| `qjv745xknanz9el` | Word cloud | Side | Live word results |
| `luz2w3pw9bfv6py` | Open text | Side | Free-text response |
| `wzyfg8cn5r5nqi3` | Content | Hidden | Rapid navigation |
| `2r0hlu7egor8j1i` | Q&A | Side | Audience/Remote separation |
| `bzq9b9bbal1i7c7` | Content | Hidden | Controller failover |
| `tv6letl8vg63xr4` | Content | Hidden | Pass/hold record |

## Acceptance sequence

1. Open the private PulseDeck Remote and create a 72-hour, one-use Gamma code.
2. Pair the active Chrome while the rehearsal Gamma is open.
3. Freeze the 12-card Gamma fingerprint and confirm **Ready to present**.
4. Enter Gamma Present mode and traverse all cards in order.
5. Confirm compact and side activities open; every content card closes the
   activity and hides the panel.
6. On the rapid-navigation card, press Next, Back, Next and confirm the final
   visible card wins.
7. Pair a backup Chrome/profile, confirm standby, and test deliberate takeover.
8. Navigate once from the mobile Remote and confirm its 30-second priority.
9. Simulate participants, then clear rehearsal data and confirm simulated data
   is removed without deleting real participants.
10. Disconnect and confirm the overlay disappears. Record PASS or HOLD.

## Automated evidence

- The mapping contract is part of `npm run test:gamma-sync`.
- `npm run verify:gamma-sync-acceptance-api` validates production mapping,
  72-hour expiry, superseding of older unused codes, one-use redemption, standby, takeover, mobile priority, recovery, release and
  rehearsal cleanup without printing protected credentials.
- The first production API acceptance run passed on 2026-07-29.
- `npm run update:gamma-sync-acceptance-kit` reconciles the permanent deck to
  the checked-in specification, preserves slide IDs and creates a fresh session.
