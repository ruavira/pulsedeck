# PulseDeck Gamma Sync 0.6.0

## Install or update

1. Download or clone PulseDeck on the presenter computer.
2. Open `chrome://extensions` in Chrome and enable Developer mode.
3. Choose **Load unpacked** and select this `gamma-sync-extension` folder. If it
   is already installed, choose **Reload** on the extension card instead.
4. Refresh the open Gamma tab after every extension update.

Each Chrome profile stores its own temporary controller. Install the extension
in a backup profile or computer, pair it separately, and leave it in **Standby**.
Only one Chrome controls a session at a time.

## Present

1. Start the PulseDeck live session and open its private Remote.
2. In the Remote, create a Gamma pairing code.
3. Open the final Gamma presentation, open the extension, and pair the code.
4. Freeze the Gamma version when prompted and confirm **Ready to present**.
5. Present in Gamma. PulseDeck activities open and close as the mapped Gamma
   cards change.

The interaction panel evaluates the visible card and chooses the corner with
the least content overlap. The arrow control cycles through the four corners
when the presenter wants to override that choice. Closing an activity is
instant so a panel cannot linger over a transition card.

Audience reactions remain lightweight: emojis float briefly, while pace
signals, raised hands and new questions collect in a small **Audience inbox**
tab at the edge of the screen. Open it when convenient; question text remains
on the private Remote rather than being exposed to the room automatically.

The mobile PulseDeck Remote is still useful for participant counts, Q&A,
rehearsal tools and intentional overrides. A Remote navigation action temporarily
takes priority; Gamma Sync waits rather than fighting it.

## Release package

From the app folder, run `npm run package:gamma-sync`. Distribute the ZIP from
`.release/` together with its `.sha256` checksum. Do not distribute a folder
that contains `.env` files or private rehearsal-session records.
