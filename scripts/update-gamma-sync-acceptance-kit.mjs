#!/usr/bin/env node
// Reconciles the permanent acceptance deck to the checked-in mapping while
// preserving every PulseDeck slide ID, then creates a fresh isolated session.

import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const recordPath = '.pulsedeck-local/gamma-sync-acceptance-kit.json';
const record = JSON.parse(await readFile(recordPath, 'utf8'));
const source = JSON.parse(
  await readFile(new URL('../content/gamma-sync-acceptance-kit.json', import.meta.url), 'utf8'),
);

async function request(path, init = {}) {
  const response = await fetch(`${record.origin}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      'x-presenter-key': record.presenterKey,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  assert.ok(response.ok, `${path} failed (${response.status}): ${body.error ?? 'unknown'}`);
  return body;
}

function bodyFor(card) {
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

const deck = await request(`/api/decks/${record.deckId}`);
assert.equal(deck.slides.length, source.cards.length);
const byCardId = new Map(source.cards.map((card) => [card.cardId, card]));
const slides = deck.slides.map((slide, position) => {
  const cardId = slide.settings?.gammaSync?.cardId;
  const card = byCardId.get(cardId);
  assert.ok(card, `Unknown acceptance Gamma card ${cardId ?? '(missing)'}`);
  return {
    ...slide,
    position,
    kind: card.kind,
    title: card.title,
    body: bodyFor(card),
    settings: {
      ...slide.settings,
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
  };
});

await request(`/api/decks/${record.deckId}`, {
  method: 'PUT',
  body: JSON.stringify({ title: source.title, theme: source.theme, slides }),
});

const session = await request(`/api/decks/${record.deckId}/sessions`, {
  method: 'POST',
  body: JSON.stringify({
    settings: { qaEnabled: true, qaModerated: false, autoOpenVoting: true },
  }),
});

await writeFile(
  recordPath,
  JSON.stringify(
    {
      ...record,
      gammaUrl: source.gamma.url,
      sessionId: session.sessionId,
      joinUrl: `${record.origin}${session.joinPath}`,
      stageUrl: `${record.origin}${session.stagePath}?key=${encodeURIComponent(record.presenterKey)}`,
      remoteUrl: `${record.origin}${session.remotePath}?key=${encodeURIComponent(record.presenterKey)}`,
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  { mode: 0o600 },
);

console.log(`Updated acceptance deck ${record.deckId}: slide IDs preserved and 0.4.1 preflight aligned.`);
console.log(`Fresh session created; protected record refreshed with mode 0600.`);
