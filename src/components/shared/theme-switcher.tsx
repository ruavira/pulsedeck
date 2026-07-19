'use client';
// Global theme picker — persists per browser, applies to every surface
// (studio, stage, remote, audience) via data-theme on <html>.
import { useEffect, useState } from 'react';

export const THEMES = [
  { id: 'ice', name: 'Ice & Azure', swatch: '#1e88d2', bg: '#f5f9fc' },
  { id: 'sky', name: 'Sky Navy', swatch: '#53c1f0', bg: '#10527f' },
  { id: 'teal', name: 'Teal Fresh', swatch: '#109d8d', bg: '#f0faf9' },
  { id: 'sunrise', name: 'Sunrise', swatch: '#d97a06', bg: '#fdfaf3' },
  { id: 'navy', name: 'Deep Navy', swatch: '#2f86c9', bg: '#061826' },
  { id: 'aurora', name: 'Aurora', swatch: '#8b7cf6', bg: '#14123c' },
  { id: 'sand', name: 'Sand', swatch: '#c2653c', bg: '#faf6f0' },
  { id: 'pop', name: 'Pop', swatch: '#4f46e5', bg: '#ffffff' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export function applyTheme(id: ThemeId) {
  if (id === 'ice') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem('pd_theme', id);
  } catch {
    /* ignore */
  }
}

export function ThemeSwitcher({ className = '' }: { className?: string }) {
  const [current, setCurrent] = useState<ThemeId>('ice');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem('pd_theme') as ThemeId) || 'ice';
    setCurrent(saved);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const active = THEMES.find((t) => t.id === current) ?? THEMES[0];

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Theme: ${active.name}`}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-edge bg-panel px-4 py-2 text-sm font-semibold text-fg transition-colors hover:border-accent/60"
      >
        <span
          className="h-4 w-4 rounded-full border border-black/10"
          style={{ background: `linear-gradient(135deg, ${active.bg} 50%, ${active.swatch} 50%)` }}
          aria-hidden
        />
        Theme
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <ul
            role="listbox"
            className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-edge bg-panel py-1 shadow-xl"
          >
            {THEMES.map((t) => (
              <li key={t.id}>
                <button
                  role="option"
                  aria-selected={t.id === current}
                  onClick={() => {
                    setCurrent(t.id);
                    applyTheme(t.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-panel-2 ${
                    t.id === current ? 'text-accent' : 'text-fg'
                  }`}
                >
                  <span
                    className="h-5 w-5 shrink-0 rounded-full border border-black/10"
                    style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.swatch} 50%)` }}
                    aria-hidden
                  />
                  {t.name}
                  {t.id === current && <span className="ml-auto" aria-hidden>✓</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
