'use client';
// The stage orchestrator: realtime channel, results polling + rebroadcast,
// keyboard control (the stage IS a presenter surface), overlays, chrome,
// lobby/live/ended states. Rendered by /present/[sessionId] after key auth.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { useSessionChannel } from '@/hooks/use-session-channel';
import { useResultsPoller, type LatencySample } from '@/hooks/use-results-poller';
import { presenterPost } from '@/lib/presenter-api';
import { INTERACTIVE_KINDS, isInteractiveKind } from '@/lib/types';
import type {
  DeckSnapshot,
  Phase,
  Results,
  SessionSettings,
  SessionState,
  SessionStatus,
  SlideKind,
  StateEvent,
} from '@/lib/types';
import { SlideRenderer } from './slide-renderer';
import { StageChrome } from './stage-chrome';
import { Leaderboard } from './leaderboard';
import { ReactionsOverlay, type ReactionsHandle } from './reactions-overlay';
import { SignalMood } from './signal-mood';
import { Blackout, HintBar, QrSpotlight } from './overlays';
import { EndedScreen, Lobby } from './lobby';

/** Shape returned by GET /api/presenter/[sessionId]. */
export interface PresenterSession {
  id: string;
  code: string;
  deckId: string;
  status: SessionStatus;
  currentSlideIndex: number;
  phase: Phase;
  phaseOpenedAt: string | null;
  settings: SessionSettings;
  deck: DeckSnapshot;
  startedAt?: string | null;
}

// Kinds whose results the stage aggregates: every interactive kind except Q&A
// (the Q&A wall has its own fetch path). Non-interactive kinds (content, timer,
// breathing) never poll.
const RESULT_KINDS: ReadonlySet<SlideKind> = new Set(
  INTERACTIVE_KINDS.filter((k) => k !== 'qa'),
);

export function Stage({
  initial,
  presenterKey,
}: {
  initial: PresenterSession;
  presenterKey: string;
}) {
  const sessionId = initial.id;
  const reactionsRef = useRef<ReactionsHandle>(null);
  const [qaBump, setQaBump] = useState(0);
  const [skewMs, setSkewMs] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const initialState = useMemo<SessionState>(
    () => ({
      id: initial.id,
      status: initial.status,
      currentSlideIndex: initial.currentSlideIndex,
      phase: initial.phase,
      phaseOpenedAt: initial.phaseOpenedAt,
      settings: initial.settings ?? {},
    }),
    [initial],
  );

  // Room-mood signals (pace/comprehension + raise hand). Ephemeral, in-memory.
  const signalsRef = useRef<{ kind: string; at: number }[]>([]);
  const [showMood, setShowMood] = useState(false);
  const [mood, setMood] = useState<{ counts: Record<string, number>; hands: number; total: number }>({
    counts: {},
    hands: 0,
    total: 0,
  });
  const onSignal = useCallback((p: { kind: string }) => {
    signalsRef.current.push({ kind: p.kind, at: Date.now() });
  }, []);
  // Advertise presence as the stage so embeds on this session defer to us as the
  // results aggregator and never poll. Stable per mount; the stage keeps polling
  // exactly as before (this is additive and non-breaking).
  const stageClientId = useRef(`stage-${nanoid(10)}`);
  const { state, setState, connected, broadcast, resync } = useSessionChannel(sessionId, {
    initialState,
    onReact: (p) => reactionsRef.current?.push(p.emoji),
    onQaBump: () => setQaBump((n) => n + 1),
    onSignal,
    presence: { key: stageClientId.current, role: 'stage' },
  });

  // Recompute the rolling mood every second: pace signals over 30s, hands over 60s.
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      signalsRef.current = signalsRef.current.filter((s) => now - s.at < 60_000);
      const counts: Record<string, number> = {};
      let hands = 0;
      let total = 0;
      for (const s of signalsRef.current) {
        if (s.kind === 'hand') {
          if (now - s.at < 60_000) hands++;
        } else if (now - s.at < 30_000) {
          counts[s.kind] = (counts[s.kind] ?? 0) + 1;
          total++;
        }
      }
      setMood({ counts, hands, total });
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const s = state ?? initialState;

  // Server clock skew (state events carry serverTime) — keeps the quiz
  // countdown server-authoritative even on drifted machines. Measured when a
  // state event lands; the tiny deferral keeps the effect body pure.
  useEffect(() => {
    const st = (state as StateEvent | null)?.serverTime;
    if (!st) return;
    const receivedAt = Date.now();
    const t = setTimeout(() => {
      const skew = Date.parse(st) - receivedAt;
      if (Number.isFinite(skew)) {
        setSkewMs((cur) => (Math.abs(cur - skew) > 250 ? skew : cur));
      }
    }, 0);
    return () => clearTimeout(t);
  }, [state]);

  const slides = useMemo(
    () => [...initial.deck.slides].sort((a, b) => a.position - b.position),
    [initial.deck.slides],
  );
  const idx = slides.length > 0 ? Math.min(Math.max(0, s.currentSlideIndex), slides.length - 1) : 0;
  const slide = slides[idx] as (typeof slides)[number] | undefined;

  // ----- results plumbing (stage is the ONLY poller; rebroadcast for audience) -----
  const pollActive =
    !!slide && RESULT_KINDS.has(slide.kind) && s.phase !== 'show' && s.status === 'live';
  const rebroadcast = useCallback(
    (payload: { slideId: string; results: Results }) => broadcast('results', payload),
    [broadcast],
  );
  // Latency HUD (host-only, toggled with 'g'): rolling respond→on-screen lapse.
  const [showLatency, setShowLatency] = useState(false);
  const latencyRef = useRef<{ last: number; avg: number; n: number; e2e?: number }>({
    last: 0,
    avg: 0,
    n: 0,
  });
  const [latency, setLatency] = useState<{ last: number; avg: number; n: number; e2e?: number } | null>(
    null,
  );
  // Reset the rolling latency stats when the slide changes (per-slide readout).
  useEffect(() => {
    latencyRef.current = { last: 0, avg: 0, n: 0 };
    setLatency(null);
  }, [slide?.id]);
  const onLatency = useCallback((sample: LatencySample) => {
    const cur = latencyRef.current;
    const n = cur.n + 1;
    const avg = Math.round(cur.avg + (sample.serverToScreenMs - cur.avg) / n);
    latencyRef.current = { last: sample.serverToScreenMs, avg, n, e2e: sample.endToEndMs };
    setLatency({ ...latencyRef.current });
  }, []);
  const { results, degraded: resultsDegraded } = useResultsPoller(
    sessionId,
    slide?.id ?? null,
    pollActive,
    s.phase === 'open',
    rebroadcast,
    skewMs,
    onLatency,
  );

  // ----- overlays -----
  const [blackout, setBlackout] = useState(false);
  const [spotlight, setSpotlight] = useState(false);
  const [hints, setHints] = useState(false);

  // Leaderboard visibility is tied to a context key (slide + phase + status):
  // any live-state change invalidates the context, so it auto-dismisses on
  // slide/phase changes without extra effects. A presenter dismissal within a
  // context sticks (the auto-open timer won't re-raise it).
  const lbContext = `${slide?.id ?? 'none'}:${s.phase}:${s.status}`;
  const [lb, setLb] = useState<{ ctx: string; open: boolean } | null>(null);
  const lbOpen = lb?.ctx === lbContext && lb.open;
  const toggleLb = useCallback(
    () => setLb((cur) => ({ ctx: lbContext, open: !(cur?.ctx === lbContext && cur.open) })),
    [lbContext],
  );
  const closeLb = useCallback(() => setLb({ ctx: lbContext, open: false }), [lbContext]);

  // Quiz theatrical moment: auto-raise the leaderboard 2.5s after reveal.
  const isQuizReveal = slide?.kind === 'quiz' && s.phase === 'reveal' && s.status === 'live';
  useEffect(() => {
    if (!isQuizReveal) return;
    const ctx = lbContext;
    const t = setTimeout(() => {
      setLb((cur) => (cur?.ctx === ctx ? cur : { ctx, open: true }));
    }, 2500);
    return () => clearTimeout(t);
  }, [isQuizReveal, lbContext]);

  // ----- presenter commands (optimistic; state broadcast reconciles) -----
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 4000);
  }, []);

  const post = useCallback(
    async (
      body: { index?: number; phase?: Phase; status?: SessionStatus },
      optimistic?: Partial<SessionState>,
    ) => {
      if (optimistic) setState((prev) => (prev ? { ...prev, ...optimistic } : prev));
      try {
        await presenterPost(`/api/presenter/${sessionId}/advance`, presenterKey, body);
      } catch {
        showToast('Command failed — retrying sync');
        void resync();
      }
    },
    [sessionId, presenterKey, setState, resync, showToast],
  );

  const goTo = useCallback(
    (index: number) => {
      if (slides.length === 0) return;
      const next = Math.min(Math.max(0, index), slides.length - 1);
      if (s.status === 'lobby') {
        void post(
          { status: 'live', index: 0 },
          { status: 'live', currentSlideIndex: 0, phase: 'show', phaseOpenedAt: null },
        );
        return;
      }
      if (next === idx) return;
      void post({ index: next }, { currentSlideIndex: next, phase: 'show', phaseOpenedAt: null });
    },
    [slides.length, s.status, idx, post],
  );

  const setPhase = useCallback(
    (phase: Phase) => {
      if (!slide || !isInteractiveKind(slide.kind) || s.status !== 'live') return;
      if (phase === s.phase) return;
      void post(
        { phase },
        {
          phase,
          phaseOpenedAt:
            phase === 'open' ? new Date(Date.now() + skewMs).toISOString() : s.phaseOpenedAt,
        },
      );
    },
    [slide, s.status, s.phase, s.phaseOpenedAt, post, skewMs],
  );

  // ----- quiz auto-close at 0:00 (server-authoritative; quiz slides only) -----
  // Fires exactly once per slide (ref-guarded). Harmless if the remote already
  // closed — the advance route is idempotent and the phase check re-verifies at
  // fire time via stateRef. Polls stay presenter-controlled.
  const stateRef = useRef(s);
  stateRef.current = s;
  const autoClosedRef = useRef<string | null>(null);
  const [timesUp, setTimesUp] = useState(false);
  const timesUpTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(timesUpTimer.current), []);

  const quizTimerArmed =
    !!slide &&
    slide.kind === 'quiz' &&
    s.status === 'live' &&
    s.phase === 'open' &&
    !!s.phaseOpenedAt;
  const quizLimitSec = slide?.kind === 'quiz' ? (slide.settings.timeLimitSec ?? 30) : 0;

  useEffect(() => {
    if (!quizTimerArmed || !slide || quizLimitSec <= 0 || !s.phaseOpenedAt) return;
    const slideId = slide.id;
    if (autoClosedRef.current === slideId) return;
    const endMs = Date.parse(s.phaseOpenedAt) + quizLimitSec * 1000;
    if (!Number.isFinite(endMs)) return;
    const wait = Math.max(0, endMs - (Date.now() + skewMs));
    const t = window.setTimeout(() => {
      // Re-verify at fire time: still this slide, still open, not already fired.
      if (autoClosedRef.current === slideId) return;
      if (stateRef.current.phase !== 'open' || stateRef.current.status !== 'live') return;
      autoClosedRef.current = slideId;
      setTimesUp(true);
      window.clearTimeout(timesUpTimer.current);
      timesUpTimer.current = window.setTimeout(() => setTimesUp(false), 1200);
      void post({ phase: 'closed' }, { phase: 'closed' });
    }, wait);
    return () => window.clearTimeout(t);
  }, [quizTimerArmed, slide, quizLimitSec, s.phaseOpenedAt, skewMs, post]);

  // ----- keyboard control -----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          goTo(idx + 1);
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          goTo(idx - 1);
          break;
        case 'o':
        case 'O':
          setPhase('open');
          break;
        case 'c':
        case 'C':
          setPhase('closed');
          break;
        case 'r':
        case 'R':
          setPhase('reveal');
          break;
        case 'b':
        case 'B':
          setBlackout((v) => !v);
          break;
        case 'q':
        case 'Q':
          setSpotlight((v) => !v);
          break;
        case 'l':
        case 'L':
          toggleLb();
          break;
        case 'g':
        case 'G':
          setShowLatency((v) => !v);
          break;
        case 'm':
        case 'M':
          setShowMood((v) => !v);
          break;
        case 'f':
        case 'F':
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen().catch(() => undefined);
          break;
        case '?':
          setHints((v) => !v);
          break;
        case 'Escape':
          // Dismiss topmost overlay first
          if (blackout) setBlackout(false);
          else if (lbOpen) closeLb();
          else if (spotlight) setSpotlight(false);
          else if (hints) setHints(false);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, setPhase, idx, blackout, lbOpen, spotlight, hints, toggleLb, closeLb]);

  // ----- idle detection: chrome shrinks on content slides after 5s -----
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t = 0;
    const reset = () => {
      setIdle(false);
      window.clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), 5000);
    };
    reset();
    window.addEventListener('pointermove', reset);
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointermove', reset);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, []);

  const deckTitle = initial.deck.title || 'PulseDeck';
  const mini = slide != null && !isInteractiveKind(slide.kind) && idle;
  // Per-deck theme pack skins the whole projected show (palette + gradient
  // surface). 'ice' / unset = default tokens (no attribute).
  const pack = initial.deck.theme?.pack;
  const deckTheme = pack && pack !== 'ice' ? pack : undefined;

  return (
    <div
      data-theme={deckTheme}
      className="fixed inset-0 select-none overflow-hidden bg-ink text-fg">
      {s.status === 'lobby' && (
        <Lobby
          sessionId={sessionId}
          code={initial.code}
          deckTitle={deckTitle}
          connected={connected}
          logoUrl={initial.deck.theme?.logoUrl}
          orgName={initial.deck.theme?.orgName}
        />
      )}

      {s.status === 'ended' && <EndedScreen sessionId={sessionId} deckTitle={deckTitle} />}

      {s.status === 'live' &&
        (slides.length === 0 || !slide ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-[8vw] text-center">
            <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold text-fg">This deck has no slides</h1>
            <p className="text-xl text-fg-dim">Add slides in the studio, then come back to the stage.</p>
          </div>
        ) : (
          <>
            <SlideRenderer
              key={slide.id}
              slide={slide}
              theme={initial.deck.theme}
              phase={s.phase}
              phaseOpenedAt={s.phaseOpenedAt ?? null}
              results={results}
              resultsDegraded={resultsDegraded}
              code={initial.code}
              skewMs={skewMs}
              sessionId={sessionId}
              qaBump={qaBump}
            />
            <StageChrome
              sessionId={sessionId}
              code={initial.code}
              connected={connected}
              index={idx}
              total={slides.length}
              mini={!!mini}
            />
          </>
        ))}

      {/* Persistent polite live region: the "Time's up!" flash is announced
          reliably because the region exists before the message appears. */}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 top-0 z-[65]">
        {timesUp && (
          <>
            <style>{`@keyframes pd-times-up { from { opacity: 0; transform: translateY(-40%); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <div
              className="flex w-full items-center justify-center gap-3 border-b border-amber/60 bg-amber px-6 py-4 text-center text-[clamp(1.4rem,2.6vw,2.2rem)] font-bold text-ink shadow-lg"
              style={{ animation: 'pd-times-up 180ms ease-out' }}
            >
              Time&rsquo;s up!
            </div>
          </>
        )}
      </div>

      <ReactionsOverlay ref={reactionsRef} />

      {/* Auto-surface on any raised hand, or on a burst of pace signals (≥2 in
          the 30s window) so a room going "🐢/🤔" reaches the host without them
          having to press M. The host can still toggle manually with M. */}
      {(showMood || mood.hands > 0 || mood.total >= 2) && (
        <SignalMood counts={mood.counts} hands={mood.hands} onDismiss={() => setShowMood(false)} />
      )}

      {lbOpen && <Leaderboard sessionId={sessionId} onDismiss={closeLb} />}
      {spotlight && <QrSpotlight code={initial.code} onDismiss={() => setSpotlight(false)} />}
      {hints && <HintBar onDismiss={() => setHints(false)} />}
      {blackout && <Blackout onDismiss={() => setBlackout(false)} />}

      {/* Response-latency HUD — host-only diagnostic (press G). Shows how long it
          takes an audience response to appear on this screen. */}
      {showLatency && (
        <div className="fixed bottom-6 right-6 z-[70] rounded-xl border border-edge bg-panel/95 px-4 py-3 font-mono text-xs text-fg shadow-pop backdrop-blur">
          <div className="mb-1 flex items-center justify-between gap-4 font-sans text-[11px] font-semibold uppercase tracking-wider text-fg-dim">
            <span>Response latency</span>
            <button
              type="button"
              onClick={() => setShowLatency(false)}
              className="text-fg-dim hover:text-fg"
              aria-label="Close latency readout"
            >
              ✕
            </button>
          </div>
          {latency && latency.n > 0 ? (
            <div className="space-y-0.5">
              <div>
                respond→screen: <span className="font-semibold text-accent">{latency.last}ms</span>
              </div>
              <div className="text-fg-dim">
                avg {latency.avg}ms · {latency.n} sample{latency.n === 1 ? '' : 's'}
              </div>
              {latency.e2e != null && (
                <div className="text-fg-dim">tap→screen ≈ {latency.e2e}ms</div>
              )}
            </div>
          ) : (
            <div className="text-fg-dim">
              {pollActive ? 'Waiting for a response…' : 'Open voting on an activity slide.'}
            </div>
          )}
        </div>
      )}

      {toast && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-8 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-amber/50 bg-panel px-6 py-3 text-base font-semibold text-fg shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
