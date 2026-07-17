'use client';
// Import flows: PPTX / PDF file imports (lazy-loaded sibling modules) and the
// paste-markdown modal. Works both in the editor (replace/append) and on the
// deck list (create).

import { useEffect, useRef, useState } from 'react';
import type { Slide } from '@/lib/types';
import { Button, Spinner } from '@/components/shared/ui';
import { Field, Modal } from './modal';
import { IconFile, IconWarn } from './icons';

export type ImportApplyMode = 'replace' | 'append' | 'create';

export interface ImportResult {
  title?: string;
  slides: Slide[];
}

function withIds(slides: Slide[]): Slide[] {
  return slides.map((s, i) => ({
    ...s,
    id: s.id && s.id.length > 0 ? s.id : crypto.randomUUID(),
    position: i,
  }));
}

// ---------- PPTX / PDF file import ----------
export function FileImportModal({
  file,
  kind,
  context,
  busyApply = false,
  onClose,
  onApply,
}: {
  file: File;
  kind: 'pptx' | 'pdf';
  /** 'editor': replace/append (pdf: append only). 'create': single create action. */
  context: 'editor' | 'create';
  busyApply?: boolean;
  onClose: () => void;
  onApply: (result: ImportResult, how: ImportApplyMode) => void | Promise<void>;
}) {
  const [status, setStatus] = useState<'working' | 'ready' | 'error'>('working');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return; // guard StrictMode double-invoke
    startedRef.current = true;
    (async () => {
      try {
        if (kind === 'pptx') {
          const { importPptx } = await import('@/lib/import/pptx');
          const out = await importPptx(file, (done, total) => setProgress({ done, total }));
          setResult({ title: out.title, slides: withIds(out.slides) });
        } else {
          const { importPdf } = await import('@/lib/import/pdf');
          const slides = await importPdf(file, (done, total) => setProgress({ done, total }));
          setResult({ slides: withIds(slides) });
        }
        setStatus('ready');
      } catch (e) {
        setError((e as Error).message || 'Import failed');
        setStatus('error');
      }
    })();
  }, [file, kind]);

  const title = kind === 'pptx' ? 'Import PowerPoint' : 'Import PDF';

  return (
    <Modal open onClose={onClose} title={title}>
      {status === 'working' && (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <Spinner />
          <p aria-live="polite" className="font-semibold text-fg">
            {progress
              ? kind === 'pdf'
                ? `Rendering page ${progress.done} of ${progress.total}…`
                : `Processing slide ${progress.done} of ${progress.total}…`
              : kind === 'pdf'
                ? 'Opening PDF…'
                : 'Reading slides…'}
          </p>
          {progress && progress.total > 0 && (
            <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-panel-2">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
          )}
          <p className="text-xs text-fg-dim">{file.name}</p>
        </div>
      )}

      {status === 'error' && (
        <div className="px-2 py-4 text-center">
          <IconWarn className="mx-auto mb-3 text-red" width={28} height={28} />
          <p className="font-semibold text-fg">Couldn&rsquo;t import {file.name}</p>
          <p className="mt-1.5 text-sm text-fg-dim">{error}</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={onClose}>
            Close
          </Button>
        </div>
      )}

      {status === 'ready' && result && (
        <div>
          <div className="flex items-center gap-3 rounded-xl border border-edge bg-panel-2/60 px-4 py-3">
            <IconFile className="shrink-0 text-cyan" />
            <p className="text-sm text-fg">
              <span className="font-semibold">{result.slides.length}</span> slide
              {result.slides.length === 1 ? '' : 's'} ready
              {result.title ? (
                <>
                  {' '}
                  from <span className="font-semibold">&ldquo;{result.title}&rdquo;</span>
                </>
              ) : (
                <> from {file.name}</>
              )}
              {kind === 'pdf' && ' (full-bleed page images)'}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={onClose} disabled={busyApply}>
              Cancel
            </Button>
            {context === 'create' ? (
              <Button disabled={busyApply} onClick={() => void onApply(result, 'create')}>
                {busyApply ? 'Creating…' : 'Create deck'}
              </Button>
            ) : kind === 'pdf' ? (
              <Button disabled={busyApply} onClick={() => void onApply(result, 'append')}>
                Add {result.slides.length} slide{result.slides.length === 1 ? '' : 's'}
              </Button>
            ) : (
              <>
                <Button variant="secondary" disabled={busyApply} onClick={() => void onApply(result, 'append')}>
                  Append
                </Button>
                <Button disabled={busyApply} onClick={() => void onApply(result, 'replace')}>
                  Replace deck
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------- Markdown paste import ----------
export function MarkdownImportModal({
  open,
  context,
  busyApply = false,
  onClose,
  onApply,
}: {
  open: boolean;
  context: 'editor' | 'create';
  busyApply?: boolean;
  onClose: () => void;
  onApply: (result: ImportResult, how: ImportApplyMode) => void | Promise<void>;
}) {
  const [md, setMd] = useState('');
  const [error, setError] = useState('');
  const [parsing, setParsing] = useState(false);

  const parse = async (how: ImportApplyMode) => {
    setParsing(true);
    setError('');
    try {
      const { parseMarkdownDeck } = await import('@/lib/import/markdown');
      const out = parseMarkdownDeck(md);
      if (!out.slides || out.slides.length === 0) {
        setError('No slides found — start slides with "## " headings.');
        return;
      }
      await onApply({ title: out.title, slides: withIds(out.slides) }, how);
    } catch (e) {
      setError((e as Error).message || 'Could not parse that markdown.');
    } finally {
      setParsing(false);
    }
  };

  const disabled = md.trim().length === 0 || parsing || busyApply;

  return (
    <Modal open={open} onClose={onClose} title="Import markdown" wide>
      <Field
        label="Paste markdown"
        hint={'"# Title" names the deck; each "## Heading" starts a slide; "-" lines become bullets.'}
      >
        <textarea
          className="min-h-[220px] w-full resize-y rounded-xl border border-edge bg-panel-2 px-4 py-3 font-mono text-sm text-fg placeholder:text-fg-dim/70 transition-colors focus:border-accent focus:outline-none"
          value={md}
          autoFocus
          placeholder={'# My deck\n\n## First slide\nSome text\n- bullet one\n- bullet two\n\n## Second slide\n…'}
          onChange={(e) => setMd(e.target.value)}
        />
      </Field>
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red/40 bg-red/10 px-3 py-2 text-sm text-red">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={onClose} disabled={parsing || busyApply}>
          Cancel
        </Button>
        {context === 'create' ? (
          <Button disabled={disabled} onClick={() => void parse('create')}>
            {parsing || busyApply ? 'Working…' : 'Create deck'}
          </Button>
        ) : (
          <>
            <Button variant="secondary" disabled={disabled} onClick={() => void parse('append')}>
              Append slides
            </Button>
            <Button disabled={disabled} onClick={() => void parse('replace')}>
              Replace deck
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
