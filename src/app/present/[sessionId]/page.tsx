'use client';
// STAGE view entry — /present/[sessionId] (projector / big screen).
// Loads the full session (state + frozen deck snapshot) via
// GET /api/presenter/[sessionId] with x-presenter-key. Key resolution:
// localStorage (getSessionKey) -> ?key= query param -> friendly paste-key screen.

import { use, useCallback, useEffect, useState } from 'react';
import { getSessionKey, storeSessionKey } from '@/lib/presenter-api';
import { Button, Card, Input, Spinner } from '@/components/shared/ui';
import { Stage, type PresenterSession } from '@/components/stage/stage';

type LoadState =
  | { step: 'loading' }
  | { step: 'needKey'; error?: string }
  | { step: 'error'; message: string; retryKey: string | null }
  | { step: 'ready'; session: PresenterSession; key: string };

export default function PresentPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const [st, setSt] = useState<LoadState>({ step: 'loading' });

  const load = useCallback(
    async (key: string | null) => {
      if (!key) {
        setSt({ step: 'needKey' });
        return;
      }
      setSt({ step: 'loading' });
      try {
        const res = await fetch(`/api/presenter/${encodeURIComponent(sessionId)}`, {
          headers: { 'x-presenter-key': key },
          cache: 'no-store',
        });
        if (res.status === 401 || res.status === 403) {
          setSt({
            step: 'needKey',
            error: 'That key didn’t unlock this session. Double-check it and try again.',
          });
          return;
        }
        if (res.status === 404) {
          setSt({
            step: 'error',
            message: 'Session not found. It may have been deleted — check the link from your studio.',
            retryKey: null,
          });
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const session = (await res.json()) as PresenterSession;
        storeSessionKey(sessionId, key);
        setSt({ step: 'ready', session, key });
      } catch {
        setSt({
          step: 'error',
          message: 'Couldn’t reach PulseDeck. Check the network on this machine and retry.',
          retryKey: key,
        });
      }
    },
    [sessionId],
  );

  useEffect(() => {
    // Prefer the stored key; fall back to a ?key= param (then scrub it from the URL).
    const url = new URL(window.location.href);
    const queryKey = url.searchParams.get('key');
    if (queryKey) {
      url.searchParams.delete('key');
      window.history.replaceState(null, '', url.toString());
    }
    const key = getSessionKey(sessionId) ?? (queryKey ? queryKey.trim() : null);
    // Deferred a tick: the initial render already shows the loading state.
    const t = window.setTimeout(() => void load(key), 0);
    return () => window.clearTimeout(t);
  }, [sessionId, load]);

  if (st.step === 'loading') {
    return (
      <main className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-ink">
        <Spinner className="h-8 w-8" />
        <p className="text-lg font-medium text-fg-dim">Warming up the stage…</p>
      </main>
    );
  }

  if (st.step === 'needKey') {
    return <AccessScreen error={st.error} onSubmit={(key) => void load(key)} />;
  }

  if (st.step === 'error') {
    return (
      <main className="fixed inset-0 flex items-center justify-center bg-ink px-6">
        <Card className="flex w-full max-w-md flex-col items-center gap-5 p-8 text-center">
          <h1 className="text-2xl font-bold text-fg">Can’t open the stage</h1>
          <p className="text-fg-dim">{st.message}</p>
          {st.retryKey !== null && (
            <Button onClick={() => void load(st.retryKey as string)}>Retry</Button>
          )}
        </Card>
      </main>
    );
  }

  return <Stage initial={st.session} presenterKey={st.key} />;
}

function AccessScreen({
  error,
  onSubmit,
}: {
  error?: string;
  onSubmit: (key: string) => void;
}) {
  const [value, setValue] = useState('');

  return (
    <main className="fixed inset-0 flex items-center justify-center bg-ink px-6">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-fg">Unlock the stage</h1>
        <p className="mt-2 text-fg-dim">
          This is the big-screen view for a live PulseDeck session. Paste the presenter key for
          this session to open it — you’ll find it in your studio, or in the present link that was
          generated when you went live.
        </p>
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const key = value.trim();
            if (key) onSubmit(key);
          }}
        >
          <label htmlFor="presenter-key" className="text-sm font-semibold text-fg">
            Presenter key
          </label>
          <Input
            id="presenter-key"
            name="presenter-key"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste your presenter key"
            autoComplete="off"
            autoFocus
            spellCheck={false}
          />
          {error && (
            <p role="alert" className="text-sm font-medium text-red">
              {error}
            </p>
          )}
          <Button type="submit" disabled={value.trim().length === 0}>
            Open the stage
          </Button>
        </form>
      </Card>
    </main>
  );
}
