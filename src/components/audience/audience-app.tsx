'use client';
// The audience phone app shell: join flow → nickname → live session.
// 300 strangers' phones, one bar of LTE, three seconds of patience.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DeckSnapshot, Phase, Results, SessionState, Slide } from '@/lib/types';
import { getSavedNickname, useParticipant } from '@/hooks/use-participant';
import { useSessionChannel } from '@/hooks/use-session-channel';
import { rpc } from '@/lib/supabase/client';
import { Button, Card, JoinCode, Spinner } from '@/components/shared/ui';
import { avatarFor, PrivacyBadge, ShieldIcon } from './bits';
import { NicknameScreen } from './nickname-screen';
import { TopBar } from './top-bar';
import { Activity } from './activity';
import { QaSheet } from './qa-sheet';
import { ReactionsBar } from './reactions-bar';
import { SignalBar } from './signal-bar';
import { useAudiencePrefs } from './prefs';
import { downloadCertificate } from './certificate';

// Exact error strings produced by useParticipant (it collapses server codes).
const ERR_NOT_FOUND = 'No live session found for that code.';
const ERR_CONN = 'Connection problem — try again.';

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 text-center">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

export function AudienceApp({ code }: { code: string }) {
  const router = useRouter();
  const { join, joining, error, doJoin, deviceKey } = useParticipant(code || null);
  const [mounted, setMounted] = useState(false);
  const lastNick = useRef<string>('');

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!lastNick.current) lastNick.current = getSavedNickname();
  }, []);

  const handleJoin = useCallback(
    (nickname: string) => {
      lastNick.current = nickname;
      void doJoin(nickname);
    },
    [doJoin],
  );

  const retry = useCallback(() => {
    const nick = lastNick.current || getSavedNickname() || 'Guest';
    void doJoin(nick);
  }, [doJoin]);

  if (!code) {
    return (
      <FullScreen>
        <h1 className="mb-2 text-2xl font-bold text-fg">That link looks off</h1>
        <p className="mb-6 text-sm text-fg-dim">Join codes are 6 letters and numbers.</p>
        <Button size="lg" className="w-full" onClick={() => router.push('/j')}>
          Enter a code
        </Button>
      </FullScreen>
    );
  }

  // Neutral first paint (avoids a hydration flash before localStorage is readable).
  if (!mounted) {
    return (
      <FullScreen>
        <Spinner className="mx-auto h-7 w-7" />
      </FullScreen>
    );
  }

  if (join?.ok && join.session && join.participant) {
    return (
      <LiveSession
        key={join.session.id}
        session={join.session}
        participant={join.participant}
        deviceKey={deviceKey}
      />
    );
  }

  if (joining) {
    return (
      <FullScreen>
        <Spinner className="mx-auto mb-4 h-7 w-7" />
        <p role="status" aria-live="polite" className="text-sm text-fg-dim">
          Joining <JoinCode code={code} className="text-sm" />…
        </p>
      </FullScreen>
    );
  }

  if (error === ERR_NOT_FOUND) {
    return (
      <FullScreen>
        <p className="mb-3 font-mono text-3xl font-bold tracking-[0.25em] text-cyan">{code}</p>
        <h1 className="mb-2 text-2xl font-bold text-fg">No live session for this code</h1>
        <p className="mb-6 text-sm text-fg-dim">
          Double-check the code on the big screen — sessions also close when the presenter ends
          them.
        </p>
        <div className="flex flex-col gap-3">
          <Button size="lg" className="w-full" onClick={() => router.push(`/j?bad=${code}`)}>
            Try a different code
          </Button>
          <Button variant="secondary" size="lg" className="w-full" onClick={retry}>
            Check again
          </Button>
        </div>
      </FullScreen>
    );
  }

  if (error === ERR_CONN) {
    return (
      <FullScreen>
        <h1 className="mb-2 text-2xl font-bold text-fg">Connection problem</h1>
        <p className="mb-6 text-sm text-fg-dim">
          Couldn&apos;t reach the session. Check your signal and try again — it usually takes one
          tap.
        </p>
        <Button size="lg" className="w-full" onClick={retry}>
          Try again
        </Button>
      </FullScreen>
    );
  }

  if (error) {
    // useParticipant collapses remaining server codes (e.g. 'locked') into one message.
    return (
      <FullScreen>
        <h1 className="mb-2 text-2xl font-bold text-fg">Couldn&apos;t join this room</h1>
        <p className="mb-6 text-sm text-fg-dim">
          This room may be locked by the presenter. If you were here before, rejoining usually
          works.
        </p>
        <div className="flex flex-col gap-3">
          <Button size="lg" className="w-full" onClick={retry}>
            Try again
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => router.push('/j')}
          >
            Use a different code
          </Button>
        </div>
      </FullScreen>
    );
  }

  return <NicknameScreen code={code} joining={joining} onJoin={handleJoin} />;
}

// ---------------------------------------------------------------------------

// Screen-reader announcements for facilitator-driven changes (new activity /
// phase flips). Polite so it never interrupts the reader mid-sentence; skips
// the initial render since the freshly mounted view already reads naturally.
function LiveAnnouncer({
  slide,
  phase,
  t,
}: {
  slide: Slide | null;
  phase: Phase;
  t: (k: 'newActivity' | 'responsesOpen' | 'resultsShown' | 'responsesClosed') => string;
}) {
  const [msg, setMsg] = useState('');
  const prev = useRef<{ slideId: string | null; phase: Phase | null }>({
    slideId: null,
    phase: null,
  });
  useEffect(() => {
    const p = prev.current;
    prev.current = { slideId: slide?.id ?? null, phase };
    if (!slide || p.slideId === null) return; // initial render — nothing to announce
    if (slide.id !== p.slideId) {
      setMsg(slide.title ? `${t('newActivity')}: ${slide.title}` : t('newActivity'));
      return;
    }
    if (phase !== p.phase) {
      if (phase === 'open') setMsg(t('responsesOpen'));
      else if (phase === 'reveal') setMsg(t('resultsShown'));
      else if (phase === 'closed') setMsg(t('responsesClosed'));
    }
  }, [slide, phase, t]);
  return (
    <div aria-live="polite" role="status" className="sr-only">
      {msg}
    </div>
  );
}

function LiveSession({
  session,
  participant,
  deviceKey,
}: {
  session: SessionState & { code: string; deck: DeckSnapshot };
  participant: { id: string; nickname: string; score: number };
  deviceKey: string;
}) {
  const deck = session.deck;
  const brand = {
    logoUrl: deck.theme?.logoUrl,
    orgName: deck.theme?.orgName,
    accent: deck.theme?.accent,
  };
  const initialState: SessionState = {
    id: session.id,
    status: session.status,
    currentSlideIndex: session.currentSlideIndex,
    phase: session.phase,
    phaseOpenedAt: session.phaseOpenedAt ?? null,
    settings: session.settings ?? {},
  };

  const [qaBump, setQaBump] = useState(0);
  const onQaBump = useCallback(() => setQaBump((b) => b + 1), []);
  // Live results the stage rebroadcasts for the current slide (for "results on my phone").
  const [liveResults, setLiveResults] = useState<{ slideId: string; results: Results } | null>(
    null,
  );
  const onResults = useCallback(
    (p: { slideId: string; results: Results }) => setLiveResults(p),
    [],
  );
  const { state, connected, broadcast, resync } = useSessionChannel(session.id, {
    initialState,
    onQaBump,
    onResults,
  });
  const s = state ?? initialState;

  // Running quiz score/streak (server is authoritative; this is the header display).
  const [score, setScore] = useState(participant.score);
  const [streak, setStreak] = useState(0);
  const [quizRan, setQuizRan] = useState(participant.score > 0);
  const onQuizResult = useCallback((points: number, correct: boolean) => {
    setQuizRan(true);
    setScore((v) => v + points);
    setStreak((v) => (correct ? v + 1 : 0));
  }, []);

  // Best streak this page-life, for the end-of-show recap.
  const [bestStreak, setBestStreak] = useState(0);
  useEffect(() => {
    setBestStreak((b) => Math.max(b, streak));
  }, [streak]);

  // First-join privacy hint (shown once per device).
  const [hint, setHint] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem('pd_hint_seen')) {
        localStorage.setItem('pd_hint_seen', '1');
        setHint(true);
        const t = setTimeout(() => setHint(false), 8000);
        return () => clearTimeout(t);
      }
    } catch {
      /* storage blocked — skip the hint */
    }
  }, []);

  // "Reconnecting" toast only after we've been connected once (no flash on load).
  const everConnected = useRef(false);
  useEffect(() => {
    if (connected) everConnected.current = true;
  }, [connected]);
  const showReconnect = everConnected.current && !connected;

  const resyncCb = useCallback(() => void resync(), [resync]);
  const prefs = useAudiencePrefs();

  if (s.status === 'ended') {
    return (
      <EndedScreen
        sessionId={session.id}
        participantId={participant.id}
        nickname={participant.nickname}
        deckTitle={deck.title || 'PulseDeck session'}
        code={session.code}
        score={score}
        quizRan={quizRan}
        bestStreak={bestStreak}
        brand={brand}
      />
    );
  }

  const slideCount = deck.slides.length;
  const idx = Math.min(Math.max(s.currentSlideIndex, 0), Math.max(slideCount - 1, 0));
  const slide = slideCount > 0 ? deck.slides[idx] : null;
  const qaEnabled = Boolean(s.settings?.qaEnabled);
  const isLive = s.status === 'live';

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        deckTitle={deck.title || 'PulseDeck'}
        code={session.code}
        nickname={participant.nickname}
        participantId={participant.id}
        connected={connected}
        score={score}
        streak={streak}
        showScore={quizRan}
      />

      <LiveAnnouncer slide={isLive ? slide : null} phase={s.phase} t={prefs.t} />

      {showReconnect && (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-12 z-20 border-b border-amber/40 bg-amber/15 px-4 py-2 text-center text-sm font-medium text-fg"
        >
          Reconnecting… you can keep answering.
        </div>
      )}

      {hint && (
        <div className="mx-auto w-full max-w-md px-4 pt-3">
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-xl border border-edge bg-panel px-4 py-3"
          >
            <ShieldIcon className="shrink-0 text-cyan" />
            <p className="flex-1 text-sm text-fg-dim">
              Hi <span className="font-semibold text-fg">{participant.nickname}</span> — only your
              nickname is visible to the room.
            </p>
            <button
              type="button"
              onClick={() => setHint(false)}
              aria-label="Dismiss"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-dim hover:text-fg"
            >
              <span aria-hidden="true" className="text-lg leading-none">×</span>
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-40 pt-5">
        {!isLive ? (
          <section className="flex flex-1 flex-col items-center justify-center py-10 text-center">
            {brand.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt={brand.orgName ? `${brand.orgName} logo` : 'Organizer logo'}
                className="mb-6 max-h-16 max-w-[60%] object-contain"
              />
            )}
            <span className="relative mb-8 flex h-4 w-4" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-60" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald" />
            </span>
            <h1 className="mb-2 text-2xl font-bold text-fg">
              {prefs.t('youreIn')}, {participant.nickname}!
            </h1>
            {brand.orgName && (
              <p className="-mt-1 mb-1 text-sm font-medium text-fg-dim">
                Presented by <span className="font-semibold text-fg">{brand.orgName}</span>
              </p>
            )}
            <p role="status" aria-live="polite" className="mb-8 text-sm text-fg-dim">
              {prefs.t('waiting')}
            </p>
            <PrivacyBadge />
          </section>
        ) : slide ? (
          <Activity
            key={slide.id}
            slide={slide}
            phase={s.phase}
            phaseOpenedAt={s.phaseOpenedAt}
            deckTitle={deck.title || 'PulseDeck'}
            ctx={{
              sessionId: session.id,
              participantId: participant.id,
              deviceKey,
              resync: resyncCb,
            }}
            qaBump={qaBump}
            broadcast={broadcast}
            onQuizResult={onQuizResult}
            results={liveResults?.slideId === slide.id ? liveResults.results : null}
            translate={Boolean(s.settings?.translateEnabled)}
          />
        ) : (
          <section className="flex flex-1 flex-col items-center justify-center py-10 text-center">
            <p className="text-sm text-fg-dim">Nothing to show yet — watch the big screen.</p>
          </section>
        )}
      </main>

      {isLive && slide && slide.kind !== 'qa' && <ReactionsBar broadcast={broadcast} />}
      {isLive && slide && <SignalBar broadcast={broadcast} />}

      {isLive && qaEnabled && slide?.kind !== 'qa' && (
        <QaSheet
          sessionId={session.id}
          participantId={participant.id}
          deviceKey={deviceKey}
          qaBump={qaBump}
          broadcast={broadcast}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

// Server rank payload. `streak` is defensive: get_my_rank currently returns
// only {rank, score} — if the RPC ever grows a streak field we use it, and the
// locally-tracked best streak covers the gap meanwhile.
interface MyRank {
  rank: number;
  score: number;
  streak?: number;
}

function EndedScreen({
  sessionId,
  participantId,
  nickname,
  deckTitle,
  code,
  score,
  quizRan,
  bestStreak,
  brand,
}: {
  sessionId: string;
  participantId: string;
  nickname: string;
  deckTitle: string;
  code: string;
  score: number;
  quizRan: boolean;
  bestStreak: number;
  brand: { logoUrl?: string; orgName?: string; accent?: string };
}) {
  const router = useRouter();
  const [certBusy, setCertBusy] = useState(false);
  const getCertificate = async () => {
    setCertBusy(true);
    try {
      const dateStr = new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      await downloadCertificate({
        name: nickname,
        deckTitle,
        code,
        dateStr,
        orgName: brand.orgName,
        logoUrl: brand.logoUrl,
        accent: brand.accent,
      });
    } finally {
      setCertBusy(false);
    }
  };
  const [rank, setRank] = useState<{ rank: number } | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [serverStreak, setServerStreak] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const [mine, count] = await Promise.all([
          quizRan
            ? rpc<MyRank | null>('get_my_rank', {
                p_session_id: sessionId,
                p_participant_id: participantId,
              })
            : Promise.resolve(null),
          rpc<number>('get_participant_count', { p_session_id: sessionId }),
        ]);
        if (stop) return;
        if (typeof count === 'number' && count > 0) setTotal(count);
        if (mine && typeof mine.rank === 'number') {
          setRank({ rank: mine.rank });
          if (typeof mine.streak === 'number') setServerStreak(mine.streak);
        }
      } catch {
        /* recap extras are a nice-to-have on the way out */
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [quizRan, sessionId, participantId]);

  const streakBest = Math.max(bestStreak, serverStreak ?? 0);

  return (
    <FullScreen>
      <style>{`
        @keyframes pd-shine {
          from { transform: translateX(-160%) skewX(-12deg); }
          to { transform: translateX(240%) skewX(-12deg); }
        }
        .pd-recap-shine { position: relative; overflow: hidden; }
        .pd-recap-shine::after {
          content: '';
          position: absolute;
          top: 0; bottom: 0; left: 0;
          width: 55%;
          background: linear-gradient(
            100deg,
            transparent 15%,
            color-mix(in srgb, var(--color-accent) 16%, transparent) 50%,
            transparent 85%
          );
          transform: translateX(-160%) skewX(-12deg);
          animation: pd-shine 1.3s ease-out 0.4s 1 forwards;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .pd-recap-shine::after { animation: none; opacity: 0; }
        }
      `}</style>

      <p className="mb-3 text-4xl" aria-hidden="true">🎉</p>
      <h1 className="mb-2 text-2xl font-bold text-fg">That&apos;s a wrap!</h1>
      <p className="mb-6 text-sm text-fg-dim">What a session, {nickname}.</p>

      <Card className="pd-recap-shine mb-5 px-5 py-6 text-center">
        <span
          role="img"
          aria-label="Your avatar"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-edge bg-panel-2 text-3xl"
        >
          {avatarFor(participantId)}
        </span>
        <p className="mt-2.5 text-base font-semibold text-fg">{nickname}</p>

        {quizRan ? (
          <>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-fg-dim">
                Final score
              </p>
              <p className="mt-1 font-mono text-4xl font-bold text-fg tabular-nums">
                {score.toLocaleString()}
              </p>
            </div>
            <div className="mt-2 text-sm text-fg-dim" aria-live="polite">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="h-4 w-4" /> Fetching your final rank…
                </span>
              ) : rank ? (
                <span className="text-base font-semibold text-fg">
                  You finished <span className="text-cyan">#{rank.rank}</span>
                  {total !== null && <span className="text-fg-dim"> of {total}</span>}
                </span>
              ) : (
                'Nice run — the podium is on the big screen.'
              )}
            </div>
            {streakBest > 1 && (
              <p className="mt-2 text-sm font-semibold text-fg">
                <span aria-hidden="true">🔥</span> Best streak: {streakBest} in a row
              </p>
            )}
          </>
        ) : (
          <div className="mt-4 text-sm text-fg-dim" aria-live="polite">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="h-4 w-4" /> Wrapping up…
              </span>
            ) : total !== null ? (
              <span>
                You were one of{' '}
                <span className="font-semibold text-fg">{total.toLocaleString()}</span> people in
                the room.
              </span>
            ) : (
              'Hope you enjoyed the show.'
            )}
          </div>
        )}
      </Card>

      <p className="mb-5 text-sm text-fg-dim">Thanks for being part of the show.</p>

      <Button size="lg" className="mb-3 w-full" onClick={getCertificate} disabled={certBusy}>
        {certBusy ? 'Preparing…' : '🎓 Download certificate'}
      </Button>
      <Button variant="secondary" size="lg" className="w-full" onClick={() => router.push('/j')}>
        Join another session
      </Button>
    </FullScreen>
  );
}
