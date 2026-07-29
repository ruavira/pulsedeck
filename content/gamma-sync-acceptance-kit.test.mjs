import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const kit = JSON.parse(
  await readFile(new URL('./gamma-sync-acceptance-kit.json', import.meta.url), 'utf8'),
);

test('acceptance kit covers twelve unique Gamma cards and six interactions', () => {
  assert.equal(kit.cards.length, 12);
  assert.equal(new Set(kit.cards.map((card) => card.cardId)).size, 12);
  assert.deepEqual(
    kit.cards.filter((card) => card.kind !== 'content').map((card) => card.kind),
    ['poll', 'scale', 'ranking', 'wordcloud', 'open_text', 'qa'],
  );
});

test('acceptance kit uses compact, side, and hidden transitions deliberately', () => {
  const modes = kit.cards.reduce((counts, card) => {
    const mode = card.displayMode ?? 'hidden';
    counts[mode] = (counts[mode] ?? 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(modes, { hidden: 6, compact: 3, side: 3 });
});
