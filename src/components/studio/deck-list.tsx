'use client';
// /studio — the deck library. Decks are referenced from localStorage (id + presenter key);
// creation/import/AI flows POST to /api/decks then open the editor.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DeckTheme, Slide } from '@/lib/types';
import { Button, Card, Pill, Spinner } from '@/components/shared/ui';
import { ThemeSwitcher } from '@/components/shared/theme-switcher';
import { listStoredDecks, removeDeckRef, storeDeckRef, type StoredDeckRef } from '@/lib/presenter-api';
import { AiPanel, type AiResult } from './ai-panel';
import { ConfirmDialog, Menu } from './modal';
import { FileImportModal, MarkdownImportModal, type ImportResult } from './import-modals';
import {
  createDeck,
  deleteDeckRemote,
  fetchDeck,
  getLiveSession,
  relativeTime,
} from './studio-api';
import { IconMore, IconPlus, IconSparkle } from './icons';

type ListModal =
  | { type: 'ai' }
  | { type: 'markdown' }
  | { type: 'file'; kind: 'pptx' | 'pdf'; file: File }
  | { type: 'delete'; deck: StoredDeckRef };

export function DeckList() {
  const router = useRouter();
  // null = still reading localStorage (first client render)
  const [decks, setDecks] = useState<StoredDeckRef[] | null>(null);
  const [modal, setModal] = useState<ListModal | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyApply, setBusyApply] = useState(false);
  const [actionError, setActionError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dupBusyId, setDupBusyId] = useState<string | null>(null);

  useEffect(() => {
    setDecks(listStoredDecks());
    // Merge decks owned by the signed-in account so they appear on any device.
    (async () => {
      try {
        const res = await fetch('/api/account/decks');
        if (!res.ok) return;
        const { decks: owned } = (await res.json()) as {
          decks?: { id: string; title: string; presenterKey: string; updatedAt: string }[];
        };
        if (Array.isArray(owned) && owned.length) {
          for (const d of owned) {
            storeDeckRef({ id: d.id, title: d.title, presenterKey: d.presenterKey, updatedAt: d.updatedAt });
          }
          setDecks(listStoredDecks());
        }
      } catch {
        /* offline or signed out — local decks still show */
      }
    })();
  }, []);

  const openEditor = (id: string) => router.push(`/studio/${id}`);

  const newDeck = async () => {
    setCreating(true);
    setActionError('');
    try {
      const created = await createDeck();
      storeDeckRef({
        id: created.id,
        title: created.title,
        presenterKey: created.presenterKey,
        updatedAt: new Date().toISOString(),
      });
      openEditor(created.id);
    } catch (e) {
      setActionError(
        (e as Error).message === 'deck_limit'
          ? 'You’ve reached the free plan’s 3-deck limit. Upgrade to Pro for unlimited decks (see Account).'
          : 'Could not create a deck — check your connection and try again.',
      );
      setCreating(false);
    }
  };

  const createFromSlides = async (
    title: string | undefined,
    slides: Slide[],
    theme?: DeckTheme,
  ) => {
    setBusyApply(true);
    setActionError('');
    try {
      const created = await createDeck({ title: title?.trim() || 'Imported deck', slides, theme });
      storeDeckRef({
        id: created.id,
        title: created.title,
        presenterKey: created.presenterKey,
        updatedAt: new Date().toISOString(),
      });
      openEditor(created.id);
    } catch {
      setActionError('Could not create the deck — check your connection and try again.');
      setBusyApply(false);
      setModal(null);
    }
  };

  const onImportApply = (result: ImportResult | AiResult) =>
    createFromSlides(result.title, result.slides, 'theme' in result ? result.theme : undefined);

  // Duplicate: load the source deck with its key, POST a new deck with the same
  // slides (fresh ids) + theme, store the new ref, open the editor on the copy.
  const duplicateDeck = async (ref: StoredDeckRef) => {
    setDupBusyId(ref.id);
    setActionError('');
    try {
      const source = await fetchDeck(ref.id, ref.presenterKey);
      const slides = source.slides.map((s) => ({
        ...structuredClone(s),
        id: crypto.randomUUID(),
      }));
      const created = await createDeck({
        title: `Copy of ${source.title || 'Untitled deck'}`,
        theme: source.theme,
        slides,
      });
      storeDeckRef({
        id: created.id,
        title: created.title,
        presenterKey: created.presenterKey,
        updatedAt: new Date().toISOString(),
      });
      openEditor(created.id);
    } catch {
      setActionError('Could not duplicate the deck — check your connection and try again.');
      setDupBusyId(null);
    }
  };

  const confirmDelete = async (ref: StoredDeckRef) => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteDeckRemote(ref.id, ref.presenterKey);
      removeDeckRef(ref.id);
      setDecks(listStoredDecks());
      setModal(null);
    } catch {
      setDeleteError('Delete failed — check your connection and try again.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const importMenu = (
    <Menu
      label="Import"
      items={[
        {
          label: 'PowerPoint (.pptx)…',
          hint: 'Turn an existing PowerPoint into a PulseDeck',
          onSelect: () => document.getElementById('pd-list-pptx')?.click(),
        },
        {
          label: 'PDF…',
          hint: 'Each page becomes a full-bleed slide',
          onSelect: () => document.getElementById('pd-list-pdf')?.click(),
        },
        {
          label: 'Markdown…',
          hint: 'Paste text — headings become slides',
          onSelect: () => setModal({ type: 'markdown' }),
        },
      ]}
    />
  );

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <Link href="/" className="text-sm font-semibold text-fg-dim transition-colors hover:text-fg">
            ← PulseDeck
          </Link>
          <h1 className="mt-1 text-3xl font-extrabold text-fg">Studio</h1>
          <p className="mt-1 text-sm text-fg-dim">
            Your decks, synced to your account and ready to present.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/studio/analytics"
            className="inline-flex min-h-[40px] items-center rounded-full border border-edge px-4 text-sm font-semibold text-fg-dim transition-colors hover:border-accent/50 hover:text-fg"
          >
            Analytics
          </Link>
          <Link
            href="/account"
            className="inline-flex min-h-[40px] items-center rounded-full border border-edge px-4 text-sm font-semibold text-fg-dim transition-colors hover:border-accent/50 hover:text-fg"
          >
            Account
          </Link>
          <ThemeSwitcher />
          {importMenu}
          <Button variant="secondary" size="md" onClick={() => setModal({ type: 'ai' })}>
            <IconSparkle width={15} height={15} /> Generate with AI
          </Button>
          <Button size="md" onClick={() => void newDeck()} disabled={creating}>
            <IconPlus width={15} height={15} /> {creating ? 'Creating…' : 'New deck'}
          </Button>
        </div>
      </header>

      {actionError && (
        <p role="alert" className="mb-5 rounded-xl border border-red/40 bg-red/10 px-4 py-3 text-sm text-red">
          {actionError}
        </p>
      )}

      {dupBusyId && (
        <p
          aria-live="polite"
          className="mb-5 flex items-center gap-2.5 rounded-xl border border-edge bg-panel px-4 py-3 text-sm text-fg-dim"
        >
          <Spinner className="h-4 w-4" /> Duplicating deck…
        </p>
      )}

      {decks === null && (
        <div className="flex items-center justify-center gap-3 py-24 text-fg-dim">
          <Spinner /> Loading your decks…
        </div>
      )}

      {decks !== null && decks.length === 0 && (
        <Card className="px-8 py-14 text-center">
          <p className="text-4xl" aria-hidden="true">
            🎤
          </p>
          <h2 className="mt-4 text-2xl font-bold text-fg">Presentations with a pulse</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg-dim">
            Build slides your audience is part of: live polls, word clouds, timed quizzes with a
            leaderboard, and Q&amp;A with upvoting — they join on their phones with a QR code, no app.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={() => void newDeck()} disabled={creating}>
              <IconPlus width={16} height={16} /> {creating ? 'Creating…' : 'Create your first deck'}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setModal({ type: 'ai' })}>
              <IconSparkle width={16} height={16} /> Generate with AI
            </Button>
          </div>
          <p className="mt-5 text-xs text-fg-dim">
            Have slides already? Import a .pptx, a PDF or markdown from the Import menu above.
          </p>
        </Card>
      )}

      {decks !== null && decks.length > 0 && (
        <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((d) => {
            const live = getLiveSession(d.id);
            return (
              <li key={d.id} className="group relative">
                <Card className="h-full p-0 transition-colors hover:border-accent/60">
                  <button
                    type="button"
                    onClick={() => openEditor(d.id)}
                    className="flex h-full min-h-[120px] w-full flex-col items-start rounded-2xl p-5 text-left"
                  >
                    <span className="flex w-full items-start justify-between gap-2 pr-14">
                      <span className="line-clamp-2 text-base font-bold text-fg">
                        {d.title || 'Untitled deck'}
                      </span>
                      {live && <Pill tone="live">LIVE</Pill>}
                    </span>
                    <span className="mt-auto pt-4 text-xs text-fg-dim">
                      Edited {relativeTime(d.updatedAt) || 'recently'}
                    </span>
                  </button>
                </Card>
                <div className="absolute right-3 top-3">
                  <Menu
                    variant="ghost"
                    label={
                      <>
                        <IconMore width={16} height={16} />
                        <span className="sr-only">Actions for deck {d.title || 'Untitled deck'}</span>
                      </>
                    }
                    items={[
                      {
                        label: dupBusyId === d.id ? 'Duplicating…' : 'Duplicate',
                        hint: 'New deck with the same slides and theme',
                        disabled: dupBusyId !== null,
                        onSelect: () => void duplicateDeck(d),
                      },
                      {
                        label: 'Delete…',
                        hint: 'Permanently delete this deck',
                        danger: true,
                        disabled: dupBusyId !== null,
                        onSelect: () => {
                          setDeleteError(null);
                          setModal({ type: 'delete', deck: d });
                        },
                      },
                    ]}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* hidden file inputs for the import menu */}
      <input
        id="pd-list-pptx"
        type="file"
        accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        className="hidden"
        aria-label="Choose a PowerPoint file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setModal({ type: 'file', kind: 'pptx', file: f });
          e.target.value = '';
        }}
      />
      <input
        id="pd-list-pdf"
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        aria-label="Choose a PDF file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setModal({ type: 'file', kind: 'pdf', file: f });
          e.target.value = '';
        }}
      />

      {/* ---------- modals ---------- */}
      <AiPanel
        open={modal?.type === 'ai'}
        onClose={() => setModal(null)}
        context="create"
        busyApply={busyApply}
        onApply={(r) => onImportApply(r)}
      />
      <MarkdownImportModal
        open={modal?.type === 'markdown'}
        onClose={() => setModal(null)}
        context="create"
        busyApply={busyApply}
        onApply={(r) => onImportApply(r)}
      />
      {modal?.type === 'file' && (
        <FileImportModal
          file={modal.file}
          kind={modal.kind}
          context="create"
          busyApply={busyApply}
          onClose={() => setModal(null)}
          onApply={(r) => onImportApply(r)}
        />
      )}
      <ConfirmDialog
        open={modal?.type === 'delete'}
        title="Delete this deck?"
        body={
          modal?.type === 'delete'
            ? `"${modal.deck.title || 'Untitled deck'}" and all of its slides will be permanently deleted. Past session reports are kept.`
            : ''
        }
        confirmLabel="Delete deck"
        danger
        busy={deleteBusy}
        error={deleteError}
        onCancel={() => setModal(null)}
        onConfirm={() => {
          if (modal?.type === 'delete') void confirmDelete(modal.deck);
        }}
      />
    </div>
  );
}
