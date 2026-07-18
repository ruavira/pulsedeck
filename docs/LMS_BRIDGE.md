# PulseDeck LMS bridge

Push session results — scores, quiz item stats, and completion — from PulseDeck
into your LMS. Phase 1 (this document) is a **signed results webhook**: simple,
LMS-agnostic, and deployable today against the Ruavira Moodle. Phase 2 (planned)
is a full **LTI 1.3 tool** (course launch with identity + Assignment and Grade
Services writeback), which builds on the same payload shapes.

## How it works

1. In the deck editor, open **LMS** in the top bar and set:
   - **Results endpoint** — an `https://` URL that will receive POSTs.
   - **Signing secret** — a long random string shared with your receiver.
   - **Push automatically when a session ends** — on by default.
2. When a session ends, PulseDeck POSTs the results payload to your endpoint.
   You can also (re)send any past session from its report page (**Send to LMS**),
   and send a **test ping** from the settings dialog.

## Request format

```
POST <your endpoint>
content-type: application/json
user-agent: PulseDeck-LMS-Bridge/1
x-pulsedeck-event: session.results | test
x-pulsedeck-timestamp: <unix ms as string>
x-pulsedeck-signature: sha256=<hex hmac>
```

The signature is `HMAC-SHA256(secret, "<timestamp>.<raw body>")`. Verify it
constant-time and reject requests older than a few minutes (replay protection).

### Payload: `session.results`

```json
{
  "event": "session.results",
  "sentAt": "2026-07-18T15:00:00.000Z",
  "session": {
    "id": "…uuid…",
    "code": "ABCDEF",
    "deckId": "…uuid…",
    "deckTitle": "Infection control refresher",
    "startedAt": "…iso…",
    "endedAt": "…iso…",
    "participantCount": 24,
    "interactiveSlides": 9,
    "quizSlides": 5
  },
  "participants": [
    {
      "nickname": "Amina",
      "score": 4200,
      "bestStreak": 5,
      "quizAttempts": 5,
      "quizCorrect": 4,
      "completion": 0.89
    }
  ],
  "quizItems": [
    {
      "slideId": "…uuid…",
      "question": "First step after a needlestick injury?",
      "attempts": 24,
      "correct": 17,
      "correctPct": 71
    }
  ]
}
```

Notes:

- `completion` is the share (0–1) of interactive slides the participant
  responded to — a practical "attended and engaged" signal for completion rules.
- Participants are **pseudonymous** (session nicknames). For per-user gradebook
  writeback you need an identity-bearing launch — that's the Phase 2 LTI 1.3
  work. Until then, common patterns are: ask learners to join with their
  Moodle username as nickname, or treat the push as a class-level evidence
  record attached to the activity.

## Verifying the signature

Node:

```js
const { createHmac, timingSafeEqual } = require('crypto');

function verify(secret, req, rawBody) {
  const ts = req.headers['x-pulsedeck-timestamp'];
  const sig = (req.headers['x-pulsedeck-signature'] || '').replace(/^sha256=/, '');
  if (!ts || !sig || Math.abs(Date.now() - Number(ts)) > 5 * 60_000) return false;
  const expected = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  return expected.length === sig.length &&
    timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
}
```

PHP (e.g. a small Moodle `local` plugin or a standalone receiver on the same
host):

```php
$raw  = file_get_contents('php://input');
$ts   = $_SERVER['HTTP_X_PULSEDECK_TIMESTAMP'] ?? '';
$sig  = str_replace('sha256=', '', $_SERVER['HTTP_X_PULSEDECK_SIGNATURE'] ?? '');
$ok   = $ts !== '' && abs(time() * 1000 - (float)$ts) < 300000
     && hash_equals(hash_hmac('sha256', $ts . '.' . $raw, $SECRET), $sig);
if (!$ok) { http_response_code(401); exit; }
$payload = json_decode($raw, true);
// …store, or map into the gradebook via grade_update()…
```

## Moodle wiring options (Ruavira Moodle)

- **Local plugin receiver (recommended for phase 1): SHIPPED** — see
  `integrations/moodle/local_pulsedeck/` in this repo (installable zip in
  releases). Verifies signatures, stores per-participant results, matches
  nicknames to Moodle users (unique username/email match), manager report at
  `/local/pulsedeck/index.php`, CSV export shaped for grade import.
- **Middleware:** any small relay (Netlify/Supabase edge function, n8n, Make)
  that verifies the signature and calls Moodle's web-service API with a token.
- **Phase 2 — LTI 1.3:** PulseDeck as an LTI tool: launch a session from a
  course (identity arrives with the launch), then AGS posts per-user scores
  straight into the gradebook. Tracked in `pulsedeck/ENHANCEMENTS_2026-07.md`.

## Security properties

- HTTPS-only endpoints (localhost allowed for development).
- Secrets are write-only: the API returns `hasSecret`, never the value.
- Signature covers timestamp + body; receivers should enforce a freshness
  window (≤5 min) to block replays.
- Delivery is best-effort with a 6s timeout and never blocks or breaks the
  presenter flow; the last delivery status is shown on the session report.
