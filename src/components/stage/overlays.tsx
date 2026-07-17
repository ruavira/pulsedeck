'use client';
// Presenter overlays: blackout ('b'), QR spotlight ('q') and the keyboard
// hint bar ('?'). All dismiss on Esc (handled by the Stage key handler) or click.

import { JoinCode } from '@/components/shared/ui';
import { JoinQr, joinHost } from './join-qr';

/** Pure black cover for "eyes on me" moments. */
export function Blackout({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Blackout — click or press B to resume"
      className="fixed inset-0 z-[60] block h-full w-full cursor-pointer bg-black"
    />
  );
}

/** Huge centered QR + code for the dedicated join moment. */
export function QrSpotlight({ code, onDismiss }: { code: string; onDismiss: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Join at ${joinHost()}/j with code ${code}`}
      onClick={onDismiss}
      className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-[4vh] bg-ink/97 px-8 backdrop-blur-sm"
    >
      <p className="text-[clamp(1.5rem,3.5vw,2.75rem)] font-semibold text-fg-dim">
        Join at <span className="font-bold text-fg">{joinHost()}/j</span>
      </p>
      <JoinQr
        code={code}
        size={Math.min(420, Math.round(typeof window !== 'undefined' ? window.innerHeight * 0.42 : 360))}
        pad={20}
      />
      <JoinCode code={code} className="text-[clamp(3rem,9vw,7rem)]" />
      <p className="text-base font-medium uppercase tracking-[0.25em] text-fg-dim">
        Press Q or Esc to return
      </p>
    </div>
  );
}

const HINTS: Array<[string, string]> = [
  ['→ / Space', 'Next slide'],
  ['←', 'Previous slide'],
  ['O', 'Open voting'],
  ['C', 'Close voting'],
  ['R', 'Reveal answers'],
  ['L', 'Leaderboard'],
  ['Q', 'QR spotlight'],
  ['B', 'Blackout'],
  ['F', 'Fullscreen'],
  ['Esc', 'Dismiss overlays'],
];

/** Keyboard shortcut hint bar, toggled with '?'. */
export function HintBar({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Keyboard shortcuts"
      className="fixed inset-x-0 bottom-24 z-[55] flex justify-center px-6"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hide keyboard shortcuts"
        className="flex max-w-5xl cursor-pointer flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-2xl border border-edge bg-panel/95 px-6 py-4 text-left backdrop-blur-sm"
      >
        {HINTS.map(([key, label]) => (
          <span key={key} className="inline-flex items-center gap-2 text-sm text-fg-dim">
            <kbd className="rounded-md border border-edge bg-panel-2 px-2 py-1 font-mono text-xs font-bold text-fg">
              {key}
            </kbd>
            {label}
          </span>
        ))}
      </button>
    </div>
  );
}
