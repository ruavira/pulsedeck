import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAutoEmbedUrl,
  buildGammaMappings,
  gammaMappingKey,
  mappedSlideForUrl,
  parseGammaUrl,
  parseRemoteUrl,
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
  const parsed = parseRemoteUrl(
    'https://pulsedeck-live.netlify.app/remote/123e4567-e89b-12d3-a456-426614174000?key=1234567890abcdef1234&source=studio',
  );
  assert.deepEqual(parsed, {
    origin: 'https://pulsedeck-live.netlify.app',
    sessionId: '123e4567-e89b-12d3-a456-426614174000',
    presenterKey: '1234567890abcdef1234',
  });
});

test('rejects untrusted deployment origins', () => {
  assert.throws(
    () => parseRemoteUrl('https://example.com/remote/123e4567-e89b-12d3-a456-426614174000?key=1234567890abcdef'),
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
  });
  assert.equal(
    mappedSlideForUrl(mappings, 'https://gamma.app/docs/session-one#card-cardabc123')?.index,
    1,
  );
});
