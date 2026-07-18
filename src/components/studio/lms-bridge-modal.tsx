'use client';
// Deck-level LMS bridge settings: webhook URL + signing secret + auto-push.
// When configured, session results (scores, quiz stats, completion) POST to
// the endpoint on session end, signed with HMAC-SHA256 — see docs/LMS_BRIDGE.md
// for the payload schema and a Moodle-side verification sample.

import { useEffect, useState } from 'react';
import { Button, Input, Spinner } from '@/components/shared/ui';
import { Field, Modal, Toggle } from './modal';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type TestState = 'idle' | 'sending' | 'ok' | 'fail';

export function LmsBridgeModal({
  open,
  onClose,
  deckId,
  presenterKey,
}: {
  open: boolean;
  onClose: () => void;
  deckId: string;
  presenterKey: string;
}) {
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [hasSecret, setHasSecret] = useState(false);
  const [autoPush, setAutoPush] = useState(true);
  const [save, setSave] = useState<SaveState>('idle');
  const [test, setTest] = useState<TestState>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSave('idle');
    setTest('idle');
    setError('');
    setSecret('');
    (async () => {
      try {
        const res = await fetch(`/api/decks/${deckId}/lms`, {
          headers: { 'x-presenter-key': presenterKey },
        });
        if (!res.ok) throw new Error(String(res.status));
        const cfg = (await res.json()) as { url: string; hasSecret: boolean; autoPush: boolean };
        setUrl(cfg.url);
        setHasSecret(cfg.hasSecret);
        setAutoPush(cfg.autoPush);
      } catch {
        setError('Could not load the current settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, deckId, presenterKey]);

  const doSave = async (): Promise<boolean> => {
    setSave('saving');
    setError('');
    try {
      const res = await fetch(`/api/decks/${deckId}/lms`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-presenter-key': presenterKey },
        body: JSON.stringify({ url: url.trim(), secret: secret.trim() || undefined, autoPush }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; hasSecret?: boolean };
      if (!res.ok) {
        setSave('error');
        setError(
          body.error === 'invalid_url'
            ? 'The endpoint must be an https:// URL.'
            : body.error === 'secret_required'
              ? 'Add a signing secret — the receiver needs it to verify pushes are really from PulseDeck.'
              : 'Could not save. Please try again.',
        );
        return false;
      }
      setHasSecret(Boolean(body.hasSecret));
      setSecret('');
      setSave('saved');
      return true;
    } catch {
      setSave('error');
      setError('Could not save. Please try again.');
      return false;
    }
  };

  // Test always saves first, so the ping exercises exactly what's on screen.
  const doTest = async () => {
    setTest('sending');
    if (!(await doSave())) {
      setTest('fail');
      return;
    }
    try {
      const res = await fetch(`/api/decks/${deckId}/lms/test`, {
        method: 'POST',
        headers: { 'x-presenter-key': presenterKey },
      });
      setTest(res.ok ? 'ok' : 'fail');
    } catch {
      setTest('fail');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="LMS bridge">
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-10 text-fg-dim" role="status">
          <Spinner /> Loading settings…
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm leading-relaxed text-fg-dim">
            When a session ends, PulseDeck sends the results — scores, quiz stats and completion —
            to this endpoint as JSON, signed with your secret (HMAC-SHA256). Point it at your
            Moodle receiver or any webhook consumer.
          </p>

          <Field label="Results endpoint (https)" hint="Leave empty to switch the bridge off.">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://moodle.example.org/local/pulsedeck/push.php"
              inputMode="url"
              autoComplete="off"
            />
          </Field>

          <Field
            label="Signing secret"
            hint={
              hasSecret
                ? 'A secret is saved. Enter a new value to rotate it — it is never shown again.'
                : 'Shared with your receiver so it can verify each push.'
            }
          >
            <Input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={hasSecret ? '••••••••••••  (saved)' : 'paste a long random string'}
              type="password"
              autoComplete="off"
            />
          </Field>

          <Toggle
            checked={autoPush}
            onChange={setAutoPush}
            label="Push automatically when a session ends"
            hint="You can always re-send from the session report."
          />

          {error && (
            <p role="alert" className="rounded-lg border border-red/40 bg-red/10 px-3 py-2 text-sm text-red">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span aria-live="polite" className="text-sm text-fg-dim">
              {test === 'sending' && 'Sending test ping…'}
              {test === 'ok' && <span className="font-semibold text-emerald">Test ping delivered ✓</span>}
              {test === 'fail' && <span className="font-semibold text-red">Test failed — check the URL, secret and receiver.</span>}
              {test === 'idle' && save === 'saved' && <span className="font-semibold text-emerald">Saved ✓</span>}
            </span>
            <span className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => void doTest()}
                disabled={test === 'sending' || !url.trim() || !(hasSecret || secret.trim())}
              >
                Send test ping
              </Button>
              <Button onClick={() => void doSave()} disabled={save === 'saving'}>
                {save === 'saving' ? 'Saving…' : 'Save'}
              </Button>
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
}
