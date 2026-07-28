# DFQI Gamma + PulseDeck continuity handoff

Updated: 28 July 2026

Repository: `ruavira/pulsedeck`

Production PulseDeck origin: `https://pulsedeck-live.netlify.app`

Current production interaction deck ID: `c70c065e-366a-47e5-938a-00dd97d8a88d`

## Read this first

The Gamma-to-PulseDeck browser integration is implemented, tested, merged into
`main`, and working against three protected Gamma pilot copies. The user is now
manually combining the three Gamma presentations into one final Gamma deck.

Do not create the final Thursday PulseDeck session or assume the existing Gamma
card mappings are still valid. Copying cards into a new Gamma changes the
document slug and may mint new card IDs. Wait for the user to provide the final
combined Gamma URL, then remap and re-run the browser pilot.

No presenter key, private Remote URL, `.env` value, or local credential is
contained in this handoff.

## Current status

### Complete

- GitHub PR [#14](https://github.com/ruavira/pulsedeck/pull/14) was merged into
  `main` as merge commit `ce59d1b`. The implementation commit is `efa0468`.
- The combined PulseDeck deck has 155 mapped slides, 21 response-producing
  interactions, and one participant Join surface.
- The Manifest V3 extension is in
  `integrations/gamma-sync-extension/` and was tested in Chrome as version
  `0.2.0`.
- Gamma navigation automatically advances PulseDeck. Interaction cards show a
  public PulseDeck overlay inside Gamma; the next content card removes it.
- A live pilot passed with simulated responses, poll totals, percentages,
  automatic navigation, and overlay removal.
- The three original Gamma decks were left untouched. Protected pilot copies
  were created for testing.
- The automated checks passed: 8 Gamma-sync tests, ESLint, the production
  Next.js build, and `git diff --check`.

### In progress

- User is merging Gamma Session 2 and Session 3 into the Session 1 destination
  deck and finalizing the combined presentation.
- Expected card-count checkpoints are 51 cards after Session 1, 107 after
  adding Session 2, and 155 after adding Session 3.

### Blocked pending user input

- Final combined Gamma URL.
- Confirmation that the final combined deck has 155 cards and its sequence is
  frozen for the Wednesday rehearsal.

## Protected Gamma pilot copies

1. [Session 1 — Signal or Noise?](https://gamma.app/docs/DFQI-Part-1-Session-1-Signal-or-Noise-PulseDeck-Live-Pilot-cy7x7cox38l68ru)
2. [Session 2 — From Metric to Chart](https://gamma.app/docs/DFQI-Part-1-Session-2-From-Metric-to-Chart-PulseDeck-Live-Pilot-dc0sfypwingbucz)
3. [Session 3 — From Chart to Boardroom](https://gamma.app/docs/DFQI-Part-1-Session-3-From-Chart-to-Boardroom-PulseDeck-Live-Pilo-f7h6h98pib25r7f)

The source presentations and their original URLs are recorded in
`content/dfqi-gamma-sync.json` and the existing facilitator handoff.

## Important repository files

| File | Purpose |
|---|---|
| `content/dfqi-gamma-sync.json` | Source of truth for the three Gamma documents, all 155 cards, card IDs, and 21 interactive activity definitions. |
| `integrations/gamma-sync-extension/` | Chrome extension that observes Gamma navigation, advances PulseDeck, and injects/removes the public overlay. |
| `scripts/create-dfqi-gamma-sync-deck.mjs` | Creates the combined PulseDeck deck from the mapping content. |
| `scripts/update-dfqi-gamma-sync-deck.mjs` | Updates the existing production PulseDeck deck after mappings/content change. |
| `scripts/pilot-dfqi-gamma-sync.mjs` | API-level pilot and session validation. |
| `docs/gamma-sync.md` | Technical and operator documentation for the integration. |
| `docs/checkpoints/gamma-sync-implementation.md` | Implementation checkpoint and prior pilot evidence. |
| `docs/DFQI-Gamma-PulseDeck-Facilitator-Handoff.docx` | Existing three-page facilitator operating guide. |
| `DFQI-CONTINUITY.md` | This account-independent continuation record. |

## Current interaction map

There are 21 response-producing interactions: 10 polls, 7 open-text prompts,
3 confidence scales, and 1 word cloud. PulseDeck slide numbers below are the
current global positions in the 155-slide combined deck.

### Session 1 — Signal or Noise?

| Gamma card | PulseDeck slide | Type | Interaction |
|---:|---:|---|---|
| 2 | 2 | Poll | Gut check — crisis or noise? |
| 8 | 8 | Poll | Is your dashboard reporting or improving? |
| 14 | 14 | Open text | Card sort — judgment or improvement? |
| 21 | 21 | Poll | Hinge poll — signal or noise? |
| 31 | 31 | Open text | What is your improvement aim? |
| 43 | 43 | Open text | Muddiest point |
| 49 | 49 | Scale | Confidence pulse — signal versus noise |

### Session 2 — From Metric to Chart

| Gamma card | PulseDeck slide | Type | Interaction |
|---:|---:|---|---|
| 6 | 57 | Poll | Which is the real SSI rate? |
| 14 | 65 | Poll | Which component do you skip? |
| 21 | 72 | Poll | Spot the missing component |
| 26 | 77 | Open text | Breakout 1 debrief |
| 36 | 87 | Poll | Is this a trend? |
| 42 | 93 | Word cloud | Which signal rule is still fuzzy? |
| 56 | 107 | Scale | Confidence pulse — metric to chart |

### Session 3 — From Chart to Boardroom

| Gamma card | PulseDeck slide | Type | Interaction |
|---:|---:|---|---|
| 9 | 116 | Poll | Choose the right tool |
| 15 | 122 | Poll | Which face of measurement? |
| 18 | 125 | Open text | Strategic practice — reframe the blame |
| 21 | 128 | Poll | One page, one chart |
| 28 | 135 | Open text | Predict the decision |
| 32 | 139 | Open text | Muddiest point — board communication |
| 42 | 149 | Scale | Confidence pulse — board-ready |

Gamma Session 1 card 1 currently maps to PulseDeck slide 1, the participant
Join surface. Exact current card IDs are in `content/dfqi-gamma-sync.json`.

## Required next workflow

1. **Receive the final Gamma URL.** Confirm it is the editable combined deck,
   not one of the old protected pilot copies.
2. **Inventory the combined deck.** Enumerate every card in order and record
   its final Gamma card ID and heading. Expect 155 cards unless the user has
   intentionally added or removed content.
3. **Reconcile structure.** Compare final card headings and order with the
   current 155-card source in `content/dfqi-gamma-sync.json`. Ask about genuine
   additions/deletions instead of silently shifting interaction positions.
4. **Replace Gamma mappings.** Update all document slugs to the new combined
   Gamma slug and replace card IDs wherever Gamma minted new IDs. Preserve the
   21 activity definitions unless the user requests content changes.
5. **Update production PulseDeck.** Run the update script with the existing
   local credential file. Never print, paste into chat, or commit its contents.
6. **Reload the extension.** Reload the unpacked extension after code changes.
   Mapping-only deck changes are loaded when the extension connects to a fresh
   PulseDeck session.
7. **Run automated verification.** Execute the Gamma-sync tests, lint, build,
   and mapping pilot.
8. **Run the Wednesday rehearsal.** Create a new rehearsal PulseDeck session,
   connect the extension with its private Remote URL, test at least one poll,
   and verify that advancing to the next Gamma content card removes the overlay.
9. **Run Thursday clean.** After all Gamma and PulseDeck edits are frozen,
   create a brand-new production session and reconnect with its new private
   Remote URL. Do not reuse Wednesday's session.

## Validation commands

Run from the repository root:

```bash
npm run test:gamma-sync
npm run lint
npm run build
git diff --check
```

The production update and pilot scripts read private credentials from the
gitignored `.pulsedeck-local/` directory. On the original workstation, the
expected files are:

```text
.pulsedeck-local/dfqi-gamma-sync.json
.pulsedeck-local/dfqi-gamma-sync-session.json
```

Do not reveal or commit their contents. A fresh clone on another machine will
need presenter access to be supplied securely by the user.

## Presenter workflow after remapping

- Present and navigate from Gamma.
- Participants join PulseDeck once at the start and answer from their phones.
- The extension opens the corresponding PulseDeck interaction when Gamma
  reaches a mapped card and hides the overlay on content cards.
- Keep the private PulseDeck mobile Remote open for speaker notes, participant
  counts, Q&A moderation, close-voting controls, panic controls, and manual
  fallback.
- Do not normally use Previous/Next on the mobile Remote because Gamma is the
  primary navigation control.
- Chrome session storage clears on browser exit, so reconnect the extension
  after restarting Chrome or creating a new PulseDeck session.

## Security constraints

- Never commit `.env`, `.env.local`, `.pulsedeck-local/`, presenter keys,
  private Remote URLs, API tokens, or browser/session storage.
- Never paste the complete private Remote URL into Gamma, participant
  communications, screenshots, documentation, issues, or pull requests.
- Public overlays use a credential-free deck embed URL.
- The raw local files under `docs/guide-assets/` contain temporary real-site
  captures and are intentionally untracked. Do not stage or publish them.
- Before every commit or push, scan the staged file list and staged patch for
  credentials.

## Local-only artifacts on the original workstation

These files are outside the repository and are not required to continue the
technical work:

```text
/Users/ayodejisamuels/Downloads/PulseDeck/DFQI-Gamma-PulseDeck-Video-Guide.mp4
/Users/ayodejisamuels/Downloads/PulseDeck/DFQI-Gamma-PulseDeck-Video-Guide-Transcript.txt
```

## Open blockers

| Blocker | Owner | Unblocks when |
|---|---|---|
| Final combined Gamma URL and stable card sequence | User | The three sessions are merged and final content edits are complete. |
| New Gamma document slug and final card IDs | Next agent | The final combined URL can be inspected. |
| Wednesday rehearsal session | Next agent/user | Production deck is updated with final mappings. |
| Thursday production session | Facilitator | Thursday content is frozen; create a clean session immediately before delivery. |

## Paste-ready resume prompt

```text
Continue the DFQI Gamma + PulseDeck integration from the repository handoff at
DFQI-CONTINUITY.md. Read that file first, then read docs/gamma-sync.md,
docs/checkpoints/gamma-sync-implementation.md, content/dfqi-gamma-sync.json,
and integrations/gamma-sync-extension/. PR #14 is already merged into main.

The user has now finalized one combined Gamma deck. Its URL is: [PASTE FINAL
GAMMA URL HERE]. Inspect that deck, enumerate all cards and final card IDs,
reconcile it against the existing 155-card mapping, update the mapping and the
production PulseDeck deck, run tests/lint/build, and execute a live browser
pilot. Preserve the 21 interaction definitions unless the user requests a
change. Never expose or commit presenter credentials, .env files,
.pulsedeck-local contents, or a private Remote URL. Use a separate rehearsal
session for Wednesday and a fresh production session for Thursday.
```
