'use client';
// Ambient Q&A: a persistent "?" tab that opens a bottom sheet from ANY slide.
// CSS transitions only (audience path). Esc / overlay tap / close button dismiss.

import { useEffect, useRef, useState } from 'react';
import { QaPanel } from './qa-panel';

export function QaSheet({
  sessionId,
  participantId,
  deviceKey,
  qaBump,
  broadcast,
}: {
  sessionId: string;
  participantId: string;
  deviceKey: string;
  qaBump: number;
  broadcast: (event: string, payload: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Esc closes; lock body scroll while open; move focus into the sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Persistent tab */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open audience Q&A"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-panel-2 border border-edge text-xl font-bold text-cyan shadow-pop transition-transform duration-150 active:scale-95"
      >
        ?
      </button>

      {/* Overlay + sheet (always mounted for the slide-up transition) */}
      <div
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-0 z-50 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close Q&A"
          onClick={() => setOpen(false)}
          className="absolute inset-0 h-full w-full cursor-default bg-ink/70"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Audience Q&A"
          className={`absolute inset-x-0 bottom-0 mx-auto flex h-[82dvh] w-full max-w-md flex-col rounded-t-2xl border border-b-0 border-edge bg-panel px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out ${
            open ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-edge" aria-hidden="true" />
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <h2 className="text-base font-bold text-fg">Audience Q&amp;A</h2>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Q&A"
              className="flex h-11 w-11 items-center justify-center rounded-full text-fg-dim transition-colors hover:bg-panel-2 hover:text-fg"
            >
              <span aria-hidden="true" className="text-xl leading-none">
                ×
              </span>
            </button>
          </div>
          {/* Mount the panel only while open so it doesn't poll in the background */}
          {open && (
            <QaPanel
              sessionId={sessionId}
              participantId={participantId}
              deviceKey={deviceKey}
              qaBump={qaBump}
              active={open}
              broadcast={broadcast}
            />
          )}
        </div>
      </div>
    </>
  );
}
