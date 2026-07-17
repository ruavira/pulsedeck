// PulseDeck shared types — the single source of truth for data shapes.
// The DB stores decks/slides as rows, but a live session runs off deck_snapshot
// (a frozen DeckSnapshot JSON) so mid-talk edits can never corrupt a running session.

export type SlideKind =
  | 'content'
  | 'poll'
  | 'wordcloud'
  | 'quiz'
  | 'qa'
  | 'scale'
  | 'ranking'
  | 'open_text'
  | 'timer'
  | 'breathing'
  | 'join';

/** Kinds that collect audience responses (open/close/reveal phase flow applies). */
export const INTERACTIVE_KINDS: readonly SlideKind[] = [
  'poll',
  'wordcloud',
  'quiz',
  'qa',
  'scale',
  'ranking',
  'open_text',
] as const;

export const isInteractiveKind = (k: SlideKind): boolean => INTERACTIVE_KINDS.includes(k);

export type Phase = 'show' | 'open' | 'closed' | 'reveal';
export type SessionStatus = 'lobby' | 'live' | 'ended';

// ---------- Content blocks (content slides) ----------
export type ContentBlock =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string } // markdown-lite: **bold**, *italic*, line breaks
  | { type: 'bullets'; items: string[] }
  | { type: 'image'; url: string; alt?: string; fit?: 'contain' | 'cover' }
  | { type: 'video'; url: string; provider: 'youtube' | 'vimeo' | 'loom' | 'mp4'; autoplay?: boolean }
  | { type: 'quote'; text: string; attribution?: string }
  | { type: 'bigStat'; value: string; label?: string };

export interface SlideBody {
  blocks?: ContentBlock[]; // content slides
  options?: string[]; // poll / quiz / ranking choices
  /** Optional per-option images (parallel to `options`) for picture polls/quizzes. */
  optionImages?: string[];
  correct?: number[]; // quiz: indexes of correct options
  prompt?: string; // question/prompt text for interactive slides
  min?: number; // scale
  max?: number; // scale
  minLabel?: string;
  maxLabel?: string;
  backgroundImage?: string; // full-bleed background (PDF import pages land here)
  /**
   * Authoring hint only: a short search phrase the AI can emit so the server can
   * resolve a stock photo and promote it to `backgroundImage`. Stripped after
   * resolution — never rendered directly.
   */
  imageQuery?: string;
}

export interface SlideSettings {
  // Layout templates. The first five are single-block/simple arrangements; the
  // last three ('cards' | 'stats' | 'columns') are composed "designed" layouts
  // that arrange the slide's existing blocks into a grid / stat row / two-column
  // treatment for a richer, deck-tool look. Renderer falls back to 'full' for
  // any value it doesn't special-case, so this list is safe to extend.
  layout?:
    | 'title'
    | 'split'
    | 'full'
    | 'media'
    | 'statement'
    | 'cards'
    | 'stats'
    | 'columns';
  // timer slides
  durationSec?: number; // countdown length (default 300)
  timerLabel?: string; // e.g. "Break — back in"
  // breathing slides
  rounds?: number; // breath cycles (default 5)
  inhaleSec?: number; // default 4
  holdSec?: number; // default 4
  exhaleSec?: number; // default 6
  multiSelect?: boolean; // poll: allow multiple choices
  maxWords?: number; // wordcloud: entries per participant (default 3)
  timeLimitSec?: number; // quiz timer (default 30)
  points?: number; // quiz base points (default 1000)
  showResultsLive?: boolean; // reveal results while voting (polls: default true)
  animation?: 'fade' | 'slide' | 'zoom' | 'none';
  /**
   * Element-level build animation: staggered entrance for bullets / cards / stats
   * as the slide appears. Independent of the whole-slide `animation` variant.
   * Off by default; always disabled under prefers-reduced-motion.
   */
  buildAnimation?: boolean;
  accent?: string; // per-slide accent color override
  notes?: string; // presenter-only speaker notes (shown on the phone remote)
}

export interface Slide {
  id: string;
  kind: SlideKind;
  title: string;
  body: SlideBody;
  settings: SlideSettings;
  position: number;
}

/**
 * Theme pack ids — coordinated palette + gradient surface applied per deck.
 * Mirrors the packs defined in globals.css and the THEMES list in
 * theme-switcher.tsx. 'ice' is the default (no data-theme attribute).
 */
export type ThemePack =
  | 'ice'
  | 'sky'
  | 'teal'
  | 'sunrise'
  | 'navy'
  | 'aurora'
  | 'sand'
  | 'pop';

/**
 * Image-style preset — shapes the generation prompt so a deck's AI/stock imagery
 * reads as one coherent visual language (Gamma-style). 'auto' lets the engine's
 * default cinematic-editorial look through. Consumed server-side in imagegen.
 */
export type ImageStyle =
  | 'auto'
  | 'photographic'
  | 'editorial'
  | 'render3d'
  | 'illustration'
  | 'vector'
  | 'watercolor'
  | 'mono';

/**
 * Image provider id — selects which engine resolves hero imagery. Free engines
 * (pollinations, cloudflare) work with no key; the rest activate only when their
 * API key env var is set (Pro-gated in the UI). 'auto' = best available.
 * Mirrors the registry in src/lib/server/imagegen.ts.
 */
export type ImageProvider =
  | 'auto'
  | 'pollinations'
  | 'cloudflare'
  | 'fal'
  | 'openai'
  | 'imagen'
  | 'ideogram'
  | 'replicate'
  | 'stability'
  | 'recraft'
  | 'leonardo';

export interface DeckTheme {
  name?: string;
  accent?: string; // hex — accent override on top of the pack
  /** Coordinated theme pack for this deck (palette + gradient surface). */
  pack?: ThemePack;
  /** Per-deck image look, applied to AI/stock imagery for visual consistency. */
  imageStyle?: ImageStyle;
  /** Preferred image engine for this deck (falls back to best available). */
  imageProvider?: ImageProvider;
  /** @deprecated legacy field, never consumed — kept for back-compat. */
  background?: 'ink' | 'midnight' | 'plum' | 'forest' | 'light';
  fontScale?: number;
  /** Brand kit: logo shown on the stage corner + a Google-Fonts heading/body pair. */
  logoUrl?: string;
  /** Organization / presenter name — shown on the lobby, join screen and certificate. */
  orgName?: string;
  fontHeading?: string; // Google Font family for headings (e.g. 'Fraunces')
  fontBody?: string; // Google Font family for body text (e.g. 'Inter')
}

export interface Deck {
  id: string;
  title: string;
  theme: DeckTheme;
  slides: Slide[];
  updatedAt?: string;
}

// Frozen at go-live into sessions.deck_snapshot
export interface DeckSnapshot {
  title: string;
  theme: DeckTheme;
  slides: Slide[];
}

export interface SessionSettings {
  qaModerated?: boolean;
  qaEnabled?: boolean; // ambient Q&A available on every slide
  lockedNicknames?: boolean;
  /** Voting opens automatically when an activity slide comes up (default true; quizzes always manual). */
  autoOpenVoting?: boolean;
  /**
   * Facilitator opt-in: translate question/option text into each participant's
   * chosen language on their phone. Off by default. Participant picks the language
   * in their Display & language sheet; this switch is what activates it room-wide.
   */
  translateEnabled?: boolean;
}

export interface SessionState {
  id: string;
  status: SessionStatus;
  currentSlideIndex: number;
  phase: Phase;
  phaseOpenedAt?: string | null;
  settings: SessionSettings;
}

export interface JoinResult {
  ok: boolean;
  error?: string;
  session?: SessionState & { code: string; deck: DeckSnapshot };
  participant?: { id: string; nickname: string; score: number };
}

// ---------- Results (from get_results RPC) ----------
export interface ChoiceResults {
  kind: 'poll' | 'quiz' | 'ranking';
  total: number;
  counts: Record<string, number>; // option index (as string) -> count
}
export interface WordcloudResults {
  kind: 'wordcloud';
  total: number;
  words: Record<string, number>;
}
export interface ScaleResults {
  kind: 'scale';
  total: number;
  avg: number;
  counts: Record<string, number>;
}
export interface OpenTextResults {
  kind: 'open_text';
  total: number;
  entries: { text: string }[];
}

/**
 * Latency telemetry, attached to every results payload. `lastResponseAt` is the
 * server clock (ISO) at which the newest counted response was recorded; the stage
 * diffs it against its own skew-adjusted clock at receipt to measure the
 * respond→on-screen lapse. `lastClientTs` is the skew-adjusted client tap time
 * (epoch ms) of that response when the phone reported one, enabling an
 * end-to-end (tap→screen) figure. Both are best-effort — absent for synthetic
 * (simulated) responses.
 */
export interface ResultsMeta {
  lastResponseAt?: string;
  lastClientTs?: number;
}
export type Results = (
  | ChoiceResults
  | WordcloudResults
  | ScaleResults
  | OpenTextResults
) &
  ResultsMeta;

export interface LeaderboardEntry {
  nickname: string;
  score: number;
  streak: number;
}

export interface QaQuestion {
  id: string;
  text: string;
  author: string;
  status: 'pending' | 'visible' | 'answered' | 'archived';
  upvotes: number;
  createdAt: string;
  mine?: boolean;
  upvotedByMe?: boolean;
}

// ---------- Realtime channel contract ----------
// One channel per session: `session:{sessionId}`
// Events (broadcast):
//   'state'   -> SessionState          (presenter server route -> everyone; tiny, low-frequency)
//   'results' -> {slideId, results}    (stage aggregator -> audience, throttled >= 1500ms)
//   'qa'      -> {bump: number}        (nudge clients to refetch questions; throttled)
//   'react'   -> {emoji: string}       (audience -> stage; client-side rate limited)
export const sessionChannel = (sessionId: string) => `session:${sessionId}`;

export interface StateEvent extends SessionState {
  serverTime?: string;
}
