'use client';
// Small shared audience-app pieces: prompts, status notes, option rows, error copy.
// Kept tiny and dependency-free — this module ships to 300 phones on one bar of LTE.

import { Button } from '@/components/shared/ui';

/** A = 0, B = 1 … for option letter prefixes. */
export const letterFor = (i: number) => String.fromCharCode(65 + (i % 26));

/** 24 fun avatar emojis — animals/objects only, no faces or skin tones. */
const AVATARS = [
  '🦊', '🦉', '🚀', '⚡', '🌊', '🍁', '🐢', '🦋',
  '🐙', '🦜', '🌵', '🎈', '🪐', '🌙', '🔥', '🍀',
  '🐝', '🦄', '🎧', '🧭', '🪁', '🎲', '🍉', '🌈',
] as const;

/** Deterministic fun avatar for a participant id (simple char-code sum hash). */
export function avatarFor(id: string): string {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return AVATARS[sum % AVATARS.length];
}

/**
 * Haptic tap — progressive enhancement only. No-ops on iOS Safari (no vibrate
 * API) and anywhere the call throws (e.g. permissions policies).
 */
export function haptic(ms: number): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(ms);
    }
  } catch {
    /* no-op — haptics are a bonus, never a requirement */
  }
}

/** True when the user asked for reduced motion (safe on SSR / old browsers). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Chart categorical color for option i (CSS var from globals.css). */
export const chartVar = (i: number) => `var(--chart-${(i % 8) + 1})`;

/** Copy for submit_response error codes — friendly, never shaming. */
export const submitErrorCopy: Record<string, string> = {
  voting_closed: 'Voting just closed for this one.',
  too_late: 'Time ran out before your answer arrived.',
  stale_slide: 'The presenter moved on — catching you up…',
  filtered: "That can't be shown on the big screen — try different wording.",
  bad_participant: 'Session hiccup — refresh this page to rejoin.',
  session_not_live: "The session isn't live right now.",
  transport: "Connection problem — your answer didn't send.",
  rejected: 'Something went wrong — please try again.',
};

/** Slide prompt header used by every interactive view. */
export function Prompt({ kindLabel, text }: { kindLabel: string; text: string }) {
  return (
    <header className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-fg-dim mb-1.5">
        {kindLabel}
      </p>
      <h1 className="text-xl font-bold leading-snug text-fg">{text}</h1>
    </header>
  );
}

/** Live-updating status line (screen readers hear phase changes). */
export function StatusNote({
  tone = 'dim',
  children,
}: {
  tone?: 'dim' | 'ok' | 'warn';
  children: React.ReactNode;
}) {
  const tones = {
    dim: 'text-fg-dim',
    ok: 'text-emerald',
    warn: 'text-amber',
  };
  return (
    <p role="status" aria-live="polite" className={`text-sm font-medium ${tones[tone]}`}>
      {children}
    </p>
  );
}

/** Inline error for a failed submission, with retry when it was a network problem. */
export function SubmitErrorNote({
  code,
  onRetry,
}: {
  code: string | null;
  onRetry?: () => void;
}) {
  if (!code) return null;
  const copy = submitErrorCopy[code] ?? submitErrorCopy.rejected;
  return (
    <div
      role="alert"
      className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-red/40 bg-red/10 px-4 py-3"
    >
      <p className="text-sm font-medium text-fg flex-1 min-w-[10rem]">{copy}</p>
      {code === 'transport' && onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

/** Big tappable option row (polls, quizzes). ≥56px, letter prefix, chart-color edge. */
export function OptionRow({
  index,
  label,
  image,
  onClick,
  disabled,
  selected,
  pending,
  tone = 'default',
  trailing,
  ariaPressed,
}: {
  index: number;
  label: string;
  image?: string;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  pending?: boolean;
  tone?: 'default' | 'correct' | 'wrong';
  trailing?: React.ReactNode;
  ariaPressed?: boolean;
}) {
  const toneCls =
    tone === 'correct'
      ? 'border-emerald bg-emerald/15'
      : tone === 'wrong'
        ? 'border-red bg-red/10'
        : selected
          ? 'border-accent bg-accent-soft'
          : 'border-edge bg-panel active:bg-panel-2';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ariaPressed}
      className={`w-full min-h-[56px] flex items-center gap-3 rounded-xl border border-l-4 px-4 py-3 text-left transition-colors duration-150 disabled:opacity-60 ${toneCls}`}
      style={{ borderLeftColor: chartVar(index) }}
    >
      <span className="w-5 shrink-0 font-mono text-sm font-bold text-fg-dim" aria-hidden="true">
        {letterFor(index)}
      </span>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          aria-hidden="true"
          className="h-11 w-11 shrink-0 rounded-lg object-cover"
        />
      )}
      <span className="flex-1 text-[16px] font-medium text-fg leading-snug">{label}</span>
      {pending ? (
        <span
          className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-fg-dim/40 border-t-accent"
          role="status"
          aria-label="Sending"
        />
      ) : (
        trailing
      )}
    </button>
  );
}

/** Check mark used for chosen/correct answers (never color-only: paired with text). */
export function CheckMark({ className = 'text-emerald' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`h-5 w-5 shrink-0 ${className}`}
    >
      <path
        d="M4 10.5l4 4 8-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Shield icon for the anonymity badge. */
export function ShieldIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={`h-4 w-4 ${className}`}>
      <path
        d="M10 2l6 2.4v4.4c0 4.1-2.6 7.2-6 8.7-3.4-1.5-6-4.6-6-8.7V4.4L10 2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7.4 10l1.8 1.8 3.4-3.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Small reassurance shown once a participant has answered an anonymous activity:
 * their response can't be traced to them, and they can still change it while open.
 */
export function AnonNote({ canChange = true }: { canChange?: boolean }) {
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-fg-dim">
      <ShieldIcon className="shrink-0 text-cyan" />
      Anonymous — no one sees how you answered.
      {canChange && ' You can change it until voting closes.'}
    </p>
  );
}

/** "Only your nickname is visible" privacy badge. */
export function PrivacyBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-panel-2 px-3 py-1.5 text-xs font-semibold text-fg-dim">
      <ShieldIcon className="text-cyan" />
      Only your nickname is visible
    </span>
  );
}
