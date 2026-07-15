// Shape of GET /api/presenter/[sessionId]/report — shared by the report page components.

import type { LeaderboardEntry, Results, SlideKind } from '@/lib/types';

export interface ReportSlide {
  id: string;
  title: string;
  kind: SlideKind;
  prompt: string;
  options?: string[];
  correct?: number[];
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  results: Results;
}

export interface ReportQuestion {
  id: string;
  text: string;
  author: string;
  status: 'pending' | 'visible' | 'answered' | 'archived';
  upvotes: number;
  createdAt: string;
}

export interface SessionReport {
  session: {
    code: string;
    title: string;
    status: string;
    startedAt: string | null;
    endedAt: string | null;
    participantCount: number;
  };
  slides: ReportSlide[];
  leaderboard: LeaderboardEntry[];
  questions: ReportQuestion[];
}

export interface QaSummary {
  themes: { theme: string; questions: string[] }[];
  summary: string;
}
