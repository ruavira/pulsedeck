'use client';
// First-run starter content: a compact 6-slide tour that shows off every core
// feature, plus an icebreaker warm-up pack. Factories (not shared constants) —
// every call mints fresh slide ids via crypto.randomUUID().

import type { Slide } from '@/lib/types';

export function demoTourSlides(): Slide[] {
  const slides: Slide[] = [
    {
      id: crypto.randomUUID(),
      kind: 'content',
      title: 'Welcome',
      body: {
        blocks: [
          { type: 'heading', text: 'Welcome to PulseDeck' },
          { type: 'text', text: 'Slides your audience is part of — polls, word clouds, quizzes and Q&A, live on the big screen.' },
          {
            type: 'bullets',
            items: [
              'Audience joins on their phones with a QR code',
              'Results appear live as people respond',
              'Everything here is editable — make it yours',
            ],
          },
        ],
      },
      settings: { layout: 'title', animation: 'fade' },
      position: 0,
    },
    {
      id: crypto.randomUUID(),
      kind: 'poll',
      title: 'Warm-up poll',
      body: {
        prompt: 'How are you feeling right now?',
        options: ['Energized', 'Curious', 'Coffee, please', 'Ready for anything'],
      },
      settings: { showResultsLive: true, multiSelect: false },
      position: 1,
    },
    {
      id: crypto.randomUUID(),
      kind: 'wordcloud',
      title: 'Word cloud',
      body: { prompt: 'One word you associate with great presentations' },
      settings: { maxWords: 3 },
      position: 2,
    },
    {
      id: crypto.randomUUID(),
      kind: 'quiz',
      title: 'Pop quiz',
      body: {
        prompt: 'Which of these makes a live talk more memorable?',
        options: ['Reading every bullet aloud', 'Involving the audience', 'Tiny grey text', 'No eye contact'],
        correct: [1],
      },
      settings: { timeLimitSec: 20, points: 1000 },
      position: 3,
    },
    {
      id: crypto.randomUUID(),
      kind: 'scale',
      title: 'Confidence check',
      body: {
        prompt: 'How likely are you to use live polling in your next talk?',
        min: 1,
        max: 10,
        minLabel: 'Unlikely',
        maxLabel: 'Definitely',
      },
      settings: {},
      position: 4,
    },
    {
      id: crypto.randomUUID(),
      kind: 'qa',
      title: 'Audience Q&A',
      body: {},
      settings: {},
      position: 5,
    },
  ];
  return slides;
}

/**
 * ICEBREAKERS: a 7-slide warm-up pack — intro, two truths and a lie, word
 * cloud, this-or-that, knowledge scale, a guided breath and a break timer.
 * Factory (fresh ids each call) so a deck can hold multiple copies safely.
 */
export function icebreakerSlides(): Slide[] {
  const slides: Slide[] = [
    {
      id: crypto.randomUUID(),
      kind: 'content',
      title: 'Before we start…',
      body: {
        blocks: [
          { type: 'heading', text: 'Before we start…' },
          { type: 'text', text: "Let's warm the room up. Grab your phone — the next few slides are for everyone." },
        ],
      },
      settings: { layout: 'title', animation: 'fade' },
      position: 0,
    },
    {
      id: crypto.randomUUID(),
      kind: 'poll',
      title: 'Two truths and a lie',
      body: {
        prompt: 'Two truths and a lie — which is the lie?',
        // Placeholders on purpose: swap these for your own two truths and a lie.
        options: ['Truth #1 — edit me', 'Truth #2 — edit me', 'The lie — edit me'],
      },
      settings: { showResultsLive: true, multiSelect: false },
      position: 1,
    },
    {
      id: crypto.randomUUID(),
      kind: 'wordcloud',
      title: 'How did you arrive?',
      body: { prompt: 'One word for how you arrived today' },
      settings: { maxWords: 1 },
      position: 2,
    },
    {
      id: crypto.randomUUID(),
      kind: 'poll',
      title: 'This or that',
      body: {
        prompt: 'This or that: Coffee or Tea?',
        options: ['Coffee', 'Tea'],
      },
      settings: { showResultsLive: true, multiSelect: false },
      position: 3,
    },
    {
      id: crypto.randomUUID(),
      kind: 'scale',
      title: 'Where are we starting from?',
      body: {
        prompt: "How much do you already know about today's topic?",
        min: 1,
        max: 5,
        minLabel: 'New to it',
        maxLabel: 'Expert',
      },
      settings: {},
      position: 4,
    },
    {
      id: crypto.randomUUID(),
      kind: 'breathing',
      title: 'Breathe',
      body: { prompt: "Let's take a breath together." },
      settings: { rounds: 5, inhaleSec: 4, holdSec: 4, exhaleSec: 6 },
      position: 5,
    },
    {
      id: crypto.randomUUID(),
      kind: 'timer',
      title: 'Grab a coffee',
      body: {},
      settings: { durationSec: 300, timerLabel: 'Back in' },
      position: 6,
    },
  ];
  return slides;
}
