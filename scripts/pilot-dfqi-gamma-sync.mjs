#!/usr/bin/env node
// Creates an isolated live session for the combined DFQI deck and exercises the
// same mapping + presenter API path used by the browser extension. Secrets are
// read/written only in the gitignored mode-0600 local directory.

import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildGammaMappings, mappedSlideForUrl } from '../integrations/gamma-sync-extension/shared.mjs';

const credentialsPath = resolve('.pulsedeck-local/dfqi-gamma-sync.json');
const outputPath = resolve('.pulsedeck-local/dfqi-gamma-sync-session.json');
const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));

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

const created = await request(`/api/decks/${credentials.deckId}/sessions`, {
  method: 'POST',
  body: JSON.stringify({ settings: { qaEnabled: true, qaModerated: false, autoOpenVoting: true } }),
});
const first = await request(`/api/presenter/${created.sessionId}`);
assert.equal(first.currentSlideIndex, 0);
assert.equal(first.deck.slides.length, 155);
const mappings = buildGammaMappings(first.deck);
assert.equal(Object.keys(mappings).length, 155);

const checks = [
  {
    gammaUrl: 'https://gamma.app/docs/DFQI-Part-1-Session-1-Signal-or-Noise-PulseDeck-Live-Pilot-cy7x7cox38l68ru#card-idf3wydu3lx2ojq',
    expectedIndex: 1,
    expectedPhase: 'open',
  },
  {
    gammaUrl: 'https://gamma.app/docs/DFQI-Part-1-Session-1-Signal-or-Noise-PulseDeck-Live-Pilot-cy7x7cox38l68ru#card-9vjk5mcl3516gwc',
    expectedIndex: 2,
    expectedPhase: 'show',
  },
  {
    gammaUrl: 'https://gamma.app/docs/DFQI-Part-1-Session-2-From-Metric-to-Chart-PulseDeck-Live-Pilot-dc0sfypwingbucz#card-vfcr4qibumwmsvg',
    expectedIndex: 51,
    expectedPhase: 'show',
  },
  {
    gammaUrl: 'https://gamma.app/docs/DFQI-Part-1-Session-3-From-Chart-to-Boardroom-PulseDeck-Live-Pilo-f7h6h98pib25r7f#card-tvnmrzgu0hytxmm',
    expectedIndex: 124,
    expectedPhase: 'open',
  },
];

for (const check of checks) {
  const target = mappedSlideForUrl(mappings, check.gammaUrl);
  assert.equal(target?.index, check.expectedIndex);
  const advanced = await request(`/api/presenter/${created.sessionId}/advance`, {
    method: 'POST',
    body: JSON.stringify({ index: target.index }),
  });
  assert.equal(advanced.state.currentSlideIndex, check.expectedIndex);
  assert.equal(advanced.state.phase, check.expectedPhase);
}

await request(`/api/presenter/${created.sessionId}/advance`, {
  method: 'POST',
  body: JSON.stringify({ index: 0 }),
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  JSON.stringify(
    {
      sessionId: created.sessionId,
      code: created.code,
      remoteUrl: `${credentials.origin}${created.remotePath}?key=${encodeURIComponent(credentials.presenterKey)}`,
      stageUrl: `${credentials.origin}${created.stagePath}?key=${encodeURIComponent(credentials.presenterKey)}`,
      joinUrl: `${credentials.origin}${created.joinPath}`,
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  { mode: 0o600 },
);

console.log('Pilot passed: 155 mappings loaded; cross-session navigation and automatic phase changes verified.');
console.log(`Session details saved to ${outputPath} with mode 0600; no presenter key was printed.`);
