#!/usr/bin/env node
// Creates the combined DFQI Gamma-synced PulseDeck without printing its
// presenter key. The response is written to a mode-0600 local credentials file.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const source = JSON.parse(
  await readFile(new URL('../content/dfqi-gamma-sync.json', import.meta.url), 'utf8'),
);

function makeSlide(card, session, sessionIndex, cardIndex) {
  const gammaSync = { documentSlug: session.slug, cardId: card.id };
  const notes = `${session.label} · Gamma card ${card.n}: ${card.heading}`;

  if (sessionIndex === 0 && cardIndex === 0) {
    return {
      id: randomUUID(),
      kind: 'join',
      title: 'Join the DFQI interactive session',
      body: {},
      settings: { animation: 'none', gammaSync, notes },
    };
  }

  const activity = source.activities[card.id];
  if (activity) {
    return {
      id: randomUUID(),
      kind: activity.kind,
      title: activity.title,
      body: activity.body,
      settings: {
        animation: 'none',
        showResultsLive: true,
        ...(activity.settings ?? {}),
        gammaSync,
        notes,
      },
    };
  }

  return {
    id: randomUUID(),
    kind: 'content',
    title: card.heading,
    body: {
      blocks: [
        { type: 'heading', text: card.heading },
        { type: 'text', text: 'Follow the Gamma presentation on the main screen.' },
      ],
    },
    settings: { layout: 'statement', animation: 'none', gammaSync, notes },
  };
}

const slides = source.sessions
  .flatMap((session, sessionIndex) =>
    session.cards.map((card, cardIndex) => makeSlide(card, session, sessionIndex, cardIndex)),
  )
  .map((slide, position) => ({ ...slide, position }));

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const origin = args.get('--origin') ?? 'https://pulsedeck-live.netlify.app';
const output = resolve(args.get('--out') ?? '.pulsedeck-local/dfqi-gamma-sync.json');

const response = await fetch(`${origin}/api/decks`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ title: source.title, theme: source.theme, slides }),
});
const created = await response.json().catch(() => ({}));
if (!response.ok || !created.id || !created.presenterKey) {
  throw new Error(`PulseDeck create failed (${response.status}): ${created.error ?? 'unknown error'}`);
}

await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  JSON.stringify(
    {
      origin,
      deckId: created.id,
      presenterKey: created.presenterKey,
      editorUrl: `${origin}/studio/${created.id}?key=${encodeURIComponent(created.presenterKey)}`,
      createdAt: new Date().toISOString(),
      slideCount: slides.length,
      activityCount: slides.filter((slide) => slide.kind !== 'content' && slide.kind !== 'join').length,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  `Created deck ${created.id}: ${slides.length} mapped cards, ${slides.filter((slide) => slide.kind !== 'content' && slide.kind !== 'join').length} activities.`,
);
console.log(`Credentials saved to ${output} with mode 0600; no presenter key was printed.`);
