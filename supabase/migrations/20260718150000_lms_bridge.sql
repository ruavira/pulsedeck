-- LMS bridge (Track 4, phase 1): per-deck webhook configuration for pushing
-- session results + completion into an LMS (Moodle receiver, middleware, or
-- any endpoint that can verify an HMAC-SHA256 signature).
--   lms = { "url": "https://...", "secret": "...", "autoPush": true }
-- The secret never leaves the server: it signs the webhook body and is
-- returned to clients only as a boolean (hasSecret).
alter table public.decks
  add column if not exists lms jsonb not null default '{}'::jsonb;

comment on column public.decks.lms is
  'LMS bridge config {url, secret, autoPush}; secret signs webhook payloads (HMAC-SHA256, X-PulseDeck-Signature).';
