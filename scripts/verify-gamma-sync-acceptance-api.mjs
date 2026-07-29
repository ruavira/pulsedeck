#!/usr/bin/env node
// Runs the deployed controller/rehearsal acceptance flow against the dedicated
// kit. Reads the ignored mode-0600 record and never prints codes or credentials.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const record = JSON.parse(
  await readFile('.pulsedeck-local/gamma-sync-acceptance-kit.json', 'utf8'),
);
const { origin, sessionId, presenterKey } = record;

async function request(path, init = {}, expected = 200) {
  const response = await fetch(`${origin}${path}`, init);
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, expected, `${path} returned ${response.status}: ${body.error ?? 'unknown'}`);
  return body;
}

async function presenter(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-presenter-key': presenterKey },
    body: JSON.stringify(body),
  });
}

async function pair(label) {
  const created = await presenter(`/api/presenter/${sessionId}/gamma-pair`, { label });
  const paired = await request('/api/gamma-sync/pair/redeem', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: created.code, label }),
  });
  await request('/api/gamma-sync/pair/redeem', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: created.code, label }),
  }, 410);
  return paired;
}

async function lease(controller, action, expected = 200) {
  return request('/api/gamma-sync/controllers/lease', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-gamma-controller-token': controller.controllerToken,
    },
    body: JSON.stringify({ sessionId, action }),
  }, expected);
}

const session = await request(`/api/presenter/${sessionId}`, {
  headers: { 'x-presenter-key': presenterKey },
});
assert.equal(session.deck.slides.length, 12);
assert.equal(session.deck.slides.filter((slide) => slide.kind !== 'content').length, 6);

await presenter(`/api/presenter/${sessionId}/simulate`, { participants: 6 });
const reset = await presenter(`/api/presenter/${sessionId}/rehearsal/reset`, {});
assert.ok(reset.removedParticipants >= 6);
assert.equal(reset.state.currentSlideIndex, 0);
assert.equal(reset.state.phase, 'show');

const primary = await pair('Acceptance primary');
assert.equal(primary.lease.granted, true);
const backup = await pair('Acceptance backup');
assert.equal(backup.lease.granted, false);
assert.equal((await lease(backup, 'takeover')).lease.granted, true);
await lease(primary, 'renew', 409);

await presenter(`/api/presenter/${sessionId}/advance`, { index: 0, phase: 'show' });
const held = await lease(backup, 'renew', 409);
assert.ok(Date.parse(held.lease.remoteHoldUntil) > Date.now());
await new Promise((resolve) => setTimeout(resolve, 31_000));
assert.equal((await lease(backup, 'renew')).lease.granted, true);
await lease(backup, 'release');

console.log('Production API acceptance passed: mapping, rehearsal reset, pairing, standby, takeover, mobile priority, recovery and release.');
