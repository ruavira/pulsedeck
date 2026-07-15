'use client';
// Add-slide dialog: a grid of every slide kind with icons and descriptions,
// plus an optional Templates section (multi-slide packs).

import type { SlideKind } from '@/lib/types';
import { Modal } from './modal';
import { ALL_KINDS, KIND_META } from './slide-kinds';
import { IconSmile } from './icons';

export function KindPicker({
  open,
  onClose,
  onPick,
  onAddIcebreakers,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (kind: SlideKind) => void;
  /** When provided, shows a Templates section that appends the icebreaker pack. */
  onAddIcebreakers?: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Add a slide" wide>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {ALL_KINDS.map((kind) => {
          const meta = KIND_META[kind];
          return (
            <button
              key={kind}
              type="button"
              onClick={() => {
                onPick(kind);
                onClose();
              }}
              className="flex min-h-[72px] items-start gap-3 rounded-xl border border-edge bg-panel-2/60 p-3.5 text-left transition-colors hover:border-accent hover:bg-accent-soft/40"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <meta.icon width={17} height={17} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-fg">{meta.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-fg-dim">{meta.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      {onAddIcebreakers && (
        <div className="mt-4 border-t border-edge pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-dim">Templates</p>
          <button
            type="button"
            onClick={() => {
              onAddIcebreakers();
              onClose();
            }}
            className="flex min-h-[72px] w-full items-start gap-3 rounded-xl border border-edge bg-panel-2/60 p-3.5 text-left transition-colors hover:border-accent hover:bg-accent-soft/40"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <IconSmile width={17} height={17} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-fg">Icebreaker warm-up pack</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-fg-dim">
                Adds 7 slides: intro, two truths and a lie, word cloud, this-or-that, a knowledge
                scale, a guided breath and a break timer.
              </span>
            </span>
          </button>
        </div>
      )}
    </Modal>
  );
}
