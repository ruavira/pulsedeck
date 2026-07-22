'use client';
// THE EDITOR: loads the deck (presenter-key auth), then renders the three-pane
// studio — slide rail / canvas / inspector — plus top bar, AI panel, import
// flows and the go-live modal.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Deck, Slide, SlideKind } from '@/lib/types';
import { Button, Pill, Spinner } from '@/components/shared/ui';
import { getPresenterKey, storeDeckRef } from '@/lib/presenter-api';
import { AiPanel, type AiApplyMode, type AiResult } from './ai-panel';
import { CanvasDropzone } from './canvas-dropzone';
import { EditorTopBar } from './editor-top-bar';
import { ParticipantPreview } from './participant-preview';
import { SessionHistoryModal } from './session-history-modal';
import { LmsBridgeModal } from './lms-bridge-modal';
import { FirstRun } from './first-run';
import { GoLiveModal } from './go-live-modal';
import { FileImportModal, MarkdownImportModal, type ImportResult } from './import-modals';
import { GammaImportModal } from './gamma-import-modal';
import { Inspector } from './inspector';
import { KindPicker } from './kind-picker';
import { SlideCanvas } from './slide-canvas';
import { SlideRail } from './slide-rail';
import { newSlide } from './slide-kinds';
import {
  clearLiveSession,
  fetchDeck,
  getLiveSession,
  reindex,
  type LiveSessionRef,
} from './studio-api';
import { demoTourSlides, icebreakerSlides } from './templates';
import { useDeckEditor } from './use-deck-editor';
import { IconExternal } from './icons';

type StudioModal =
  | { type: 'ai' }
  | { type: 'golive' }
  | { type: 'kind' }
  | { type: 'markdown' }
  | { type: 'sessions' }
  | { type: 'lms' }
  | { type: 'gamma' }
  | { type: 'file'; kind: 'pptx' | 'pdf'; file: File };

export function DeckEditor({ deckId }: { deckId: string }) {
  // undefined = resolving (avoids SSR/localStorage hydration mismatch), null = not in this browser
  const [presenterKey, setPresenterKey] = useState<string | null | undefined>(undefined);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Claim-by-URL: /studio/[deckId]?key=... stores the presenter key in this
    // browser (same pattern as stage/remote), then scrubs it from the URL.
    const url = new URL(window.location.href);
    const urlKey = url.searchParams.get('key');
    if (urlKey) {
      storeDeckRef({
        id: deckId,
        title: 'Claimed deck',
        presenterKey: urlKey,
        updatedAt: new Date().toISOString(),
      });
      url.searchParams.delete('key');
      window.history.replaceState(null, '', url.toString());
      setPresenterKey(urlKey);
      return;
    }
    setPresenterKey(getPresenterKey(deckId));
  }, [deckId]);

  useEffect(() => {
    if (!presenterKey) return;
    let cancelled = false;
    setLoadError(null);
    setDeck(null);
    fetchDeck(deckId, presenterKey).then(
      (d) => {
        if (!cancelled) {
          setDeck(d);
          // Keep the studio deck list accurate (esp. after claim-by-URL)
          storeDeckRef({
            id: deckId,
            title: d.title,
            presenterKey,
            updatedAt: new Date().toISOString(),
          });
        }
      },
      (e: Error) => {
        if (!cancelled) setLoadError(e.message);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [deckId, presenterKey, attempt]);

  if (presenterKey === undefined || (presenterKey && !deck && !loadError)) {
    return (
      <div className="flex h-dvh items-center justify-center gap-3 text-fg-dim">
        <Spinner /> Loading deck…
      </div>
    );
  }

  if (presenterKey === null) {
    return (
      <CenteredNotice
        title="This deck isn't stored in this browser"
        body="Decks live in the browser that created them (the presenter key is kept in localStorage). Open the deck on the device you built it on, or create a new deck here."
      />
    );
  }

  if (loadError) {
    return (
      <CenteredNotice
        title={
          loadError === 'not_found'
            ? 'Deck not found'
            : loadError === 'unauthorized'
              ? 'This browser no longer has access to that deck'
              : "Couldn't load the deck"
        }
        body={
          loadError === 'not_found'
            ? 'It may have been deleted. Head back to the studio to see your decks.'
            : loadError === 'unauthorized'
              ? 'Its presenter key does not match the server copy. Head back to the studio.'
              : 'Check your connection and try again.'
        }
        retry={
          loadError !== 'not_found' && loadError !== 'unauthorized'
            ? () => setAttempt((a) => a + 1)
            : undefined
        }
      />
    );
  }

  return <EditorShell deckId={deckId} presenterKey={presenterKey} initialDeck={deck!} />;
}

function CenteredNotice({ title, body, retry }: { title: string; body: string; retry?: () => void }) {
  return (
    <div className="flex h-dvh items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-edge bg-panel p-8 text-center">
        <h1 className="text-xl font-bold text-fg">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-dim">{body}</p>
        <div className="mt-6 flex justify-center gap-3">
          {retry && (
            <Button variant="secondary" onClick={retry}>
              Try again
            </Button>
          )}
          <Link
            href="/studio"
            className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-semibold transition-all duration-150 ${
              retry
                ? 'bg-transparent text-fg-dim hover:bg-panel-2 hover:text-fg'
                : 'bg-accent text-white shadow-accent-glow hover:brightness-110'
            }`}
          >
            Back to studio
          </Link>
        </div>
      </div>
    </div>
  );
}

function EditorShell({
  deckId,
  presenterKey,
  initialDeck,
}: {
  deckId: string;
  presenterKey: string;
  initialDeck: Deck;
}) {
  const ed = useDeckEditor({
    deckId,
    presenterKey,
    initial: initialDeck,
    onSaved: (d) =>
      storeDeckRef({ id: deckId, title: d.title, presenterKey, updatedAt: new Date().toISOString() }),
  });
  const { deck, update } = ed;

  const [selectedId, setSelectedId] = useState<string | null>(initialDeck.slides[0]?.id ?? null);
  const [modal, setModal] = useState<StudioModal | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [live, setLive] = useState<LiveSessionRef | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const modalRef = useRef<StudioModal | null>(null);
  modalRef.current = modal;

  const slides = deck.slides;
  const selected = slides.find((s) => s.id === selectedId) ?? slides[0] ?? null;
  const selectedIndex = selected ? slides.indexOf(selected) : -1;

  useEffect(() => {
    setLive(getLiveSession(deckId));
  }, [deckId, modal]);

  // ---------- slide operations ----------
  const addSlide = useCallback(
    (kind: SlideKind) => {
      const s = newSlide(kind);
      update((d) => {
        const at = selectedIndex >= 0 ? selectedIndex + 1 : d.slides.length;
        const next = [...d.slides];
        next.splice(at, 0, s);
        return { ...d, slides: reindex(next) };
      });
      setSelectedId(s.id);
    },
    [update, selectedIndex],
  );

  // Append a multi-slide template pack (fresh ids from the factory each call).
  const addIcebreakers = useCallback(() => {
    const pack = icebreakerSlides();
    update((d) => ({ ...d, slides: reindex([...d.slides, ...pack]) }));
    setSelectedId(pack[0].id);
  }, [update]);

  const duplicateSlide = useCallback(
    (id: string) => {
      let newId: string | null = null;
      update((d) => {
        const i = d.slides.findIndex((s) => s.id === id);
        if (i < 0) return d;
        const copy: Slide = structuredClone(d.slides[i]);
        copy.id = crypto.randomUUID();
        copy.title = copy.title ? `${copy.title} (copy)` : copy.title;
        newId = copy.id;
        const next = [...d.slides];
        next.splice(i + 1, 0, copy);
        return { ...d, slides: reindex(next) };
      });
      if (newId) setSelectedId(newId);
    },
    [update],
  );

  const deleteSlide = useCallback(
    (id: string) => {
      update((d) => ({ ...d, slides: reindex(d.slides.filter((s) => s.id !== id)) }));
    },
    [update],
  );

  const moveSlide = useCallback(
    (from: number, to: number) => {
      update((d) => {
        const next = [...d.slides];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return { ...d, slides: reindex(next) };
      });
    },
    [update],
  );

  const patchSelected = useCallback(
    (fn: (s: Slide) => Slide, coalesce = false) => {
      const id = selected?.id;
      if (!id) return;
      update((d) => ({ ...d, slides: d.slides.map((s) => (s.id === id ? fn(s) : s)) }), { coalesce });
    },
    [update, selected?.id],
  );

  const selectByIndex = useCallback(
    (i: number) => {
      const s = slides[Math.max(0, Math.min(slides.length - 1, i))];
      if (s) setSelectedId(s.id);
    },
    [slides],
  );

  // Apply AI / import results (editor context)
  const applyResult = useCallback(
    (result: AiResult | ImportResult, how: AiApplyMode) => {
      const incoming = result.slides;
      if (incoming.length === 0) return;
      const incomingTheme = 'theme' in result ? result.theme : undefined;
      update((d) => {
        if (how === 'replace') {
          return {
            ...d,
            title: result.title?.trim() ? result.title : d.title,
            // Adopt the AI-picked theme pack + image look on a full replace (keep
            // the user's existing accent override if they set one).
            theme: incomingTheme
              ? {
                  ...d.theme,
                  ...(incomingTheme.pack ? { pack: incomingTheme.pack } : {}),
                  ...(incomingTheme.imageStyle ? { imageStyle: incomingTheme.imageStyle } : {}),
                  ...(incomingTheme.imageProvider
                    ? { imageProvider: incomingTheme.imageProvider }
                    : {}),
                }
              : d.theme,
            slides: reindex(incoming),
          };
        }
        return { ...d, slides: reindex([...d.slides, ...incoming]) };
      });
      setSelectedId(incoming[0].id);
      setModal(null);
    },
    [update],
  );

  // ---------- drag-and-drop image (canvas dropzone) ----------
  const applyDroppedImage = useCallback(
    (url: string) => {
      patchSelected((s) => {
        if (s.kind !== 'content') return s; // guard: dropzone only allows content slides
        const blocks = s.body.blocks ?? [];
        if (blocks.length === 0) {
          return { ...s, body: { ...s.body, backgroundImage: url } };
        }
        return {
          ...s,
          body: { ...s.body, blocks: [...blocks, { type: 'image', url, fit: 'contain' }] },
        };
      });
    },
    [patchSelected],
  );

  const dropBlockedHint = !selected
    ? 'Add a content slide first, then drop images onto it.'
    : selected.kind !== 'content'
      ? 'Images can only be dropped on content slides — pick one in the slide rail.'
      : '';

  // ---------- export ----------
  const exportPptx = useCallback(async () => {
    setExporting(true);
    setExportError('');
    try {
      const { exportDeckToPptx } = await import('@/lib/export/pptx');
      await exportDeckToPptx(deck);
    } catch {
      setExportError('Export failed — try again in a moment.');
    } finally {
      setExporting(false);
    }
  }, [deck]);

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        ed.saveNow();
        return;
      }
      if (modalRef.current) return; // don't mutate the deck behind a dialog
      if (k === 'z') {
        e.preventDefault();
        if (e.shiftKey) ed.redo();
        else ed.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ed.saveNow, ed.undo, ed.redo]);

  return (
    <div className="flex h-dvh flex-col bg-ink">
      <EditorTopBar
        deck={deck}
        saveState={ed.saveState}
        canUndo={ed.canUndo}
        canRedo={ed.canRedo}
        exporting={exporting}
        previewOpen={previewOpen}
        onTitle={(title) => update((d) => ({ ...d, title }), { coalesce: true })}
        onAccent={(hex) => update((d) => ({ ...d, theme: { ...d.theme, accent: hex } }))}
        onThemePack={(pack) => update((d) => ({ ...d, theme: { ...d.theme, pack } }))}
        onImageStyle={(imageStyle) => update((d) => ({ ...d, theme: { ...d.theme, imageStyle } }))}
        onFonts={(fontHeading, fontBody) =>
          update((d) => ({ ...d, theme: { ...d.theme, fontHeading, fontBody } }))
        }
        onOrgName={(orgName) =>
          update((d) => ({ ...d, theme: { ...d.theme, orgName: orgName || undefined } }))
        }
        onLogo={(url) =>
          update((d) => {
            const theme = { ...d.theme };
            if (url) theme.logoUrl = url;
            else delete theme.logoUrl;
            return { ...d, theme };
          })
        }
        onUndo={ed.undo}
        onRedo={ed.redo}
        onOpenAi={() => setModal({ type: 'ai' })}
        onOpenGamma={() => setModal({ type: 'gamma' })}
        onOpenMarkdown={() => setModal({ type: 'markdown' })}
        onOpenSessions={() => setModal({ type: 'sessions' })}
        onOpenLms={() => setModal({ type: 'lms' })}
        onTogglePreview={() => setPreviewOpen((o) => !o)}
        onPickPptx={(file) => setModal({ type: 'file', kind: 'pptx', file })}
        onPickPdf={(file) => setModal({ type: 'file', kind: 'pdf', file })}
        onExportPptx={() => void exportPptx()}
        onPresent={() => setModal({ type: 'golive' })}
      />

      {exportError && (
        <p role="alert" className="border-b border-red/40 bg-red/10 px-4 py-2 text-sm text-red">
          {exportError}
        </p>
      )}

      {live && (
        <div className="flex flex-wrap items-center gap-3 border-b border-edge bg-panel-2/60 px-4 py-2">
          <Pill tone="live">● LIVE</Pill>
          <p className="text-sm text-fg">
            A session for this deck may still be running — join code{' '}
            <span className="font-mono font-bold text-cyan">{live.code}</span>.
          </p>
          <span className="ml-auto flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                window.open(
                  `/present/${live.sessionId}?key=${encodeURIComponent(presenterKey)}`,
                  '_blank',
                  'noopener',
                )
              }
            >
              <IconExternal width={13} height={13} /> Stage
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                window.open(
                  `/remote/${live.sessionId}?key=${encodeURIComponent(presenterKey)}`,
                  '_blank',
                  'noopener',
                )
              }
            >
              <IconExternal width={13} height={13} /> Remote
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearLiveSession(deckId);
                setLive(null);
              }}
            >
              Dismiss
            </Button>
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* LEFT: slide rail */}
        <aside className="w-64 shrink-0 border-r border-edge bg-panel/60" aria-label="Slide list">
          <SlideRail
            slides={slides}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            onMove={moveSlide}
            onDuplicate={duplicateSlide}
            onDelete={deleteSlide}
            onAddClick={() => setModal({ type: 'kind' })}
          />
        </aside>

        {/* CENTER: canvas */}
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6" aria-label="Slide preview">
          <CanvasDropzone
            canDrop={selected?.kind === 'content'}
            blockedHint={dropBlockedHint}
            onUploaded={applyDroppedImage}
          >
            {selected ? (
              <>
                <div className="mx-auto mb-3 flex w-full max-w-[960px] items-center justify-between text-xs text-fg-dim">
                  <span>
                    Slide {selectedIndex + 1} of {slides.length}
                  </span>
                  <span>Click the preview, then ← → to flip slides · ⌘Z undo · ⌘S save</span>
                </div>
                <SlideCanvas
                  slide={selected}
                  theme={deck.theme}
                  onPrev={() => selectByIndex(selectedIndex - 1)}
                  onNext={() => selectByIndex(selectedIndex + 1)}
                />
                {selected.kind === 'content' && (
                  <p className="mx-auto mt-3 w-full max-w-[960px] text-center text-xs text-fg-dim">
                    Tip: drag an image file onto the canvas to add it to this slide.
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <FirstRun
                  onBlank={() => addSlide('content')}
                  onDemoTour={() => {
                    const tour = demoTourSlides();
                    update((d) => ({ ...d, slides: reindex([...d.slides, ...tour]) }));
                    setSelectedId(tour[0].id);
                  }}
                  onIcebreakers={addIcebreakers}
                  onAi={() => setModal({ type: 'ai' })}
                />
              </div>
            )}
          </CanvasDropzone>
        </main>

        {/* RIGHT: inspector */}
        <aside
          className="w-80 shrink-0 overflow-y-auto border-l border-edge bg-panel/60"
          aria-label="Slide settings"
        >
          {selected ? (
            <Inspector slide={selected} patch={patchSelected} />
          ) : (
            <p className="p-6 text-sm leading-relaxed text-fg-dim">
              Add a slide to configure it here — every kind has its own settings.
            </p>
          )}
        </aside>

        {/* FAR RIGHT: audience phone preview (toggled from the top bar) */}
        {previewOpen && (
          <aside
            className="w-[390px] shrink-0 overflow-y-auto border-l border-edge bg-panel/60"
            aria-label="Audience preview"
          >
            <ParticipantPreview
              slide={selected}
              theme={deck.theme}
              onClose={() => setPreviewOpen(false)}
            />
          </aside>
        )}
      </div>

      {/* ---------- modals ---------- */}
      <AiPanel
        open={modal?.type === 'ai'}
        onClose={() => setModal(null)}
        context="editor"
        onApply={applyResult}
      />
      <KindPicker
        open={modal?.type === 'kind'}
        onClose={() => setModal(null)}
        onPick={addSlide}
        onAddIcebreakers={addIcebreakers}
      />
      <MarkdownImportModal
        open={modal?.type === 'markdown'}
        onClose={() => setModal(null)}
        context="editor"
        onApply={applyResult}
      />
      {modal?.type === 'file' && (
        <FileImportModal
          file={modal.file}
          kind={modal.kind}
          context="editor"
          onClose={() => setModal(null)}
          onApply={applyResult}
        />
      )}
      <GammaImportModal
        open={modal?.type === 'gamma'}
        onClose={() => setModal(null)}
        hasSlides={slides.length > 0}
        onApply={applyResult}
      />
      <GoLiveModal
        open={modal?.type === 'golive'}
        onClose={() => setModal(null)}
        deck={deck}
        presenterKey={presenterKey}
      />
      <SessionHistoryModal
        open={modal?.type === 'sessions'}
        onClose={() => setModal(null)}
        deckId={deckId}
        presenterKey={presenterKey}
      />
      <LmsBridgeModal
        open={modal?.type === 'lms'}
        onClose={() => setModal(null)}
        deckId={deckId}
        presenterKey={presenterKey}
      />
    </div>
  );
}
