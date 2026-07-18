'use client';
// Collapsible emergency controls: close voting now, lock the room, toggle Q&A
// moderation, end the session (double-confirm). Every target ≥56px; state is
// always spelled out in text, never color-only.

import { useEffect, useRef, useState } from 'react';
import type { SessionState } from '@/lib/types';
import type {
  RemoteAdvance,
  RemoteSessionSettings,
  RemoteUpdateSettings,
} from './remote-types';

function PanicButton({
  title,
  detail,
  danger,
  disabled,
  onClick,
}: {
  title: string;
  detail: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[56px] flex-col items-start justify-center rounded-xl border px-3.5 py-2.5 text-left transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${
        danger
          ? 'border-red/50 bg-red/15 text-red hover:bg-red/25'
          : 'border-edge bg-panel-2 text-fg hover:border-accent/60'
      }`}
    >
      <span className="text-sm font-bold leading-tight">{title}</span>
      <span className={`text-xs leading-tight ${danger ? 'text-red/80' : 'text-fg-dim'}`}>
        {detail}
      </span>
    </button>
  );
}

export function PanicBar({
  state,
  busy,
  advance,
  updateSettings,
}: {
  state: SessionState;
  busy: string | null;
  advance: RemoteAdvance;
  updateSettings: RemoteUpdateSettings;
}) {
  const [open, setOpen] = useState(false);
  const [armEnd, setArmEnd] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // auto-disarm the end-session confirm after 4s
  useEffect(() => {
    if (!armEnd) return;
    disarmTimer.current = setTimeout(() => setArmEnd(false), 4000);
    return () => {
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
    };
  }, [armEnd]);

  const settings = state.settings as RemoteSessionSettings;
  const locked = settings.locked === true;
  const moderated = settings.qaModerated === true;
  const anyBusy = busy !== null;

  return (
    <section className="rounded-2xl border border-red/30 bg-panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-center justify-between px-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-red">
          <span aria-hidden="true">⚠</span> Panic controls
        </span>
        <span aria-hidden="true" className="text-fg-dim">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          <PanicButton
            title="Close voting now"
            detail={state.phase === 'open' ? 'Stops responses instantly' : 'Nothing is open'}
            disabled={state.phase !== 'open' || anyBusy}
            onClick={() => void advance('panic-close', { phase: 'closed' }, { phase: 'closed' })}
          />
          <PanicButton
            title={locked ? 'Unlock room' : 'Lock room'}
            detail={locked ? 'Room is locked — no new joins' : 'Block new participants'}
            disabled={anyBusy}
            onClick={() => void updateSettings('panic-lock', { locked: !locked })}
          />
          <PanicButton
            title={moderated ? 'Moderation: ON' : 'Moderation: OFF'}
            detail={
              moderated ? 'New questions need approval' : 'Questions go straight to the wall'
            }
            disabled={anyBusy}
            onClick={() => void updateSettings('panic-mod', { qaModerated: !moderated })}
          />
          <PanicButton
            title={settings.autoOpenVoting !== false ? 'Auto-open: ON' : 'Auto-open: OFF'}
            detail={
              settings.autoOpenVoting !== false
                ? 'Voting opens when an activity slide shows'
                : 'You open each activity manually'
            }
            disabled={anyBusy}
            onClick={() =>
              void updateSettings('panic-autoopen', {
                autoOpenVoting: settings.autoOpenVoting === false,
              })
            }
          />
          <PanicButton
            title={settings.translateEnabled === true ? 'Translate: ON' : 'Translate: OFF'}
            detail={
              settings.translateEnabled === true
                ? 'Questions shown in each phone’s language'
                : 'Let participants read in their language'
            }
            disabled={anyBusy}
            onClick={() =>
              void updateSettings('panic-translate', {
                translateEnabled: settings.translateEnabled !== true,
              })
            }
          />
          <PanicButton
            title={armEnd ? 'Tap again to end' : 'End session'}
            detail={armEnd ? 'This closes the show for everyone' : 'Double-tap to confirm'}
            danger
            disabled={anyBusy}
            onClick={() => {
              if (!armEnd) {
                setArmEnd(true);
                return;
              }
              setArmEnd(false);
              void advance('panic-end', { status: 'ended' }, { status: 'ended' });
            }}
          />
        </div>
      )}
    </section>
  );
}
