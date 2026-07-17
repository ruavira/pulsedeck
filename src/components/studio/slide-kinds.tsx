'use client';
// Slide-kind metadata (label, description, icon) + factory for freshly added slides.

import type { SVGProps } from 'react';
import type { Slide, SlideKind } from '@/lib/types';

const base = (p: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  ...p,
});

const ContentIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 9h10M7 13h6" />
  </svg>
);
const PollIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 6h13M4 12h9M4 18h15" strokeWidth={3} />
  </svg>
);
const WordcloudIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M17.5 19a4.5 4.5 0 0 0 .42-8.98 6 6 0 0 0-11.7 1.62A4 4 0 0 0 7 19h10.5z" />
  </svg>
);
const QuizIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
  </svg>
);
const ScaleIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 12h18" />
    <circle cx="14" cy="12" r="3" />
    <path d="M3 12v-2M21 12v-2" />
  </svg>
);
const RankingIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M10 6h11M10 12h11M10 18h11M4 6h1M4 12h1M4 18h1" />
  </svg>
);
const OpenTextIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M8 9h8M8 13h5" />
  </svg>
);
const QaIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M21 11a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
    <path d="M10.5 7.5a1.8 1.8 0 1 1 2.4 1.7c-.6.2-.9.6-.9 1.1M12 13.2h.01" />
  </svg>
);
const TimerIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2.5M9 2h6" />
  </svg>
);
const BreathingIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M17.7 7.7A2.5 2.5 0 1 1 19.5 12H2" />
    <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
    <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
  </svg>
);

export interface KindMeta {
  label: string;
  description: string;
  icon: (p: SVGProps<SVGSVGElement>) => React.ReactElement;
}


function JoinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2" />
      <path d="M14 14h2.8v2.8H14zM17.7 17.7h2.8v2.8h-2.8z" strokeLinejoin="round" />
    </svg>
  );
}

export const KIND_META: Record<SlideKind, KindMeta> = {
  content: {
    label: 'Content',
    description: 'Headings, text, images, video, quotes and big stats.',
    icon: ContentIcon,
  },
  poll: {
    label: 'Poll',
    description: 'Audience votes between options, live bar chart on stage.',
    icon: PollIcon,
  },
  wordcloud: {
    label: 'Word cloud',
    description: 'Everyone submits words that grow into a live cloud.',
    icon: WordcloudIcon,
  },
  quiz: {
    label: 'Quiz',
    description: 'Timed question with points, streaks and a leaderboard.',
    icon: QuizIcon,
  },
  scale: {
    label: 'Scale',
    description: 'Rate on a numeric scale — see the live average.',
    icon: ScaleIcon,
  },
  ranking: {
    label: 'Ranking',
    description: 'Audience orders options by preference.',
    icon: RankingIcon,
  },
  open_text: {
    label: 'Open text',
    description: 'Free-form answers displayed as a wall of cards.',
    icon: OpenTextIcon,
  },
  qa: {
    label: 'Q&A',
    description: 'Collect audience questions with upvoting.',
    icon: QaIcon,
  },
  timer: {
    label: 'Timer',
    description: 'Break countdown on the big screen — starts automatically.',
    icon: TimerIcon,
  },
  breathing: {
    label: 'Breathing',
    description: 'A guided breathing moment — the whole room inhales together.',
    icon: BreathingIcon,
  },
  join: {
    label: 'Join',
    description: 'Full-screen QR + instructions — a deliberate join moment.',
    icon: JoinIcon,
  },
};

export const ALL_KINDS: SlideKind[] = [
  'content',
  'poll',
  'wordcloud',
  'quiz',
  'scale',
  'ranking',
  'open_text',
  'qa',
  'timer',
  'breathing',
  'join',
];

/** Fresh slide with sensible per-kind defaults. Position is fixed up by the caller. */
export function newSlide(kind: SlideKind): Slide {
  const id = crypto.randomUUID();
  switch (kind) {
    case 'content':
      return {
        id,
        kind,
        title: 'New slide',
        body: { blocks: [{ type: 'heading', text: 'New slide' }] },
        settings: { layout: 'title', animation: 'fade' },
        position: 0,
      };
    case 'poll':
      return {
        id,
        kind,
        title: 'Poll',
        body: { prompt: 'Which option do you prefer?', options: ['Option A', 'Option B'] },
        settings: { showResultsLive: true, multiSelect: false },
        position: 0,
      };
    case 'wordcloud':
      return {
        id,
        kind,
        title: 'Word cloud',
        body: { prompt: 'One word that describes…' },
        settings: { maxWords: 3 },
        position: 0,
      };
    case 'quiz':
      return {
        id,
        kind,
        title: 'Quiz question',
        body: {
          prompt: 'Your question here',
          options: ['Answer A', 'Answer B', 'Answer C', 'Answer D'],
          correct: [0],
        },
        settings: { timeLimitSec: 30, points: 1000 },
        position: 0,
      };
    case 'scale':
      return {
        id,
        kind,
        title: 'Scale',
        body: {
          prompt: 'How confident do you feel about this topic?',
          min: 1,
          max: 5,
          minLabel: 'Not at all',
          maxLabel: 'Very',
        },
        settings: {},
        position: 0,
      };
    case 'ranking':
      return {
        id,
        kind,
        title: 'Ranking',
        body: { prompt: 'Rank these in order', options: ['First option', 'Second option', 'Third option'] },
        settings: {},
        position: 0,
      };
    case 'open_text':
      return {
        id,
        kind,
        title: 'Open text',
        body: { prompt: "What's on your mind?" },
        settings: {},
        position: 0,
      };
    case 'qa':
      return {
        id,
        kind,
        title: 'Q&A',
        body: {},
        settings: {},
        position: 0,
      };
    case 'timer':
      return {
        id,
        kind,
        title: 'Break',
        body: {},
        settings: { durationSec: 300, timerLabel: 'Back in' },
        position: 0,
      };
    case 'breathing':
      return {
        id,
        kind,
        title: 'Breathe',
        body: { prompt: "Let's take a breath together." },
        settings: { rounds: 5, inhaleSec: 4, holdSec: 4, exhaleSec: 6 },
        position: 0,
      };
    case 'join':
      return {
        id,
        kind,
        title: 'Join in — phones out',
        body: {},
        settings: {},
        position: 0,
      };
  }
}
