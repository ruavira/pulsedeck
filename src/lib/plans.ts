// Freemium plan definitions. Free lets a professional try the full workflow;
// Pro unlocks scale + AI + exports. Limits are enforced server-side in the
// route handlers (never trust the client).

export type Plan = 'free' | 'pro';

export interface PlanLimits {
  /** Max decks a user may own (Infinity = unlimited). */
  maxDecks: number;
  /** Max live participants per session. */
  maxParticipants: number;
  /** AI deck/quiz generation + Q&A summarization. */
  ai: boolean;
  /** Direct video/large-media upload (URL embeds are always allowed). */
  videoUpload: boolean;
  /** Spreadsheet/CSV result exports. */
  exports: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxDecks: 3,
    maxParticipants: 50,
    ai: false,
    videoUpload: false,
    exports: false,
  },
  pro: {
    maxDecks: Infinity,
    maxParticipants: 1000,
    ai: true,
    videoUpload: true,
    exports: true,
  },
};

export const PLAN_LABELS: Record<Plan, string> = { free: 'Free', pro: 'Pro' };

export function limitsFor(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}
