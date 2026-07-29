import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAutoEmbedUrl,
  buildGammaMappingReport,
  buildGammaMappings,
  gammaMappingKey,
  mappedSlideForUrl,
  parseGammaUrl,
  parseRemoteUrl,
  summarizeGammaInventory,
} from './shared.mjs';

test('builds a public Gamma-styled auto embed without presenter credentials', () => {
  assert.equal(
    buildAutoEmbedUrl(
      'https://pulsedeck-live.netlify.app',
      '123e4567-e89b-12d3-a456-426614174000',
    ),
    'https://pulsedeck-live.netlify.app/embed/deck/123e4567-e89b-12d3-a456-426614174000/auto?preset=gamma&theme=teal',
  );
});

test('parses a trusted PulseDeck remote URL without retaining unrelated params', () => {
  const exampleKey = 'a'.repeat(20);
  const parsed = parseRemoteUrl(
    `https://pulsedeck-live.netlify.app/remote/123e4567-e89b-12d3-a456-426614174000?key=${exampleKey}&source=studio`,
  );
  assert.deepEqual(parsed, {
    origin: 'https://pulsedeck-live.netlify.app',
    sessionId: '123e4567-e89b-12d3-a456-426614174000',
    presenterKey: exampleKey,
  });
});

test('rejects untrusted deployment origins', () => {
  const exampleKey = 'b'.repeat(20);
  assert.throws(
    () =>
      parseRemoteUrl(
        `https://example.com/remote/123e4567-e89b-12d3-a456-426614174000?key=${exampleKey}`,
      ),
    /trusted PulseDeck deployment/,
  );
});

test('parses Gamma document slug and card id', () => {
  assert.deepEqual(
    parseGammaUrl('https://gamma.app/docs/DFQI-Part-1-Session-1-xo0sc2rct0ranmy?mode=doc#card-4igd7qm6fghnfdt'),
    { documentSlug: 'DFQI-Part-1-Session-1-xo0sc2rct0ranmy', cardId: '4igd7qm6fghnfdt' },
  );
});

test('builds a sparse mapping from presenter-only slide settings', () => {
  const deck = {
    slides: [
      { title: 'Intro', kind: 'content', settings: {} },
      {
        title: 'Gut poll',
        kind: 'poll',
        settings: {
          gammaSync: { documentSlug: 'session-one', cardId: 'cardabc123' },
        },
      },
    ],
  };
  const mappings = buildGammaMappings(deck);
  assert.deepEqual(mappings[gammaMappingKey('session-one', 'cardabc123')], {
    index: 1,
    title: 'Gut poll',
    kind: 'poll',
    displayMode: 'side',
    documentSlug: 'session-one',
    cardId: 'cardabc123',
  });
  assert.equal(
    mappedSlideForUrl(mappings, 'https://gamma.app/docs/session-one#card-cardabc123')?.index,
    1,
  );
});

test('reports complete mappings, activity counts, documents, and display modes', () => {
  const report = buildGammaMappingReport({
    slides: [
      {
        title: 'Intro',
        kind: 'content',
        settings: { gammaSync: { documentSlug: 'session-one', cardId: 'intro123' } },
      },
      {
        title: 'Decision poll',
        kind: 'poll',
        settings: {
          gammaSync: {
            documentSlug: 'session-one',
            cardId: 'poll123',
            displayMode: 'focus',
          },
        },
      },
    ],
  });

  assert.equal(report.complete, true);
  assert.equal(report.mappingCount, 2);
  assert.equal(report.activityCount, 1);
  assert.deepEqual(report.documents, ['session-one']);
  assert.equal(report.mappings['session-one#intro123'].displayMode, 'hidden');
  assert.equal(report.mappings['session-one#poll123'].displayMode, 'focus');
});

test('maps a preserved card id after Gamma merges the document under a new slug', () => {
  const mappings = buildGammaMappings({
    slides: [
      {
        title: 'Merged activity',
        kind: 'poll',
        settings: { gammaSync: { documentSlug: 'old-document', cardId: 'stable123' } },
      },
    ],
  });
  assert.equal(
    mappedSlideForUrl(mappings, 'https://gamma.app/docs/new-combined-document#card-stable123')
      ?.index,
    0,
  );
});

test('reports duplicate and invalid mappings instead of silently overwriting them', () => {
  const report = buildGammaMappingReport({
    slides: [
      {
        title: 'First',
        kind: 'content',
        settings: { gammaSync: { documentSlug: 'session-one', cardId: 'samecard' } },
      },
      {
        title: 'Duplicate',
        kind: 'poll',
        settings: { gammaSync: { documentSlug: 'session-one', cardId: 'samecard' } },
      },
      { title: 'Missing', kind: 'content', settings: {} },
    ],
  });

  assert.equal(report.complete, false);
  assert.equal(report.mappingCount, 1);
  assert.equal(report.duplicates.length, 1);
  assert.equal(report.invalidSlides.length, 1);
});

test('preflights exact activities, preserved ids, and safe neutral content', () => {
  const mappings = buildGammaMappings({
    slides: [
      {
        title: 'Preserved content',
        kind: 'content',
        settings: { gammaSync: { documentSlug: 'old-document', cardId: 'content123' } },
      },
      {
        title: 'Remapped poll',
        kind: 'poll',
        settings: { gammaSync: { documentSlug: 'combined-document', cardId: 'pollcard1' } },
      },
    ],
  });
  assert.deepEqual(
    summarizeGammaInventory(mappings, 'combined-document', [
      'content123',
      'pollcard1',
      'newcard99',
      'newcard99',
    ]),
    {
      documentSlug: 'combined-document',
      cardCount: 3,
      mappedCount: 2,
      mappedActivityCount: 1,
      safeNeutralCount: 1,
    },
  );
});
