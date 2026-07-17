'use client';
// Drag-and-drop image target wrapping the editor canvas. Shows a highlight while a
// file is dragged over, uploads dropped images via POST /api/upload (through
// uploadImage in studio-api) and hands the public URL back to the editor. Errors
// surface as a dismissible inline toast. No animations — static overlays only, so
// prefers-reduced-motion needs no special handling here.

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Spinner } from '@/components/shared/ui';
import { uploadImage } from './studio-api';
import { IconClose, IconUpload } from './icons';

// Source-file ceiling — uploadImage auto-compresses anything big before it
// ever hits /api/upload's 8MB post-compression cap.
const MAX_BYTES = 80 * 1024 * 1024;

interface Notice {
  tone: 'error' | 'warn';
  text: string;
}

function hasFiles(e: DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

export function CanvasDropzone({
  canDrop,
  blockedHint,
  onUploaded,
  children,
}: {
  /** True when the selected slide can receive a dropped image (content slide). */
  canDrop: boolean;
  /** Shown when a file is dropped while canDrop is false. */
  blockedHint: string;
  onUploaded: (url: string) => void;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const depth = useRef(0); // dragenter/dragleave fire per child — track nesting depth
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flash = (n: Notice) => {
    setNotice(n);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 6000);
  };

  const handleDrop = async (files: FileList) => {
    const file = Array.from(files).find((f) => f.type.startsWith('image/'));
    if (!file) {
      flash({ tone: 'warn', text: 'Only image files can be dropped here (PNG, JPEG, WebP, GIF or SVG).' });
      return;
    }
    if (!canDrop) {
      flash({ tone: 'warn', text: blockedHint });
      return;
    }
    if (file.size > MAX_BYTES) {
      flash({ tone: 'error', text: 'That image is larger than 80MB — export a smaller version and drop it again.' });
      return;
    }
    setBusy(true);
    try {
      const url = await uploadImage(file);
      onUploaded(url);
    } catch (e) {
      flash({ tone: 'error', text: e instanceof Error ? e.message : 'Upload failed — try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="relative flex min-h-full flex-1 flex-col"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        if (!busy) void handleDrop(e.dataTransfer.files);
      }}
    >
      {children}

      {over && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed ${
            canDrop ? 'border-accent bg-accent/10' : 'border-amber bg-amber/10'
          }`}
        >
          <p
            className={`flex items-center gap-2 rounded-full border border-edge bg-panel px-5 py-2.5 text-sm font-semibold shadow-pop ${
              canDrop ? 'text-accent' : 'text-amber'
            }`}
          >
            <IconUpload width={15} height={15} />
            {canDrop ? 'Drop to add the image to this slide' : blockedHint}
          </p>
        </div>
      )}

      <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
        {busy && (
          <p className="flex items-center gap-2 rounded-full border border-edge bg-panel px-4 py-2 text-sm font-medium text-fg shadow-pop">
            <Spinner className="h-4 w-4" /> Uploading image…
          </p>
        )}
      </div>

      {notice && (
        <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
          <p
            role="alert"
            className={`flex items-center gap-2 rounded-xl border bg-panel px-4 py-2 text-sm shadow-pop ${
              notice.tone === 'error' ? 'border-red/40 text-red' : 'border-amber/40 text-amber'
            }`}
          >
            {notice.text}
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => {
                if (timer.current) clearTimeout(timer.current);
                setNotice(null);
              }}
              className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-panel-2"
            >
              <IconClose width={13} height={13} />
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
