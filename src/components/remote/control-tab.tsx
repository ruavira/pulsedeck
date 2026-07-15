'use client';
// The main show-control surface: current slide card, next-slide preview,
// contextual phase action (open/close/reveal), giant prev/next row, panic bar
// and rehearsal card. One-handed: primary actions at the bottom, all ≥56px.

import { useEffect, useState } from 'react';
import { Card, Pill } from '@/components/shared/ui';
import { isInteractiveKind } from '@/lib/types';
import type { Phase, SessionState, Slide } from '@/lib/types';
import {
  INTERACTIVE_KINDS,
  KIND_LABELS,
  PHASE_LABELS,
  type PresenterSession,
  type RemoteAdvance,
  type RemoteUpdateSettings,
} from './remote-types';
import { useResponseTotal } from './use-remote-polls';
import { PanicBar } from './panic-bar';
import { RehearsalCard } from './rehearsal-card';

// ---------- giant contextual action button ----------

type ActionTone = 'accent' | 'amber' | 'emerald';
const toneStyles: Record<ActionTone, string> = {
  accent: 'bg-accent text-white shadow-accent-glow',
  amber: 'bg-amber text-ink',
  emerald: 'bg-emerald text-ink',
};

function BigAction({
  label,
  sub,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  sub?: string;
  tone: ActionTone;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[72px] w-full flex-col items-center justify-center gap-0.5 rounded-2xl px-6 text-xl font-bold transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 hover:brightness-110 ${toneStyles[tone]}`}
    >
      <span>{label}</span>
      {sub && <span className="text-sm font-semibold opacity-80">{sub}</span>}
    </button>
  );
}

// ---------- quiz countdown (client clock vs phase_opened_at) ----------

function useQuizCountdown(
  isQuiz: boolean,
  phase: Phase,
  phaseOpenedAt: string | null | undefined,
  timeLimitSec: number,
): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!isQuiz || phase !== 'open' || !phaseOpenedAt) {
      setRemaining(null);
      return;
    }
    const deadline = Date.parse(phaseOpenedAt) + timeLimitSec * 1000;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [isQuiz, phase, phaseOpenedAt, timeLimitSec]);

  return remaining;
}

// ---------- slide cards ----------

function CurrentSlideCard({
  slide,
  index,
  total,
  phase,
  responseTotal,
}: {
  slide: Slide;
  index: number;
  total: number;
  phase: Phase;
  responseTotal: number | null;
}) {
  const interactive = INTERACTIVE_KINDS.has(slide.kind);
  const phaseTone =
    phase === 'open' ? 'live' : phase === 'reveal' ? 'accent' : 'dim';

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-dim">
          Slide {index + 1} of {total}
        </span>
        <div className="flex items-center gap-1.5">
          <Pill tone={isInteractiveKind(slide.kind) ? 'accent' : 'dim'}>
            {KIND_LABELS[slide.kind]}
          </Pill>
          {interactive && <Pill tone={phaseTone}>{PHASE_LABELS[phase]}</Pill>}
        </div>
      </div>
      <h2 className="mt-2 text-lg font-bold leading-snug text-fg">
        {slide.title || slide.body.prompt || 'Untitled slide'}
      </h2>
      {interactive && slide.body.prompt && slide.title && (
        <p className="mt-1 text-sm text-fg-dim">{slide.body.prompt}</p>
      )}
      {interactive && phase !== 'show' && (
        <p aria-live="polite" className="mt-2 text-sm font-semibold text-cyan tabular-nums">
          {responseTotal === null
            ? 'Counting responses…'
            : `${responseTotal} ${responseTotal === 1 ? 'response' : 'responses'}`}
        </p>
      )}
      {slide.settings.notes?.trim() && (
        <div className="mt-3 rounded-lg border border-edge bg-panel-2/60 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-dim">
            Speaker notes
          </span>
          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-snug text-fg">
            {slide.settings.notes}
          </p>
        </div>
      )}
    </Card>
  );
}

function NextSlideStrip({ next }: { next: Slide | undefined }) {
  return (
    <div className="flex min-h-[48px] items-center gap-3 rounded-xl border border-edge bg-panel-2/60 px-4 py-2.5">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-fg-dim">
        Up next
      </span>
      {next ? (
        <>
          <Pill tone="dim" className="shrink-0">
            {KIND_LABELS[next.kind]}
          </Pill>
          <span className="truncate text-sm text-fg">
            {next.title || next.body.prompt || 'Untitled slide'}
          </span>
        </>
      ) : (
        <span className="text-sm text-fg-dim">End of deck — this is the last slide</span>
      )}
    </div>
  );
}

// ---------- phase controls ----------

function PhaseControls({
  slide,
  state,
  busy,
  advance,
}: {
  slide: Slide;
  state: SessionState;
  busy: string | null;
  advance: RemoteAdvance;
}) {
  const isQuiz = slide.kind === 'quiz';
  const timeLimit = slide.settings.timeLimitSec ?? 30;
  const remaining = useQuizCountdown(isQuiz, state.phase, state.phaseOpenedAt, timeLimit);
  const inFlight = busy !== null;

  const setPhase = (phase: Phase) =>
    void advance('phase', { phase }, { phase, ...(phase === 'open' ? { phaseOpenedAt: new Date().toISOString() } : {}) });

  if (slide.kind === 'qa') {
    return (
      <Card className="p-4 text-sm text-fg-dim">
        The Q&amp;A wall is live on the stage screen. Moderate questions from the{' '}
        <span className="font-semibold text-fg">Q&amp;A tab</span> below.
      </Card>
    );
  }
  if (slide.kind === 'timer' || slide.kind === 'breathing') {
    return (
      <Card className="p-4 text-sm text-fg-dim">
        {slide.kind === 'timer'
          ? 'The countdown runs by itself on the stage screen — no voting to open. '
          : 'The breathing exercise runs by itself on the stage screen — no voting to open. '}
        Tap <span className="font-semibold text-fg">Next</span> when the room is ready to move on.
      </Card>
    );
  }
  // Non-interactive kinds (content) have no phases at all.
  if (!INTERACTIVE_KINDS.has(slide.kind)) return null;

  switch (state.phase) {
    case 'show':
      return (
        <BigAction
          label="Open voting"
          sub={isQuiz ? `Quiz · ${timeLimit}s timer starts` : undefined}
          tone="accent"
          disabled={inFlight}
          onClick={() => setPhase('open')}
        />
      );
    case 'open':
      return (
        <BigAction
          label="Close voting"
          sub={
            isQuiz
              ? remaining !== null && remaining > 0
                ? `${remaining}s left on the clock`
                : "Time's up"
              : 'Responses are coming in'
          }
          tone="amber"
          disabled={inFlight}
          onClick={() => setPhase('closed')}
        />
      );
    case 'closed':
      return (
        <div className="flex flex-col gap-2">
          <BigAction
            label="Reveal results"
            tone="emerald"
            disabled={inFlight}
            onClick={() => setPhase('reveal')}
          />
          <button
            type="button"
            disabled={inFlight}
            onClick={() => setPhase('open')}
            className="min-h-[44px] rounded-full text-sm font-semibold text-fg-dim transition-colors hover:text-fg disabled:opacity-40"
          >
            Reopen voting
          </button>
        </div>
      );
    case 'reveal':
      return (
        <div className="flex flex-col gap-2">
          <Card className="p-4">
            <p className="text-sm font-semibold text-fg">Results are on stage</p>
            {isQuiz && (
              <p className="mt-1 text-sm text-fg-dim">
                Show the leaderboard: press{' '}
                <kbd className="rounded border border-edge bg-panel-2 px-1.5 py-0.5 font-mono text-xs text-cyan">
                  L
                </kbd>{' '}
                on the stage keyboard.
              </p>
            )}
          </Card>
          <button
            type="button"
            disabled={inFlight}
            onClick={() => setPhase('open')}
            className="min-h-[44px] rounded-full text-sm font-semibold text-fg-dim transition-colors hover:text-fg disabled:opacity-40"
          >
            Reopen voting
          </button>
        </div>
      );
  }
}

// ---------- the tab ----------

export function ControlTab({
  session,
  state,
  busy,
  extrasOpen,
  advance,
  updateSettings,
  simulate,
}: {
  session: PresenterSession;
  state: SessionState;
  busy: string | null;
  extrasOpen: boolean;
  advance: RemoteAdvance;
  updateSettings: RemoteUpdateSettings;
  simulate: (n: number) => Promise<number | null>;
}) {
  const slides = session.deck.slides;
  const idx = Math.max(0, Math.min(state.currentSlideIndex, slides.length - 1));
  const slide = slides[idx];
  const next = slides[idx + 1];
  const interactive = slide ? INTERACTIVE_KINDS.has(slide.kind) : false;

  const responseTotal = useResponseTotal(
    session.id,
    slide && interactive && state.status === 'live' && state.phase !== 'show'
      ? slide.id
      : null,
    state.phase === 'open',
  );

  // ----- lobby: start the show + rehearsal -----
  if (state.status === 'lobby') {
    return (
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <p className="text-sm font-semibold text-fg">Waiting in the lobby</p>
          <p className="mt-1 text-sm leading-relaxed text-fg-dim">
            Your audience joins with the code above. When the room looks full enough,
            start the show — the stage follows instantly.
          </p>
        </Card>
        <RehearsalCard busy={busy} simulate={simulate} />
        <BigAction
          label="Start the show"
          sub={`${slides.length} ${slides.length === 1 ? 'slide' : 'slides'} ready`}
          tone="accent"
          disabled={busy !== null || slides.length === 0}
          onClick={() => void advance('start', { status: 'live' }, { status: 'live' })}
        />
        {slides.length === 0 && (
          <p className="text-center text-sm text-red" role="alert">
            This deck has no slides — add slides in the studio before starting.
          </p>
        )}
      </div>
    );
  }

  if (!slide) {
    return (
      <Card className="p-6 text-center text-sm text-fg-dim">
        No slides in this session.
      </Card>
    );
  }

  const navBusy = busy === 'nav';
  // Mirror the server's auto-open rule in the optimistic update so the phase
  // pill doesn't flash "Open voting" before the broadcast corrects it.
  const AUTO_OPEN = new Set(['poll', 'wordcloud', 'scale', 'ranking', 'open_text']);
  const autoOpenEnabled = state.settings?.autoOpenVoting !== false;
  const goTo = (i: number) => {
    const target = slides[i];
    const opens = !!target && autoOpenEnabled && AUTO_OPEN.has(target.kind);
    void advance(
      'nav',
      { index: i },
      opens
        ? { currentSlideIndex: i, phase: 'open', phaseOpenedAt: new Date().toISOString() }
        : { currentSlideIndex: i, phase: 'show', phaseOpenedAt: null },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <CurrentSlideCard
        slide={slide}
        index={idx}
        total={slides.length}
        phase={state.phase}
        responseTotal={responseTotal}
      />
      <NextSlideStrip next={next} />
      <PhaseControls slide={slide} state={state} busy={busy} advance={advance} />

      {/* giant prev / next — next gets 60% width, 72px tall */}
      <div className="flex gap-3" role="group" aria-label="Slide navigation">
        <button
          type="button"
          onClick={() => goTo(idx - 1)}
          disabled={idx === 0 || navBusy}
          className="flex min-h-[72px] flex-[2] items-center justify-center rounded-2xl border border-edge bg-panel-2 text-lg font-bold text-fg transition-all duration-150 active:scale-[0.98] hover:border-accent/60 disabled:pointer-events-none disabled:opacity-40"
        >
          <span aria-hidden="true" className="mr-2">
            ←
          </span>
          Prev
        </button>
        <button
          type="button"
          onClick={() => goTo(idx + 1)}
          disabled={idx >= slides.length - 1 || navBusy}
          className="flex min-h-[72px] flex-[3] items-center justify-center rounded-2xl bg-accent text-xl font-bold text-white shadow-accent-glow transition-all duration-150 active:scale-[0.98] hover:brightness-110 disabled:pointer-events-none disabled:opacity-40"
        >
          {idx >= slides.length - 1 ? 'Last slide' : 'Next'}
          {idx < slides.length - 1 && (
            <span aria-hidden="true" className="ml-2">
              →
            </span>
          )}
        </button>
      </div>

      <PanicBar state={state} busy={busy} advance={advance} updateSettings={updateSettings} />

      {extrasOpen && <RehearsalCard busy={busy} simulate={simulate} />}
    </div>
  );
}
