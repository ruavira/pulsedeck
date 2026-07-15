'use client';
// "Preview" panel: a static phone-frame mock of what the audience sees for the
// selected slide. Deliberately independent from the real audience components
// (owned by another module) — same design tokens, zero network. The mock is
// decorative (aria-hidden) with an sr-only description alongside, since none of
// the controls inside are real.

import type { CSSProperties } from 'react';
import type { DeckTheme, Slide } from '@/lib/types';
import { IconClose } from './icons';

const SAMPLE_QUESTIONS = [
  { q: 'Audience questions appear here…', v: 8 },
  { q: '…sorted by upvotes', v: 3 },
];

function describe(slide: Slide): string {
  const prompt = slide.body.prompt?.trim();
  switch (slide.kind) {
    case 'content':
      return 'a “look up at the big screen” holding state with emoji reactions.';
    case 'poll':
      return `the poll prompt${prompt ? ` “${prompt}”` : ''} with each option as a tappable button.`;
    case 'quiz':
      return `the timed quiz question${prompt ? ` “${prompt}”` : ''} with answer buttons and a countdown.`;
    case 'wordcloud':
      return `the prompt${prompt ? ` “${prompt}”` : ''} with a text input for submitting words.`;
    case 'scale':
      return `the prompt${prompt ? ` “${prompt}”` : ''} with a slider between ${slide.body.min ?? 1} and ${slide.body.max ?? 5}.`;
    case 'ranking':
      return `the prompt${prompt ? ` “${prompt}”` : ''} with a draggable list to put in order.`;
    case 'open_text':
      return `the prompt${prompt ? ` “${prompt}”` : ''} with a free-text box.`;
    case 'qa':
      return 'a question box plus the list of audience questions with upvote buttons.';
    case 'timer':
      return 'a calm “look up at the big screen” holding state while the countdown runs on stage.';
    case 'breathing':
      return 'a small breathing circle pacing the same inhale, hold and exhale timings as the stage.';
    case 'join':
      return 'a friendly "You\'re in" confirmation — the join ritual is for the big screen.';
  }
}

export function ParticipantPreview({
  slide,
  theme,
  onClose,
}: {
  slide: Slide | null;
  theme: DeckTheme;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-fg">Audience preview</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-fg-dim">
            Static mock of what phones show for this slide — nothing here is live.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close audience preview"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-dim transition-colors hover:bg-panel-2 hover:text-fg"
        >
          <IconClose width={16} height={16} />
        </button>
      </div>

      {slide ? (
        <PhoneFrame slide={slide} theme={theme} />
      ) : (
        <p className="rounded-xl border border-edge bg-panel-2/60 px-4 py-6 text-center text-sm text-fg-dim">
          Select a slide to preview what the audience sees.
        </p>
      )}
    </div>
  );
}

function PhoneFrame({ slide, theme }: { slide: Slide; theme: DeckTheme }) {
  const accent = slide.settings.accent || theme.accent || 'var(--color-accent)';
  return (
    <div className="mx-auto w-full max-w-[310px]" style={{ '--pp-accent': accent } as CSSProperties}>
      <p className="sr-only">Static preview: phones show {describe(slide)}</p>
      <div
        aria-hidden="true"
        className="pointer-events-none select-none overflow-hidden rounded-[2.6rem] border-[6px] border-edge bg-ink shadow-[0_16px_48px_rgba(0,0,0,0.4)]"
      >
        <div className="flex min-h-[560px] flex-col gap-3 px-4 pb-7 pt-3">
          {/* speaker notch */}
          <div className="mx-auto h-1.5 w-16 rounded-full bg-panel-2" />
          {/* audience app header */}
          <div className="flex items-center justify-between text-[11px] text-fg-dim">
            <span className="font-mono font-bold tracking-widest text-cyan">AB12CD</span>
            <span>Alex · 0 pts</span>
          </div>
          <MockBody slide={slide} />
        </div>
      </div>
    </div>
  );
}

// ---------- shared mock primitives ----------

function MockPrompt({ text, fallback }: { text?: string; fallback: string }) {
  return (
    <p className="text-[17px] font-bold leading-snug text-fg">
      {text?.trim() || <span className="text-fg-dim">{fallback}</span>}
    </p>
  );
}

function MockOption({ label, index }: { label: string; index: number }) {
  return (
    <div className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-edge bg-panel px-3.5 py-2.5 text-sm font-medium text-fg">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ backgroundColor: `var(--chart-${(index % 8) + 1})` }}
      >
        {String.fromCharCode(65 + (index % 26))}
      </span>
      <span className="min-w-0 truncate">{label.trim() || `Option ${index + 1}`}</span>
    </div>
  );
}

function MockSubmit({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-[44px] items-center justify-center rounded-full text-[15px] font-semibold text-white"
      style={{ backgroundColor: 'var(--pp-accent)' }}
    >
      {label}
    </div>
  );
}

function MockInput({ placeholder, tall = false }: { placeholder: string; tall?: boolean }) {
  return (
    <div
      className={`w-full rounded-xl border border-edge bg-panel px-3.5 py-3 text-sm text-fg-dim ${
        tall ? 'min-h-[88px]' : 'min-h-[48px]'
      }`}
    >
      {placeholder}
    </div>
  );
}

function MockHint({ text }: { text: string }) {
  return <p className="text-center text-xs text-fg-dim">{text}</p>;
}

// ---------- per-kind bodies ----------

function MockBody({ slide }: { slide: Slide }) {
  switch (slide.kind) {
    case 'content':
      return <ContentMock />;
    case 'poll':
      return <PollMock slide={slide} />;
    case 'quiz':
      return <QuizMock slide={slide} />;
    case 'wordcloud':
      return <WordcloudMock slide={slide} />;
    case 'scale':
      return <ScaleMock slide={slide} />;
    case 'ranking':
      return <RankingMock slide={slide} />;
    case 'open_text':
      return <OpenTextMock slide={slide} />;
    case 'qa':
      return <QaMock />;
    case 'timer':
      return <ContentMock />;
    case 'breathing':
      return <BreathingMock slide={slide} />;
    case 'join':
      return <ContentMock />;
  }
}

function ContentMock() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <span className="text-5xl">👀</span>
      <p className="text-lg font-bold text-fg">Look up!</p>
      <p className="max-w-[210px] text-sm leading-relaxed text-fg-dim">
        The good stuff is on the big screen — this phone will light up on the next activity.
      </p>
      <div className="mt-3 flex gap-2">
        {['👏', '🔥', '❤️', '😂'].map((e) => (
          <span
            key={e}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-edge bg-panel text-lg"
          >
            {e}
          </span>
        ))}
      </div>
    </div>
  );
}

function BreathingMock({ slide }: { slide: Slide }) {
  const rounds = slide.settings.rounds ?? 5;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div
        className="h-24 w-24 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 38%, color-mix(in oklab, var(--pp-accent) 80%, var(--color-fg) 8%) 0%, color-mix(in oklab, var(--pp-accent) 45%, transparent) 55%, transparent 100%)',
        }}
      />
      <p className="text-lg font-bold text-fg">Breathe in</p>
      <p className="text-xs tabular-nums text-fg-dim">round 1 of {rounds}</p>
      {slide.body.prompt?.trim() && (
        <p className="max-w-[210px] text-sm leading-relaxed text-fg-dim">{slide.body.prompt}</p>
      )}
    </div>
  );
}

function PollMock({ slide }: { slide: Slide }) {
  const options = slide.body.options ?? [];
  const multi = slide.settings.multiSelect ?? false;
  return (
    <div className="flex flex-1 flex-col gap-2.5">
      <MockPrompt text={slide.body.prompt} fallback="Your poll prompt appears here" />
      {options.length === 0 ? (
        <p className="text-sm text-fg-dim">Add options in the inspector to see them here.</p>
      ) : (
        options.map((o, i) => <MockOption key={i} label={o} index={i} />)
      )}
      {multi && <MockSubmit label="Send votes" />}
      <MockHint text={multi ? 'Pick one or more, then send' : 'Tap an option to vote'} />
    </div>
  );
}

function QuizMock({ slide }: { slide: Slide }) {
  const options = slide.body.options ?? [];
  return (
    <div className="flex flex-1 flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="rounded-full border border-amber/40 bg-amber/10 px-2.5 py-1 text-xs font-bold tabular-nums text-amber">
          {slide.settings.timeLimitSec ?? 30}s
        </span>
        <span className="text-xs font-semibold text-fg-dim">{slide.settings.points ?? 1000} pts</span>
      </div>
      <MockPrompt text={slide.body.prompt} fallback="Your quiz question appears here" />
      {options.length === 0 ? (
        <p className="text-sm text-fg-dim">Add answers in the inspector to see them here.</p>
      ) : (
        options.map((o, i) => <MockOption key={i} label={o} index={i} />)
      )}
      <MockHint text="Tap to answer — correct answers score" />
    </div>
  );
}

function WordcloudMock({ slide }: { slide: Slide }) {
  const max = slide.settings.maxWords ?? 3;
  return (
    <div className="flex flex-1 flex-col gap-2.5">
      <MockPrompt text={slide.body.prompt} fallback="Your word cloud prompt appears here" />
      <MockInput placeholder="Type a word…" />
      <MockSubmit label="Send" />
      <MockHint text={`Up to ${max} word${max === 1 ? '' : 's'} per person`} />
    </div>
  );
}

function ScaleMock({ slide }: { slide: Slide }) {
  const min = slide.body.min ?? 1;
  const max = slide.body.max ?? 5;
  return (
    <div className="flex flex-1 flex-col gap-3">
      <MockPrompt text={slide.body.prompt} fallback="Your scale prompt appears here" />
      <div className="mt-4">
        <div className="relative h-2 rounded-full bg-panel">
          <div
            className="absolute left-0 top-0 h-full rounded-full opacity-80"
            style={{ width: '55%', backgroundColor: 'var(--pp-accent)' }}
          />
          <div
            className="absolute top-1/2 h-7 w-7 rounded-full border-4 border-ink"
            style={{ left: '55%', transform: 'translate(-50%, -50%)', backgroundColor: 'var(--pp-accent)' }}
          />
        </div>
        <div className="mt-2.5 flex justify-between text-xs text-fg-dim">
          <span>
            {min}
            {slide.body.minLabel ? ` · ${slide.body.minLabel}` : ''}
          </span>
          <span>
            {slide.body.maxLabel ? `${slide.body.maxLabel} · ` : ''}
            {max}
          </span>
        </div>
      </div>
      <MockSubmit label="Send" />
      <MockHint text="Drag the slider, then send" />
    </div>
  );
}

function RankingMock({ slide }: { slide: Slide }) {
  const options = slide.body.options ?? [];
  return (
    <div className="flex flex-1 flex-col gap-2.5">
      <MockPrompt text={slide.body.prompt} fallback="Your ranking prompt appears here" />
      {options.length === 0 ? (
        <p className="text-sm text-fg-dim">Add items in the inspector to see them here.</p>
      ) : (
        options.map((o, i) => (
          <div
            key={i}
            className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-edge bg-panel px-3.5 py-2.5 text-sm font-medium text-fg"
          >
            <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--pp-accent)' }}>
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate">{o.trim() || `Item ${i + 1}`}</span>
            <span className="text-fg-dim">⠿</span>
          </div>
        ))
      )}
      <MockSubmit label="Submit order" />
      <MockHint text="Drag into order, then submit" />
    </div>
  );
}

function OpenTextMock({ slide }: { slide: Slide }) {
  return (
    <div className="flex flex-1 flex-col gap-2.5">
      <MockPrompt text={slide.body.prompt} fallback="Your open text prompt appears here" />
      <MockInput placeholder="Type your answer…" tall />
      <MockSubmit label="Send" />
      <MockHint text="Answers appear on the wall on stage" />
    </div>
  );
}

function QaMock() {
  return (
    <div className="flex flex-1 flex-col gap-2.5">
      <MockPrompt text="Q&A" fallback="Q&A" />
      <MockInput placeholder="Ask a question…" />
      <MockSubmit label="Submit question" />
      <div className="mt-1 space-y-2">
        {SAMPLE_QUESTIONS.map(({ q, v }) => (
          <div key={q} className="flex items-center gap-2.5 rounded-xl border border-edge bg-panel px-3 py-2.5">
            <span className="flex flex-col items-center text-[11px] font-bold text-cyan">
              ▲<span className="tabular-nums">{v}</span>
            </span>
            <span className="text-sm text-fg/90">{q}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
