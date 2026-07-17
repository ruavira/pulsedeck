'use client';
// The presenter phone remote — one-handed show control.
// Auth: ?key= param (stored, then scrubbed from the URL) or a previously stored
// session key; otherwise a paste screen. Live state via useSessionChannel with
// optimistic mutations through the presenter API routes. Screen stays awake.

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, JoinCode, Spinner } from '@/components/shared/ui';
import { useSessionChannel } from '@/hooks/use-session-channel';
import { getSessionKey, presenterPost, storeSessionKey } from '@/lib/presenter-api';
import type { SessionState } from '@/lib/types';
import {
  PresenterAuthError,
  presenterGet,
  type AdvanceBody,
  type PresenterSession,
  type RemoteSessionSettings,
} from './remote-types';
import { useWakeLock } from './use-wake-lock';
import { KeyEntry } from './key-entry';
import { StatusBar } from './status-bar';
import { ControlTab } from './control-tab';
import { QaTab } from './qa-tab';

type LoadPhase = 'boot' | 'need-key' | 'loading' | 'ready' | 'error';
type Tab = 'control' | 'qa';

export function RemoteApp({
  sessionId,
  keyFromUrl,
}: {
  sessionId: string;
  keyFromUrl: string | null;
}) {
  const [presenterKey, setPresenterKey] = useState<string | null>(null);
  const [loadPhase, setLoadPhase] = useState<LoadPhase>('boot');
  const [session, setSession] = useState<PresenterSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [tab, setTab] = useState<Tab>('control');
  const [qaBump, setQaBump] = useState(0);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ----- resolve the presenter key (URL param wins, then localStorage) -----
  useEffect(() => {
    const fromUrl = keyFromUrl?.trim() || null;
    if (fromUrl) {
      storeSessionKey(sessionId, fromUrl);
      // scrub the key from the address bar (screen-share safety)
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {
        /* non-fatal */
      }
      setPresenterKey(fromUrl);
      return;
    }
    const stored = getSessionKey(sessionId);
    if (stored) setPresenterKey(stored);
    else setLoadPhase('need-key');
  }, [sessionId, keyFromUrl]);

  // ----- load the session snapshot once a key is present -----
  useEffect(() => {
    if (!presenterKey) return;
    let stale = false;
    setLoadPhase('loading');
    (async () => {
      try {
        const s = await presenterGet<PresenterSession>(
          `/api/presenter/${sessionId}`,
          presenterKey,
        );
        if (!stale) {
          setSession(s);
          setLoadPhase('ready');
        }
      } catch (err) {
        if (stale) return;
        if (err instanceof PresenterAuthError) {
          setPresenterKey(null);
          setKeyError('That key was rejected for this session — check it and try again.');
          setLoadPhase('need-key');
        } else {
          setLoadError('Could not reach the session. Check your signal and retry.');
          setLoadPhase('error');
        }
      }
    })();
    return () => {
      stale = true;
    };
  }, [presenterKey, sessionId, retryNonce]);

  // ----- realtime channel (only once loaded) -----
  const channelOpts = useMemo(
    () => ({ onQaBump: () => setQaBump((n) => n + 1) }),
    [],
  );
  const { state, setState, connected, resync } = useSessionChannel(
    loadPhase === 'ready' ? sessionId : null,
    channelOpts,
  );

  // live state with a fallback derived from the initial snapshot
  const liveState: SessionState | null = useMemo(() => {
    if (state) return state;
    if (!session) return null;
    return {
      id: session.id,
      status: session.status,
      currentSlideIndex: session.currentSlideIndex,
      phase: session.phase,
      phaseOpenedAt: session.phaseOpenedAt,
      settings: session.settings,
    };
  }, [state, session]);
  const liveRef = useRef(liveState);
  liveRef.current = liveState;

  useWakeLock(loadPhase === 'ready' && liveState?.status !== 'ended');

  // ----- toast + action plumbing -----
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const runAction = useCallback(
    async (actionId: string, fn: () => Promise<void>): Promise<boolean> => {
      if (busy || !presenterKey) return false;
      setBusy(actionId);
      try {
        await fn();
        return true;
      } catch {
        showToast("That didn't go through — check your signal and try again.");
        void resync(); // heal any optimistic drift
        return false;
      } finally {
        setBusy(null);
      }
    },
    [busy, presenterKey, resync, showToast],
  );

  const advance = useCallback(
    (actionId: string, body: AdvanceBody, optimistic?: Partial<SessionState>) =>
      runAction(actionId, async () => {
        if (optimistic && liveRef.current) {
          setState({ ...liveRef.current, ...optimistic });
        }
        const res = await presenterPost<{ ok: boolean; state?: SessionState }>(
          `/api/presenter/${sessionId}/advance`,
          presenterKey!,
          body,
        );
        if (res.state) {
          setState((prev) => ({ ...(prev ?? res.state!), ...res.state! }));
        }
      }),
    [runAction, sessionId, presenterKey, setState],
  );

  const updateSettings = useCallback(
    (actionId: string, patch: Partial<RemoteSessionSettings>) =>
      runAction(actionId, async () => {
        if (liveRef.current) {
          setState({
            ...liveRef.current,
            settings: { ...liveRef.current.settings, ...patch },
          });
        }
        const res = await presenterPost<{ ok?: boolean; state?: SessionState }>(
          `/api/presenter/${sessionId}/settings`,
          presenterKey!,
          { settings: patch },
        );
        if (res?.state) {
          setState((prev) => ({ ...(prev ?? res.state!), ...res.state! }));
        }
      }),
    [runAction, sessionId, presenterKey, setState],
  );

  const simulate = useCallback(
    async (n: number): Promise<number | null> => {
      if (busy || !presenterKey) return null;
      setBusy('simulate');
      try {
        const res = await presenterPost<{
          ok?: boolean;
          participants?: number;
          count?: number;
          added?: number;
        }>(`/api/presenter/${sessionId}/simulate`, presenterKey, { participants: n });
        return res.participants ?? res.count ?? res.added ?? n;
      } catch {
        return null;
      } finally {
        setBusy(null);
      }
    },
    [busy, presenterKey, sessionId],
  );

  const handleKeySubmit = useCallback(
    (key: string) => {
      storeSessionKey(sessionId, key);
      setKeyError(null);
      setPresenterKey(key);
    },
    [sessionId],
  );

  // ================= render =================

  if (loadPhase === 'need-key') {
    return <KeyEntry error={keyError} busy={false} onSubmit={handleKeySubmit} />;
  }

  if (loadPhase === 'boot' || loadPhase === 'loading' || !session || !liveState) {
    if (loadPhase === 'error') {
      return (
        <div className="min-h-dvh bg-ink flex items-center justify-center px-5">
          <Card className="w-full max-w-md p-6 text-center flex flex-col gap-4">
            <p className="text-sm text-red" role="alert">
              {loadError ?? 'Something went wrong loading the session.'}
            </p>
            <Button size="lg" onClick={() => setRetryNonce((n) => n + 1)}>
              Retry
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setPresenterKey(null);
                setKeyError(null);
                setLoadPhase('need-key');
              }}
            >
              Use a different key
            </Button>
          </Card>
        </div>
      );
    }
    return (
      <div className="min-h-dvh bg-ink flex flex-col items-center justify-center gap-3">
        <Spinner />
        <p className="text-sm text-fg-dim">Pairing your remote…</p>
      </div>
    );
  }

  if (liveState.status === 'ended') {
    return (
      <div className="min-h-dvh bg-ink flex items-center justify-center px-5">
        <Card className="w-full max-w-md p-8 text-center flex flex-col items-center gap-4">
          <span className="text-4xl" aria-hidden="true">
            🎉
          </span>
          <div>
            <h1 className="text-2xl font-bold text-fg">That&apos;s a wrap</h1>
            <p className="mt-2 text-sm text-fg-dim">
              Session <JoinCode code={session.code} className="text-sm" /> has ended.
              Results, scores and questions are saved.
            </p>
          </div>
          <Link
            href={`/report/${sessionId}`}
            className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-accent px-7 text-lg font-semibold text-white shadow-accent-glow transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
          >
            View session report
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-ink">
      <StatusBar
        sessionId={sessionId}
        code={session.code}
        status={liveState.status}
        connected={connected}
        extrasOpen={extrasOpen}
        onToggleExtras={() => setExtrasOpen((o) => !o)}
      />

      <main className="mx-auto max-w-md px-4 pb-32 pt-4">
        <div
          role="tabpanel"
          id="panel-control"
          aria-labelledby="tab-control"
          hidden={tab !== 'control'}
        >
          <ControlTab
            session={session}
            state={liveState}
            busy={busy}
            extrasOpen={extrasOpen}
            advance={advance}
            updateSettings={updateSettings}
            simulate={simulate}
          />
        </div>
        <div role="tabpanel" id="panel-qa" aria-labelledby="tab-qa" hidden={tab !== 'qa'}>
          {tab === 'qa' && presenterKey && (
            <QaTab
              sessionId={sessionId}
              presenterKey={presenterKey}
              bumpSignal={qaBump}
              moderated={(liveState.settings as RemoteSessionSettings).qaModerated === true}
            />
          )}
        </div>
      </main>

      {toast && (
        <div
          role="alert"
          className="fixed bottom-20 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-red/40 bg-panel px-4 py-3 text-sm font-semibold text-red shadow-lg"
        >
          {toast}
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-edge bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div role="tablist" aria-label="Remote sections" className="mx-auto grid max-w-md grid-cols-2">
          {(
            [
              ['control', 'Control', 'tab-control', 'panel-control'],
              ['qa', 'Q&A', 'tab-qa', 'panel-qa'],
            ] as const
          ).map(([id, label, tabId, panelId]) => (
            <button
              key={id}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={panelId}
              onClick={() => setTab(id)}
              className={`relative min-h-[56px] text-[15px] transition-colors ${
                tab === id ? 'font-bold text-fg' : 'font-semibold text-fg-dim'
              }`}
            >
              {label}
              {tab === id && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-8 top-0 h-0.5 rounded-full bg-accent"
                />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
