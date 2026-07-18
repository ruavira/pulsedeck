# local_pulsedeck — PulseDeck LMS bridge receiver for Moodle

Receives HMAC-signed results pushes from PulseDeck (pulsedeck.ruavira.org) when
a live session ends: per-participant scores, quiz stats, and completion share.
Results are stored, browsable by managers, and exportable as CSV for grade
import. Phase 2 of the bridge (LTI 1.3 launch + automatic gradebook writeback)
will build on this.

Requires Moodle 4.1+.

## Install

1. Zip this folder so the archive root is `local_pulsedeck/` (or use the
   release zip) and install via **Site administration → Plugins → Install
   plugins**, or copy the folder to `MOODLE_ROOT/local/pulsedeck` and visit
   **Site administration → Notifications**.
2. Configure **Site administration → Plugins → Local plugins → PulseDeck
   bridge**:
   - **Accept pushes**: on.
   - **Signing secret**: a long random string.
   - **Freshness window**: 5 minutes is a good default.

## Connect PulseDeck

In the PulseDeck deck editor, open **LMS** in the top bar and set:

- **Results endpoint**: `https://YOUR-MOODLE/local/pulsedeck/push.php`
- **Signing secret**: the same string as above.

Press **Send test ping** — you should see "Test ping delivered ✓". From then
on, every session that ends pushes its results automatically (and any past
session can be re-sent from its report page).

## View results

**Site administration → Reports** is not used; open
`https://YOUR-MOODLE/local/pulsedeck/index.php` (managers only —
capability `local/pulsedeck:viewreport`). Each received session shows its
participants, matched Moodle users, scores, quiz accuracy and completion, with
a CSV download.

## User matching

Participants are pseudonymous in PulseDeck. The receiver links a result to a
Moodle account only when the nickname is a **unique, exact** match for a
username or email (case-insensitive). Practical pattern until LTI: ask learners
to join sessions using their Moodle username as their nickname.

## Getting results into the gradebook (manual, v0.1)

1. Open a session's results → **Download CSV**.
2. Use **Grade administration → Import → CSV file** in the target course,
   mapping `matched_username` → username and the value column of your choice
   (`score`, `quiz_correct`, or `completion_pct`).

Automatic per-user gradebook writeback lands with LTI 1.3 (phase 2), where
learner identity arrives with the course launch instead of via nicknames.

## Security

- Signature: `HMAC-SHA256(secret, "<timestamp>.<raw body>")`, sent as
  `X-PulseDeck-Signature: sha256=<hex>`; verified constant-time
  (`hash_equals`) with a freshness window (replay protection).
- The endpoint uses no Moodle session (`NO_MOODLE_COOKIES`); the HMAC is the
  authentication. Invalid or stale signatures get 401 and store nothing.
- Payloads are capped at 2 MB; test pings verify wiring but are not stored.
