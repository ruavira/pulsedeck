'use client';
// Client helper for presenter-authenticated API calls.
// Presenter keys are stored per-deck in localStorage under pd_decks.

export interface StoredDeckRef {
  id: string;
  title: string;
  presenterKey: string;
  updatedAt: string;
}

const DECKS_KEY = 'pd_decks';

export function listStoredDecks(): StoredDeckRef[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(DECKS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function storeDeckRef(ref: StoredDeckRef) {
  const decks = listStoredDecks().filter((d) => d.id !== ref.id);
  decks.unshift(ref);
  localStorage.setItem(DECKS_KEY, JSON.stringify(decks.slice(0, 50)));
}

export function getPresenterKey(deckId: string): string | null {
  return listStoredDecks().find((d) => d.id === deckId)?.presenterKey ?? null;
}

export function removeDeckRef(deckId: string) {
  localStorage.setItem(DECKS_KEY, JSON.stringify(listStoredDecks().filter((d) => d.id !== deckId)));
}

// Session -> presenter key mapping (a session belongs to a deck)
const SESSION_KEYS = 'pd_session_keys';
export function storeSessionKey(sessionId: string, presenterKey: string) {
  try {
    const m = JSON.parse(localStorage.getItem(SESSION_KEYS) ?? '{}');
    m[sessionId] = presenterKey;
    localStorage.setItem(SESSION_KEYS, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}
export function getSessionKey(sessionId: string): string | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEYS) ?? '{}')[sessionId] ?? null;
  } catch {
    return null;
  }
}

/** POST to a presenter API route with auth header. Throws on non-2xx. */
export async function presenterPost<T = unknown>(
  path: string,
  presenterKey: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-presenter-key': presenterKey },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${path} -> ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}
