#!/usr/bin/env node
// Creates a dedicated PulseDeck deck and live session for the permanent Gamma
// Sync acceptance kit. Presenter credentials are written only to the ignored,
// mode-0600 local record and are never printed.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const source = JSON.parse(
  await readFile(new URL('../content/gamma-sync-acceptance-kit.json', import.meta.url), 'utf8'),
);
const origin = process.argv[2] ?? 'https://pulsedeck-live.netlify.app';
const output = resolve('.pulsedeck-local/gamma-sync-acceptance-kit.json');

assert.equal(source.cards.length, 12, 'Acceptance kit must contain exactly 12 cards.');
assert.equal(new Set(source.cards.map((card) => card.cardId)).size, 12, 'Gamma card IDs must be unique.');

function slideBody(card) {
  if (card.kind === 'content') {
    return {
      blocks: [
        { type: 'heading', text: card.title },
        { type: 'text', text: card.text },
      ],
    };
  }
  return {
    prompt: card.prompt,
    ...(card.options ? { options: card.options } : {}),
    ...(Number.isInteger(card.min) ? { min: card.min } : {}),
    ...(Number.isInteger(card.max) ? { max: card.max } : {}),
    ...(card.minLabel ? { minLabel: card.minLabel } : {}),
    ...(card.maxLabel ? { maxLabel: card.maxLabel } : {}),
  };
}

const slides = source.cards.map((card, position) => ({
  id: randomUUID(),
  position,
  kind: card.kind,
  title: card.title,
  body: slideBody(card),
  settings: {
    animation: 'none',
    showResultsLive: true,
    ...(card.kind === 'wordcloud' ? { maxWords: 1 } : {}),
    gammaSync: {
      documentSlug: source.gamma.documentSlug,
      cardId: card.cardId,
      displayMode: card.displayMode ?? 'hidden',
    },
    notes: `Acceptance card ${position + 1} of ${source.cards.length} · ${card.title}`,
  },
}));

async function request(path, init = {}) {
  const response = await fetch(`${origin}${path}`, init);
  const body = await response.json().catch(() => ({}));
  assert.ok(response.ok, `${path} failed (${response.status}): ${body.error ?? 'unknown'}`);
  return body;
}

const created = await request('/api/decks', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ title: source.title, theme: source.theme, slides }),
});
assert.ok(created.id && created.presenterKey, 'PulseDeck did not return deck credentials.');

const session = await request(`/api/decks/${created.id}/sessions`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-presenter-key': created.presenterKey,
  },
  body: JSON.stringify({
    settings: { qaEnabled: true, qaModerated: false, autoOpenVoting: true },
  }),
});

await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  JSON.stringify(
    {
      origin,
      gammaUrl: source.gamma.url,
      deckId: created.id,
      presenterKey: created.presenterKey,
      sessionId: session.sessionId,
      joinUrl: `${origin}${session.joinPath}`,
      stageUrl: `${origin}${session.stagePath}?key=${encodeURIComponent(created.presenterKey)}`,
      remoteUrl: `${origin}${session.remotePath}?key=${encodeURIComponent(created.presenterKey)}`,
      editorUrl: `${origin}/studio/${created.id}?key=${encodeURIComponent(created.presenterKey)}`,
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  { mode: 0o600 },
);

console.log(`Created acceptance deck ${created.id}: 12 mapped cards and 6 interactions.`);
console.log(`Fresh live session created; protected details saved to ${output} with mode 0600.`);
