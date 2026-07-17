// Local contracts + tiny helpers for the presenter phone remote.
// Shapes mirror GET /api/presenter/[sessionId] and src/lib/types.ts — do not diverge.

import type {
  DeckSnapshot,
  Phase,
  SessionSettings,
  SessionState,
  SessionStatus,
  SlideKind,
} from '@/lib/types';

/**
 * The sibling settings route (`POST /api/presenter/[sessionId]/settings`) merges
 * arbitrary partial settings. `locked` (block new joins) is used by the panic bar
 * but is not yet declared on the shared SessionSettings type — see contract notes.
 */
export type RemoteSessionSettings = SessionSettings & { locked?: boolean };

/** Response of GET /api/presenter/[sessionId] */
export interface PresenterSession {
  id: string;
  code: string;
  deckId: string;
  status: SessionStatus;
  currentSlideIndex: number;
  phase: Phase;
  phaseOpenedAt: string | null;
  settings: RemoteSessionSettings;
  deck: DeckSnapshot;
  startedAt: string | null;
}

/** Body of POST /api/presenter/[sessionId]/advance */
export interface AdvanceBody {
  index?: number;
  phase?: Phase;
  status?: SessionStatus;
}

/** Fire an advance mutation. Returns true on success (false = surfaced as toast). */
export type RemoteAdvance = (
  actionId: string,
  body: AdvanceBody,
  optimistic?: Partial<SessionState>,
) => Promise<boolean>;

/** Merge a partial settings patch via the sibling settings route. */
export type RemoteUpdateSettings = (
  actionId: string,
  patch: Partial<RemoteSessionSettings>,
) => Promise<boolean>;

export const INTERACTIVE_KINDS: ReadonlySet<SlideKind> = new Set<SlideKind>([
  'poll',
  'wordcloud',
  'quiz',
  'scale',
  'ranking',
  'open_text',
]);

export const KIND_LABELS: Record<SlideKind, string> = {
  content: 'Slide',
  poll: 'Poll',
  wordcloud: 'Word cloud',
  quiz: 'Quiz',
  qa: 'Q&A',
  scale: 'Scale',
  ranking: 'Ranking',
  open_text: 'Open text',
  timer: 'Timer',
  breathing: 'Breathing',
  join: 'Join',
};

export const PHASE_LABELS: Record<Phase, string> = {
  show: 'Not opened',
  open: 'Voting open',
  closed: 'Voting closed',
  reveal: 'Results shown',
};

export class PresenterAuthError extends Error {
  constructor() {
    super('Presenter key rejected');
    this.name = 'PresenterAuthError';
  }
}

/** GET a presenter route with auth header. Throws PresenterAuthError on 401/403. */
export async function presenterGet<T>(path: string, presenterKey: string): Promise<T> {
  const res = await fetch(path, {
    headers: { 'x-presenter-key': presenterKey },
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 403) throw new PresenterAuthError();
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${path} -> ${res.status} ${text.slice(0, 120)}`);
  }
  return (await res.json()) as T;
}
