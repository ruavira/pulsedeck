import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(
  await readFile(new URL('./dfqi-gamma-sync.json', import.meta.url), 'utf8'),
);

test('maps every Gamma card exactly once across the three sessions', () => {
  assert.deepEqual(manifest.sessions.map((session) => session.cards.length), [51, 56, 48]);
  const ids = manifest.sessions.flatMap((session) => session.cards.map((card) => card.id));
  assert.equal(ids.length, 155);
  assert.equal(new Set(ids).size, 155);
});

test('paces exactly seven discussion activities per session', () => {
  const activityIds = new Set(Object.keys(manifest.activities));
  const counts = manifest.sessions.map(
    (session) => session.cards.filter((card) => activityIds.has(card.id)).length,
  );
  assert.deepEqual(counts, [7, 7, 7]);
  assert.equal(activityIds.size, 21);
});

test('all activities target a real mapped card and have a prompt', () => {
  const ids = new Set(manifest.sessions.flatMap((session) => session.cards.map((card) => card.id)));
  for (const [id, activity] of Object.entries(manifest.activities)) {
    assert.ok(ids.has(id), `unknown Gamma card ${id}`);
    assert.ok(activity.title?.trim(), `${id} has no title`);
    assert.ok(activity.body?.prompt?.trim(), `${id} has no prompt`);
  }
});
