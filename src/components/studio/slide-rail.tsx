'use client';
// Left slide rail: thumbnails with kind icon + title + index, click-to-select,
// HTML5 drag-to-reorder (plus Alt+Arrow keyboard reorder), hover menu for
// duplicate/delete, and the add-slide button.

import { useState } from 'react';
import type { Slide } from '@/lib/types';
import { Button } from '@/components/shared/ui';
import { KIND_META } from './slide-kinds';
import { IconCopy, IconGrip, IconPlus, IconTrash } from './icons';

export function SlideRail({
  slides,
  selectedId,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onAddClick,
}: {
  slides: Slide[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onAddClick: () => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  return (
    <div className="flex h-full flex-col">
      <ul role="list" aria-label="Slides" className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {slides.length === 0 && (
          <li className="rounded-xl border border-dashed border-edge px-3 py-6 text-center text-xs text-fg-dim">
            No slides yet
          </li>
        )}
        {slides.map((slide, i) => {
          const meta = KIND_META[slide.kind];
          const selected = slide.id === selectedId;
          return (
            <li
              key={slide.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(i));
                setDragIndex(i);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (overIndex !== i) setOverIndex(i);
              }}
              onDragLeave={() => setOverIndex((o) => (o === i ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null && dragIndex !== i) onMove(dragIndex, i);
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              className={`group relative rounded-xl transition-shadow ${
                overIndex === i && dragIndex !== null && dragIndex !== i
                  ? 'ring-2 ring-accent'
                  : ''
              } ${dragIndex === i ? 'opacity-50' : ''}`}
            >
              <button
                type="button"
                onClick={() => onSelect(slide.id)}
                onKeyDown={(e) => {
                  if (e.altKey && e.key === 'ArrowUp' && i > 0) {
                    e.preventDefault();
                    onMove(i, i - 1);
                  } else if (e.altKey && e.key === 'ArrowDown' && i < slides.length - 1) {
                    e.preventDefault();
                    onMove(i, i + 1);
                  }
                }}
                aria-current={selected ? 'true' : undefined}
                aria-label={`Slide ${i + 1}: ${slide.title || 'Untitled'} (${meta.label}). Alt+arrows to reorder.`}
                className={`flex min-h-[52px] w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                  selected
                    ? 'border-accent bg-accent-soft/60'
                    : 'border-edge bg-panel hover:border-accent/40'
                }`}
              >
                <span aria-hidden="true" className="cursor-grab text-fg-dim/50">
                  <IconGrip width={12} height={12} />
                </span>
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-fg-dim">{i + 1}</span>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    selected ? 'bg-accent text-white' : 'bg-panel-2 text-fg-dim'
                  }`}
                  title={meta.label}
                >
                  <meta.icon width={15} height={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">
                    {slide.title || 'Untitled'}
                  </span>
                  <span className="block text-[11px] text-fg-dim">{meta.label}</span>
                </span>
              </button>
              {/* Hover/focus actions — siblings, not nested buttons */}
              <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <button
                  type="button"
                  aria-label={`Duplicate slide ${i + 1}`}
                  title="Duplicate"
                  onClick={() => onDuplicate(slide.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-edge bg-panel-2 text-fg-dim transition-colors hover:text-fg"
                >
                  <IconCopy width={12} height={12} />
                </button>
                <button
                  type="button"
                  aria-label={`Delete slide ${i + 1}`}
                  title="Delete (undo with Cmd+Z)"
                  onClick={() => onDelete(slide.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-edge bg-panel-2 text-red transition-colors hover:bg-red/10"
                >
                  <IconTrash width={12} height={12} />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-edge p-3">
        <Button type="button" variant="secondary" size="sm" className="w-full" onClick={onAddClick}>
          <IconPlus width={14} height={14} /> Add slide
        </Button>
      </div>
    </div>
  );
}
