'use client';
// Studio-side API helpers around the /api/decks routes + small client utilities.
// Presenter auth: x-presenter-key header (see src/lib/presenter-api.ts for key storage).

import type { Deck, DeckTheme, Slide, SlideSettings } from '@/lib/types';
import { APP_ORIGIN } from '@/lib/config';

/** Studio-local extension: quiz speed bonus flag persisted inside slide settings JSON. */
export type StudioSlideSettings = SlideSettings & { speedBonus?: boolean };

export function getSpeedBonus(s: SlideSettings): boolean {
  return (s as StudioSlideSettings).speedBonus ?? false;
}

interface DeckApiRow {
  id: string;
  title: string;
  theme: DeckTheme | null;
  updated_at?: string;
  slides?: Slide[];
}

export async function fetchDeck(deckId: string, presenterKey: string): Promise<Deck> {
  const res = await fetch(`/api/decks/${deckId}`, {
    headers: { 'x-presenter-key': presenterKey },
    cache: 'no-store',
  });
  if (res.status === 401) throw new Error('unauthorized');
  if (res.status === 404) throw new Error('not_found');
  if (!res.ok) throw new Error(`load_failed_${res.status}`);
  const data = (await res.json()) as DeckApiRow;
  const slides = [...(data.slides ?? [])].sort((a, b) => a.position - b.position);
  return {
    id: data.id,
    title: data.title ?? 'Untitled deck',
    theme: data.theme ?? {},
    slides,
    updatedAt: data.updated_at,
  };
}

export async function saveDeck(
  deckId: string,
  presenterKey: string,
  deck: Deck,
  keepalive = false,
): Promise<void> {
  const res = await fetch(`/api/decks/${deckId}`, {
    method: 'PUT',
    keepalive,
    headers: { 'content-type': 'application/json', 'x-presenter-key': presenterKey },
    body: JSON.stringify({ title: deck.title, theme: deck.theme, slides: reindex(deck.slides) }),
  });
  if (!res.ok) throw new Error(`save_failed_${res.status}`);
}

export interface CreatedDeck {
  id: string;
  title: string;
  presenterKey: string;
}

export async function createDeck(init?: {
  title?: string;
  theme?: DeckTheme;
  slides?: Slide[];
}): Promise<CreatedDeck> {
  const res = await fetch('/api/decks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: init?.title,
      theme: init?.theme,
      slides: init?.slides ? reindex(init.slides) : undefined,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<CreatedDeck> & { error?: string };
  if (!res.ok || !data.id || !data.presenterKey) {
    throw new Error(data.error ?? `create_failed_${res.status}`);
  }
  return { id: data.id, title: data.title ?? 'Untitled deck', presenterKey: data.presenterKey };
}

export async function deleteDeckRemote(deckId: string, presenterKey: string): Promise<void> {
  const res = await fetch(`/api/decks/${deckId}`, {
    method: 'DELETE',
    headers: { 'x-presenter-key': presenterKey },
  });
  // 401/404 mean the server copy is unreachable/gone for this key — the local ref
  // is stale either way, so callers treat those as "safe to forget locally".
  if (!res.ok && res.status !== 404 && res.status !== 401) {
    throw new Error(`delete_failed_${res.status}`);
  }
}

// Auto-compresses large sources in the browser before upload (see media-client).
export { uploadImage } from '@/lib/media-client';

export interface SessionCreateResult {
  sessionId: string;
  code: string;
  stagePath: string;
  remotePath: string;
  joinPath: string;
}

// ---------- live-session memory (per browser, studio-local) ----------
export interface LiveSessionRef {
  sessionId: string;
  code: string;
  createdAt: string;
}
const LIVE_KEY = 'pd_studio_live';

function readLiveMap(): Record<string, LiveSessionRef> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(LIVE_KEY) ?? '{}') as Record<string, LiveSessionRef>;
  } catch {
    return {};
  }
}
export function getLiveSession(deckId: string): LiveSessionRef | null {
  return readLiveMap()[deckId] ?? null;
}
export function setLiveSession(deckId: string, ref: LiveSessionRef) {
  try {
    const m = readLiveMap();
    m[deckId] = ref;
    localStorage.setItem(LIVE_KEY, JSON.stringify(m));
  } catch {
    /* storage full/blocked — non-fatal */
  }
}
export function clearLiveSession(deckId: string) {
  try {
    const m = readLiveMap();
    delete m[deckId];
    localStorage.setItem(LIVE_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

// ---------- misc utilities ----------
export function reindex(slides: Slide[]): Slide[] {
  return slides.map((s, i) => ({ ...s, position: i }));
}

/** Absolute origin for share links: deployed origin if configured, else this window. */
export function appOrigin(): string {
  if (APP_ORIGIN.startsWith('http')) return APP_ORIGIN;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function relativeTime(iso?: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(t).toLocaleDateString();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Upload a video DIRECTLY to Supabase storage via a signed upload URL
 * (serverless functions can't proxy 200MB bodies). Returns the public URL.
 */
export async function uploadVideo(file: File): Promise<string> {
  const sign = await fetch('/api/upload-video', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename: file.name, size: file.size, type: file.type }),
  });
  const meta = (await sign.json().catch(() => ({}))) as {
    path?: string;
    token?: string;
    publicUrl?: string;
    error?: string;
  };
  if (!sign.ok || !meta.path || !meta.token || !meta.publicUrl) {
    throw new Error(meta.error ?? 'sign_failed');
  }
  const { getSupabase } = await import('@/lib/supabase/client');
  const { error } = await getSupabase()
    .storage.from('media')
    .uploadToSignedUrl(meta.path, meta.token, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return meta.publicUrl;
}
