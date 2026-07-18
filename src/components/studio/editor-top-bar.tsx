'use client';
// Editor top bar: back link, inline deck title, theme accent presets, save state,
// undo/redo, Import / Export / AI menus, and the big Present button.

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Deck, ImageStyle, ThemePack } from '@/lib/types';
import { Button } from '@/components/shared/ui';
import { THEMES, type ThemeId } from '@/components/shared/theme-switcher';
import { IMAGE_STYLES } from '@/lib/image-catalog';
import { FONT_PAIRINGS, pairingFor } from '@/lib/font-pairings';
import { Menu } from './modal';
import type { SaveState } from './use-deck-editor';
import { IconEye, IconHistory, IconPlay, IconRedo, IconSparkle, IconUndo } from './icons';

export const ACCENT_PRESETS: { hex: string; name: string }[] = [
  { hex: '#2F86C9', name: 'RCI Blue' },
  { hex: '#35C4C8', name: 'Teal' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#10B981', name: 'Emerald' },
  { hex: '#F472B6', name: 'Rose' },
  { hex: '#EF4444', name: 'Red' },
];

const SAVE_LABEL: Record<SaveState, string> = {
  saved: 'Saved',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Offline — retrying…',
};

export function EditorTopBar({
  deck,
  saveState,
  canUndo,
  canRedo,
  exporting,
  previewOpen,
  onTitle,
  onAccent,
  onThemePack,
  onImageStyle,
  onFonts,
  onLogo,
  onOrgName,
  onUndo,
  onRedo,
  onOpenAi,
  onOpenMarkdown,
  onOpenSessions,
  onTogglePreview,
  onPickPptx,
  onPickPdf,
  onExportPptx,
  onPresent,
}: {
  deck: Deck;
  saveState: SaveState;
  canUndo: boolean;
  canRedo: boolean;
  exporting: boolean;
  previewOpen: boolean;
  onTitle: (title: string) => void;
  onAccent: (hex: string) => void;
  onThemePack: (pack: ThemePack) => void;
  onImageStyle: (style: ImageStyle) => void;
  onFonts: (heading: string, body: string) => void;
  onLogo: (url: string | null) => void;
  onOrgName: (name: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenAi: () => void;
  onOpenMarkdown: () => void;
  onOpenSessions: () => void;
  onTogglePreview: () => void;
  onPickPptx: (file: File) => void;
  onPickPdf: (file: File) => void;
  onExportPptx: () => void;
  onPresent: () => void;
}) {
  const pptxRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);
  const accent = deck.theme.accent ?? ACCENT_PRESETS[0].hex;
  const currentPack = (deck.theme.pack ?? 'ice') as ThemeId;
  const activePack = THEMES.find((t) => t.id === currentPack) ?? THEMES[0];
  const currentStyle = deck.theme.imageStyle ?? 'auto';
  const currentPairing = pairingFor(deck.theme.fontHeading, deck.theme.fontBody);

  const uploadLogo = async (file: File) => {
    setLogoBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (res.ok && data.url) onLogo(data.url);
    } finally {
      setLogoBusy(false);
    }
  };

  // Close the accent popover on outside click / Escape (same behavior as Menu).
  useEffect(() => {
    if (!themeOpen) return;
    const onDown = (e: PointerEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setThemeOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [themeOpen]);

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-edge bg-panel px-4 py-2.5">
      <Link
        href="/studio"
        className="flex min-h-[44px] items-center rounded-lg px-2 text-sm font-semibold text-fg-dim transition-colors hover:text-fg"
      >
        ← Studio
      </Link>

      <input
        value={deck.title}
        aria-label="Deck title"
        placeholder="Untitled deck"
        onChange={(e) => onTitle(e.target.value)}
        className="min-h-[44px] w-52 min-w-0 flex-shrink rounded-lg border border-transparent bg-transparent px-2.5 text-[15px] font-bold text-fg transition-colors hover:border-edge focus:border-accent focus:outline-none md:w-64"
      />

      {/* Theme accent picker */}
      <div ref={themeRef} className="relative">
        <button
          type="button"
          aria-haspopup="true"
          aria-expanded={themeOpen}
          aria-label={`Deck theme: ${activePack.name}. Click to change theme and accent.`}
          onClick={() => setThemeOpen((o) => !o)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-edge bg-panel-2 transition-colors hover:border-accent/60"
        >
          <span
            className="h-5 w-5 rounded-full border border-black/10"
            style={{ background: `linear-gradient(135deg, ${activePack.bg} 50%, ${activePack.swatch} 50%)` }}
            aria-hidden="true"
          />
        </button>
        {themeOpen && (
          <div className="absolute left-0 z-40 mt-2 w-64 rounded-xl border border-edge bg-panel-2 p-3 shadow-pop">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-dim">
              Theme — applies to this deck
            </p>
            <div className="mb-3 grid grid-cols-4 gap-2" role="listbox" aria-label="Deck theme">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={t.id === currentPack}
                  aria-label={`Theme: ${t.name}`}
                  title={t.name}
                  onClick={() => onThemePack(t.id as ThemePack)}
                  className={`flex h-10 items-center justify-center rounded-lg border-2 transition-transform hover:scale-105 ${
                    t.id === currentPack ? 'border-fg' : 'border-transparent'
                  }`}
                >
                  <span
                    className="h-7 w-7 rounded-full border border-black/10"
                    style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.swatch} 50%)` }}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-dim">
              Accent
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ACCENT_PRESETS.map((a) => (
                <button
                  key={a.hex}
                  type="button"
                  aria-label={`Accent: ${a.name}`}
                  title={a.name}
                  onClick={() => onAccent(a.hex)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 ${
                    a.hex.toLowerCase() === accent.toLowerCase() ? 'border-fg' : 'border-transparent'
                  }`}
                >
                  <span className="h-6 w-6 rounded-full" style={{ backgroundColor: a.hex }} aria-hidden="true" />
                </button>
              ))}
            </div>
            {/* Custom brand color — any hex */}
            <div className="mt-2.5 flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#2F86C9'}
                onChange={(e) => onAccent(e.target.value)}
                aria-label="Custom accent color picker"
                className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border border-edge bg-transparent p-0.5"
              />
              <input
                type="text"
                defaultValue={accent}
                key={accent}
                placeholder="#RRGGBB"
                spellCheck={false}
                aria-label="Custom accent hex code"
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) onAccent(v);
                }}
                className="h-8 w-24 rounded-lg border border-edge bg-panel px-2 font-mono text-xs text-fg focus:border-accent focus:outline-none"
              />
            </div>
            <p className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-dim">
              Image style
            </p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Deck image style">
              {IMAGE_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={s.id === currentStyle}
                  title={s.hint}
                  onClick={() => onImageStyle(s.id)}
                  className={`min-h-[32px] rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    s.id === currentStyle
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-edge bg-panel text-fg-dim hover:text-fg'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-dim">
              Fonts
            </p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Deck font pairing">
              {FONT_PAIRINGS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={p.id === currentPairing}
                  onClick={() => onFonts(p.heading, p.body)}
                  className={`min-h-[32px] rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    p.id === currentPairing
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-edge bg-panel text-fg-dim hover:text-fg'
                  }`}
                  style={p.heading ? { fontFamily: `"${p.heading}", inherit` } : undefined}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <p className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-dim">
              Brand logo
            </p>
            <div className="flex items-center gap-2">
              {deck.theme.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={deck.theme.logoUrl}
                  alt="Deck logo"
                  className="h-8 w-8 rounded border border-edge bg-panel object-contain p-0.5"
                />
              )}
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                disabled={logoBusy}
                className="min-h-[32px] rounded-full border border-edge bg-panel px-3 text-[11px] font-semibold text-fg transition-colors hover:border-accent/60 disabled:opacity-50"
              >
                {logoBusy ? 'Uploading…' : deck.theme.logoUrl ? 'Replace' : 'Upload logo'}
              </button>
              {deck.theme.logoUrl && (
                <button
                  type="button"
                  onClick={() => onLogo(null)}
                  className="min-h-[32px] px-2 text-[11px] font-medium text-fg-dim transition-colors hover:text-fg"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-dim">
              Organization name
            </p>
            <input
              type="text"
              value={deck.theme.orgName ?? ''}
              onChange={(e) => onOrgName(e.target.value)}
              placeholder="e.g. Ruavira Collective"
              className="w-full rounded-lg border border-edge bg-panel px-2.5 py-1.5 text-xs text-fg placeholder:text-fg-dim/60 focus:border-accent/60 focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-fg-dim">Shown on the lobby, join screen and certificate.</p>
          </div>
        )}
      </div>

      <span
        aria-live="polite"
        className={`text-xs font-medium ${
          saveState === 'error' ? 'text-red' : saveState === 'saved' ? 'text-fg-dim' : 'text-fg'
        }`}
      >
        {SAVE_LABEL[saveState]}
      </span>

      <span className="flex gap-1">
        <button
          type="button"
          aria-label="Undo (Cmd or Ctrl+Z)"
          title="Undo (⌘Z)"
          disabled={!canUndo}
          onClick={onUndo}
          className="flex h-11 w-11 items-center justify-center rounded-full text-fg-dim transition-colors hover:bg-panel-2 hover:text-fg disabled:opacity-30"
        >
          <IconUndo width={16} height={16} />
        </button>
        <button
          type="button"
          aria-label="Redo (Cmd or Ctrl+Shift+Z)"
          title="Redo (⇧⌘Z)"
          disabled={!canRedo}
          onClick={onRedo}
          className="flex h-11 w-11 items-center justify-center rounded-full text-fg-dim transition-colors hover:bg-panel-2 hover:text-fg disabled:opacity-30"
        >
          <IconRedo width={16} height={16} />
        </button>
      </span>

      <span className="ml-auto flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onOpenSessions}>
          <IconHistory width={14} height={14} /> Sessions
        </Button>
        <Button
          type="button"
          variant={previewOpen ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={previewOpen}
          onClick={onTogglePreview}
          className={previewOpen ? 'border-accent/60' : ''}
        >
          <IconEye width={14} height={14} /> Preview
        </Button>
        <Menu
          label="Import"
          items={[
            {
              label: 'PowerPoint (.pptx)…',
              hint: 'Extract slides from a PowerPoint file',
              onSelect: () => pptxRef.current?.click(),
            },
            {
              label: 'PDF…',
              hint: 'Each page becomes a full-bleed slide',
              onSelect: () => pdfRef.current?.click(),
            },
            {
              label: 'Markdown…',
              hint: 'Paste text — headings become slides',
              onSelect: onOpenMarkdown,
            },
          ]}
        />
        <Menu
          label={exporting ? 'Exporting…' : 'Export'}
          items={[
            {
              label: 'Download as .pptx',
              hint: 'Slides only, for offline backup',
              disabled: exporting || deck.slides.length === 0,
              onSelect: onExportPptx,
            },
          ]}
          footnote="Results export lives on the report page after a session."
        />
        <Button type="button" variant="secondary" size="sm" onClick={onOpenAi}>
          <IconSparkle width={14} height={14} /> AI
        </Button>
        <Button type="button" size="sm" onClick={onPresent}>
          <IconPlay width={14} height={14} /> Present
        </Button>
      </span>

      <input
        ref={pptxRef}
        type="file"
        accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        className="hidden"
        aria-label="Choose a PowerPoint file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickPptx(f);
          e.target.value = '';
        }}
      />
      <input
        ref={pdfRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        aria-label="Choose a PDF file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickPdf(f);
          e.target.value = '';
        }}
      />
      <input
        ref={logoRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        aria-label="Choose a logo image"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadLogo(f);
          e.target.value = '';
        }}
      />
    </header>
  );
}
