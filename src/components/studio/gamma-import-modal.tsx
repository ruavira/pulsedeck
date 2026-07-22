'use client';
// "Import from Gamma" — a guided, premium flow that brings a Gamma deck's visuals
// into PulseDeck (via Gamma's PDF / PPTX export → full-bleed slides) and lets you
// weave native live activities between them. The result: present from the PulseDeck
// Stage with your Gamma look *and* PulseDeck's interactivity.
//
// It reuses the exact same client-side import pipeline as the generic file import
// (@/lib/import/pdf, /pptx) — no new deps. The two presentation modes stay open:
// import here to present from the Stage, or use the Embed helper to keep presenting
// inside Gamma with a live widget dropped onto a slide.

import { useCallback, useRef, useState } from 'react';
import type { Slide, SlideKind } from '@/lib/types';
import { Button, Spinner } from '@/components/shared/ui';
import { Modal } from './modal';
import { KIND_META, newSlide } from './slide-kinds';
import type { ImportApplyMode, ImportResult } from './import-modals';
import { IconWarn } from './icons';

// The live moments you can weave between Gamma visuals. Content / join / timer /
// breathing are deck-building blocks rather than "ask the room" activities, so
// they're kept out here to keep the choice focused and fast.
const ACTIVITY_KINDS: SlideKind[] = [
  'poll',
  'wordcloud',
  'quiz',
  'scale',
  'ranking',
  'open_text',
  'qa',
];

type Step = 'intro' | 'working' | 'arrange' | 'error';

function fileKind(file: File): 'pdf' | 'pptx' | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (
    name.endsWith('.pptx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return 'pptx';
  }
  return null;
}

function withFreshIds(slides: Slide[]): Slide[] {
  return slides.map((s, i) => ({
    ...s,
    id: s.id && s.id.length > 0 ? s.id : crypto.randomUUID(),
    position: i,
  }));
}

export function GammaImportModal({
  open,
  onClose,
  hasSlides,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  /** True when the deck already has slides (import appends; label shifts to match). */
  hasSlides: boolean;
  onApply: (result: ImportResult, how: ImportApplyMode) => void | Promise<void>;
}) {
  const [step, setStep] = useState<Step>('intro');
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [kind, setKind] = useState<'pdf' | 'pptx'>('pdf');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [items, setItems] = useState<Slide[]>([]);
  const [openInsert, setOpenInsert] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);

  const reset = useCallback(() => {
    setStep('intro');
    setDragging(false);
    setProgress(null);
    setFileName('');
    setError('');
    setItems([]);
    setOpenInsert(null);
    startedRef.current = false;
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const runImport = useCallback(async (file: File) => {
    if (startedRef.current) return;
    const k = fileKind(file);
    if (!k) {
      setError('That doesn’t look like a PDF or PowerPoint. In Gamma, use Share → Export.');
      setStep('error');
      return;
    }
    startedRef.current = true;
    setKind(k);
    setFileName(file.name);
    setProgress(null);
    setStep('working');
    try {
      let slides: Slide[];
      if (k === 'pdf') {
        const { importPdf } = await import('@/lib/import/pdf');
        slides = await importPdf(file, (done, total) => setProgress({ done, total }));
      } else {
        const { importPptx } = await import('@/lib/import/pptx');
        const out = await importPptx(file, (done, total) => setProgress({ done, total }));
        slides = out.slides;
      }
      if (slides.length === 0) {
        setError('No slides were found in that export. Try exporting again from Gamma.');
        setStep('error');
        return;
      }
      setItems(withFreshIds(slides));
      setStep('arrange');
    } catch (e) {
      setError((e as Error).message || 'Import failed — try again.');
      setStep('error');
    } finally {
      startedRef.current = false;
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void runImport(file);
    },
    [runImport],
  );

  const insertActivity = useCallback((at: number, activity: SlideKind) => {
    setItems((prev) => {
      const next = [...prev];
      next.splice(at, 0, newSlide(activity));
      return next;
    });
    setOpenInsert(null);
  }, []);

  const removeAt = useCallback((id: string) => {
    setItems((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const visuals = items.filter((s) => s.kind === 'content').length;
  const activities = items.length - visuals;

  const apply = useCallback(() => {
    if (items.length === 0) return;
    void onApply({ slides: withFreshIds(items) }, hasSlides ? 'append' : 'replace');
    reset();
  }, [items, onApply, hasSlides, reset]);

  return (
    <Modal open={open} onClose={close} title="Import from Gamma" wide dismissible={step !== 'working'}>
      {step === 'intro' && (
        <IntroStep
          dragging={dragging}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onBrowse={() => inputRef.current?.click()}
        />
      )}

      {step === 'working' && (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <Spinner />
          <p aria-live="polite" className="font-semibold text-fg">
            {progress
              ? kind === 'pdf'
                ? `Rendering your Gamma deck — page ${progress.done} of ${progress.total}…`
                : `Reading your slides — ${progress.done} of ${progress.total}…`
              : 'Opening your Gamma export…'}
          </p>
          {progress && progress.total > 0 && (
            <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-panel-2">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
          )}
          <p className="text-xs text-fg-dim">{fileName}</p>
        </div>
      )}

      {step === 'error' && (
        <div className="px-2 py-6 text-center">
          <IconWarn className="mx-auto mb-3 text-red" width={28} height={28} />
          <p className="font-semibold text-fg">Couldn&rsquo;t import that file</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-fg-dim">{error}</p>
          <Button variant="secondary" size="sm" className="mt-5" onClick={reset}>
            Try another file
          </Button>
        </div>
      )}

      {step === 'arrange' && (
        <ArrangeStep
          items={items}
          visuals={visuals}
          activities={activities}
          openInsert={openInsert}
          setOpenInsert={setOpenInsert}
          onInsert={insertActivity}
          onRemove={removeAt}
          onBack={reset}
          onApply={apply}
          hasSlides={hasSlides}
        />
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        className="hidden"
        aria-label="Choose your Gamma export (PDF or PowerPoint)"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void runImport(f);
          e.target.value = '';
        }}
      />
    </Modal>
  );
}

// ---------- Step 1: the story + the dropzone ----------
function IntroStep({
  dragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onBrowse,
}: {
  dragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onBrowse: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Hero lockup — Gamma × PulseDeck */}
      <div className="overflow-hidden rounded-2xl border border-edge bg-gradient-to-br from-accent-soft/60 via-panel-2 to-panel-2 p-5">
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-panel px-2.5 py-1 text-sm font-bold text-fg shadow-soft">
            Gamma
          </span>
          <MergeGlyph />
          <span className="rounded-lg bg-accent px-2.5 py-1 text-sm font-bold text-white shadow-accent-glow">
            PulseDeck
          </span>
        </div>
        <p className="mt-3 text-[15px] font-semibold leading-snug text-fg">
          Your Gamma visuals. PulseDeck&rsquo;s live interactivity. One stage.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-fg-dim">
          Each page of your Gamma export becomes a full-bleed slide &mdash; pixel-for-pixel your
          design &mdash; and you weave polls, word clouds and quizzes between them. Then present
          the whole thing from the PulseDeck Stage.
        </p>
      </div>

      {/* Export steps */}
      <ol className="grid gap-2.5 sm:grid-cols-3">
        {[
          { n: 1, t: 'In Gamma', d: 'Open your deck, then Share → Export.' },
          { n: 2, t: 'Export as PDF', d: 'Best fidelity. PowerPoint (.pptx) works too.' },
          { n: 3, t: 'Drop it below', d: 'We render every page and bring it in.' },
        ].map((s) => (
          <li key={s.n} className="rounded-xl border border-edge bg-panel-2/60 p-3.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
              {s.n}
            </span>
            <p className="mt-2 text-sm font-semibold text-fg">{s.t}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-fg-dim">{s.d}</p>
          </li>
        ))}
      </ol>

      {/* Dropzone */}
      <button
        type="button"
        onClick={onBrowse}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-colors ${
          dragging
            ? 'border-accent bg-accent-soft/40'
            : 'border-edge bg-panel-2/40 hover:border-accent/60 hover:bg-accent-soft/20'
        }`}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-accent" aria-hidden>
          <path d="M12 16V4m0 0-4 4m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-semibold text-fg">
          Drop your Gamma PDF or PowerPoint here
        </span>
        <span className="text-xs text-fg-dim">or click to browse &middot; up to 150 pages</span>
      </button>

      <p className="rounded-xl border border-edge bg-panel-2/40 px-4 py-3 text-xs leading-relaxed text-fg-dim">
        <strong className="text-fg">Rather keep presenting inside Gamma?</strong> You don&rsquo;t have
        to move &mdash; close this and use <strong className="text-fg">Embed</strong> to drop a live
        PulseDeck widget onto a Gamma slide instead. Both ways run the same live session.
      </p>
    </div>
  );
}

// ---------- Step 2: interleave live activities ----------
function ArrangeStep({
  items,
  visuals,
  activities,
  openInsert,
  setOpenInsert,
  onInsert,
  onRemove,
  onBack,
  onApply,
  hasSlides,
}: {
  items: Slide[];
  visuals: number;
  activities: number;
  openInsert: number | null;
  setOpenInsert: (i: number | null) => void;
  onInsert: (at: number, kind: SlideKind) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
  onApply: () => void;
  hasSlides: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold text-fg">Weave in live moments</p>
          <p className="text-sm text-fg-dim">
            Your Gamma visuals are in. Drop polls, word clouds or a quiz between any slides.
          </p>
        </div>
        <span className="rounded-full border border-edge bg-panel-2 px-3 py-1 text-xs font-semibold text-fg-dim">
          {visuals} visual{visuals === 1 ? '' : 's'} &middot; {activities} activit
          {activities === 1 ? 'y' : 'ies'}
        </span>
      </div>

      <div className="max-h-[46vh] space-y-1 overflow-y-auto rounded-xl border border-edge bg-panel-2/40 p-2">
        <InsertBar index={0} open={openInsert === 0} setOpen={setOpenInsert} onInsert={onInsert} />
        {items.map((slide, i) => (
          <div key={slide.id}>
            <SlideRow slide={slide} index={i} onRemove={() => onRemove(slide.id)} />
            <InsertBar
              index={i + 1}
              open={openInsert === i + 1}
              setOpen={setOpenInsert}
              onInsert={onInsert}
            />
          </div>
        ))}
      </div>

      <p className="text-xs text-fg-dim">
        These {items.length} slides {hasSlides ? 'append to the end of your deck' : 'become your deck'}.
        Reorder or edit any of them afterwards in the editor.
      </p>

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={onBack}>
          Import a different file
        </Button>
        <Button onClick={onApply} disabled={items.length === 0}>
          {hasSlides ? `Add ${items.length} slides to deck` : `Build deck (${items.length} slides)`}
        </Button>
      </div>
    </div>
  );
}

function SlideRow({
  slide,
  index,
  onRemove,
}: {
  slide: Slide;
  index: number;
  onRemove: () => void;
}) {
  const isVisual = slide.kind === 'content';
  const bg = isVisual ? slide.body.backgroundImage : undefined;
  const meta = KIND_META[slide.kind];

  return (
    <div
      className={`group flex items-center gap-3 rounded-lg border px-2.5 py-2 ${
        isVisual ? 'border-edge bg-panel' : 'border-accent/50 bg-accent-soft/30'
      }`}
    >
      {/* Thumbnail / activity chip */}
      {bg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bg}
          alt=""
          className="h-11 w-16 shrink-0 rounded border border-edge object-cover"
        />
      ) : (
        <span
          className={`flex h-11 w-16 shrink-0 items-center justify-center rounded border ${
            isVisual
              ? 'border-edge bg-panel-2 text-fg-dim'
              : 'border-accent/40 bg-accent-soft text-accent'
          }`}
        >
          <meta.icon width={18} height={18} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">
          {isVisual ? `Slide ${index + 1}` : meta.label}
        </p>
        <p className="truncate text-xs text-fg-dim">
          {isVisual ? 'Gamma visual' : slide.body.prompt || meta.description}
        </p>
      </div>

      {!isVisual && (
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Live
        </span>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${isVisual ? `slide ${index + 1}` : meta.label}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-dim opacity-0 transition-opacity hover:bg-panel-2 hover:text-red group-hover:opacity-100"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function InsertBar({
  index,
  open,
  setOpen,
  onInsert,
}: {
  index: number;
  open: boolean;
  setOpen: (i: number | null) => void;
  onInsert: (at: number, kind: SlideKind) => void;
}) {
  return (
    <div className="px-1">
      {open ? (
        <div className="my-1 rounded-lg border border-accent/40 bg-panel p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-dim">
              Add a live activity here
            </span>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="text-xs font-medium text-fg-dim hover:text-fg"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {ACTIVITY_KINDS.map((k) => {
              const meta = KIND_META[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onInsert(index, k)}
                  className="flex items-center gap-2 rounded-lg border border-edge bg-panel-2/60 px-2.5 py-2 text-left transition-colors hover:border-accent hover:bg-accent-soft/40"
                >
                  <span className="text-accent">
                    <meta.icon width={16} height={16} />
                  </span>
                  <span className="truncate text-xs font-semibold text-fg">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(index)}
          className="group/insert flex w-full items-center gap-2 py-1 text-fg-dim transition-colors hover:text-accent"
          aria-label="Add a live activity here"
        >
          <span className="h-px flex-1 bg-edge transition-colors group-hover/insert:bg-accent/40" />
          <span className="flex items-center gap-1 text-[11px] font-semibold">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Add live activity
          </span>
          <span className="h-px flex-1 bg-edge transition-colors group-hover/insert:bg-accent/40" />
        </button>
      )}
    </div>
  );
}

function MergeGlyph() {
  return (
    <svg width="26" height="16" viewBox="0 0 26 16" fill="none" className="text-fg-dim" aria-hidden>
      <path
        d="M2 8h9m4 0h9m-9 0-3-3m3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
