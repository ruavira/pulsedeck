#!/usr/bin/env node
// Repoints the existing combined deck to the protected Gamma pilot copies and
// maps all activities to their final locations in the merged Gamma document.
// Presenter credentials remain in the gitignored mode-0600 local file and are
// never printed. Existing slide IDs and activity content are preserved.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = JSON.parse(
  await readFile(new URL('../content/dfqi-gamma-sync.json', import.meta.url), 'utf8'),
);
const credentials = JSON.parse(
  await readFile(resolve('.pulsedeck-local/dfqi-gamma-sync.json'), 'utf8'),
);

const slugByCardId = new Map(
  source.sessions.flatMap((session) => session.cards.map((card) => [card.id, session.slug])),
);
assert.equal(slugByCardId.size, 155, 'Expected 155 unique Gamma card mappings');
const combinedSlug = source.combinedDeck?.slug;
const activityAliases = source.combinedDeck?.activityCardAliases ?? {};
const combinedActivityIds = new Set(Object.values(activityAliases));
assert.ok(combinedSlug, 'Missing final combined Gamma document slug');
assert.equal(Object.keys(activityAliases).length, 21, 'Expected 21 combined-deck activity aliases');

function displayModeFor(slide) {
  if (['poll', 'scale', 'ranking'].includes(slide.kind)) return 'compact';
  if (['open_text', 'wordcloud', 'qa'].includes(slide.kind)) return 'side';
  return 'hidden';
}

async function request(path, init = {}) {
  const response = await fetch(`${credentials.origin}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      'x-presenter-key': credentials.presenterKey,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  assert.ok(response.ok, `${path} failed with ${response.status}: ${body.error ?? 'unknown'}`);
  return body;
}

const deck = await request(`/api/decks/${credentials.deckId}`);
assert.equal(deck.slides.length, 155, 'Production deck slide count changed unexpectedly');

const slides = deck.slides.map((slide) => {
  const cardId = slide.settings?.gammaSync?.cardId;
  const combinedCardId = activityAliases[cardId] ?? (combinedActivityIds.has(cardId) ? cardId : null);
  const documentSlug = combinedCardId ? combinedSlug : slugByCardId.get(cardId);
  assert.ok(documentSlug, `Missing pilot slug for Gamma card ${cardId ?? '(none)'}`);
  return {
    ...slide,
    settings: {
      ...slide.settings,
      gammaSync: {
        cardId: combinedCardId ?? cardId,
        documentSlug,
        ...(combinedCardId ? { displayMode: displayModeFor(slide) } : {}),
      },
    },
  };
});

await request(`/api/decks/${credentials.deckId}`, {
  method: 'PUT',
  body: JSON.stringify({ title: deck.title, theme: deck.theme, slides }),
});

console.log(`Updated deck ${credentials.deckId}: 21 activities now target the final combined Gamma deck.`);
console.log('Existing slide IDs and activities were preserved; no presenter key was printed.');
