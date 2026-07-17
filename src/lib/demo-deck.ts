// The canonical PulseDeck demo deck — the deck Ayodeji presents on stage.
// Pure data builder: no I/O, safe to import from server routes or client code.
// Seeded into the DB by POST /api/seed-demo (see src/app/api/seed-demo/route.ts).

import type { DeckTheme, Slide, SlideBody, SlideKind, SlideSettings } from '@/lib/types';

/** Exact title used by the seeder's idempotency guard — do not change casually. */
export const DEMO_DECK_TITLE = 'The Pulse Test — An Interactive Session';

export const DEMO_DECK_THEME: DeckTheme = {
  accent: '#2F86C9',
  background: 'ink',
};

interface SlideDraft {
  kind: SlideKind;
  title: string;
  body: SlideBody;
  settings: SlideSettings;
}

/**
 * Build a fresh copy of the demo deck. Every call generates new slide ids
 * (crypto.randomUUID) and sequential positions, so the result can be inserted
 * directly as deck rows or dropped into a DeckSnapshot without collisions.
 */
export function buildDemoDeck(): { title: string; theme: DeckTheme; slides: Slide[] } {
  const drafts: SlideDraft[] = [
    // 1 — Title
    {
      kind: 'content',
      title: 'The Pulse Test',
      body: {
        blocks: [{ type: 'text', text: 'An interactive session — phones out, please.' }],
      },
      settings: { layout: 'title', animation: 'zoom' },
    },

    // 2 — Statement
    {
      kind: 'content',
      title: 'Your audience forgets 90% of what you say. Let’s fix that.',
      body: {
        blocks: [
          {
            type: 'text',
            text: 'The fix isn’t louder slides. It’s *participation* — and it starts in about a minute.',
          },
        ],
      },
      settings: { layout: 'statement', animation: 'fade' },
    },

    // 3 — Big stat
    {
      kind: 'content',
      title: 'Attention is a countdown',
      body: {
        blocks: [
          {
            type: 'bigStat',
            value: '8 sec',
            label: 'average attention span before the first interaction',
          },
        ],
      },
      settings: { layout: 'full', animation: 'slide' },
    },

    // 4 — Poll (single choice, live results)
    {
      kind: 'poll',
      title: 'How are you feeling right now?',
      body: {
        prompt: 'How are you feeling right now?',
        options: ['Energized', 'Curious', 'Skeptical', 'Under-caffeinated'],
      },
      settings: { multiSelect: false, showResultsLive: true },
    },

    // 5 — Split layout with video
    {
      kind: 'content',
      title: 'Motion beats monologue',
      body: {
        blocks: [
          {
            type: 'video',
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            provider: 'mp4',
            autoplay: false,
          },
          { type: 'text', text: 'Swap this clip for your own in the studio.' },
        ],
      },
      settings: { layout: 'split', animation: 'fade' },
    },

    // 6 — Word cloud
    {
      kind: 'wordcloud',
      title: 'Describe a great presentation in one word',
      body: {
        prompt: 'Describe a great presentation in one word',
      },
      settings: { maxWords: 3 },
    },

    // 7 — Bullets
    {
      kind: 'content',
      title: 'What makes interaction work',
      body: {
        blocks: [
          {
            type: 'bullets',
            items: [
              'Ask early, ask often',
              'Show the room to itself',
              'Reward attention, not speed',
              'Never break the flow',
            ],
          },
        ],
      },
      settings: { layout: 'full', animation: 'fade' },
    },

    // 8 — Quiz 1
    {
      kind: 'quiz',
      title: 'Daydream check',
      body: {
        prompt: 'What share of people admit to daydreaming in presentations?',
        options: ['About a quarter', 'About half', 'Most — 9 in 10', 'Everyone, always'],
        correct: [2],
      },
      settings: { timeLimitSec: 20, points: 1000 },
    },

    // 9 — Quiz 2
    {
      kind: 'quiz',
      title: 'Sense check',
      body: {
        prompt: 'Which sense dominates how we process a slide?',
        options: ['Hearing', 'Sight', 'Touch', 'Smell'],
        correct: [1],
      },
      settings: { timeLimitSec: 25, points: 1000 },
    },

    // 10 — Quiz 3 (speed round)
    {
      kind: 'quiz',
      title: 'Speed round',
      body: {
        prompt: 'Speed round (small speed bonus ON): PulseDeck tallies your votes…',
        options: ['In the cloud, per vote', 'On this phone', 'By hand backstage', 'It guesses'],
        correct: [0],
      },
      settings: { timeLimitSec: 25, points: 1000 },
    },

    // 11 — Leaderboard beat (presenter hits reveal)
    {
      kind: 'content',
      title: 'Leaderboard time.',
      body: {
        blocks: [
          { type: 'text', text: 'Three quizzes, one podium. No pressure.' },
        ],
      },
      settings: { layout: 'statement', animation: 'zoom' },
    },

    // 12 — Scale
    {
      kind: 'scale',
      title: 'How often will you use live interaction after today?',
      body: {
        prompt: 'How often will you use live interaction after today?',
        min: 1,
        max: 10,
        minLabel: 'Never',
        maxLabel: 'Every talk',
      },
      settings: {},
    },

    // 13 — Open text
    {
      kind: 'open_text',
      title: 'One thing you’ll change about your next presentation',
      body: {
        prompt: 'One thing you’ll change about your next presentation',
      },
      settings: {},
    },

    // 14 — Q&A
    {
      kind: 'qa',
      title: 'Ask me anything',
      body: {
        prompt: 'Ask me anything — upvote the questions you want answered first.',
      },
      settings: {},
    },

    // 15 — Quote
    {
      kind: 'content',
      title: 'One more thing',
      body: {
        blocks: [
          {
            type: 'quote',
            text: 'The audience is the presentation.',
            attribution: 'Every great speaker, eventually',
          },
        ],
      },
      settings: { layout: 'statement', animation: 'fade' },
    },

    // 16 — Closing
    {
      kind: 'content',
      title: 'Thank you — take your data with you',
      body: {
        blocks: [
          { type: 'text', text: 'Results export as a spreadsheet the moment we end.' },
        ],
      },
      settings: { layout: 'title', animation: 'fade' },
    },
  ];

  const slides: Slide[] = drafts.map((draft, position) => ({
    id: crypto.randomUUID(),
    kind: draft.kind,
    title: draft.title,
    body: draft.body,
    settings: draft.settings,
    position,
  }));

  return { title: DEMO_DECK_TITLE, theme: DEMO_DECK_THEME, slides };
}
