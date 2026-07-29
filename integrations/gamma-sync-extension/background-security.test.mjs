import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./background.js', import.meta.url), 'utf8');

test('stores only session-scoped controller access after pairing', () => {
  assert.match(source, /controllerToken/);
  assert.match(source, /chrome\.storage\.session/);
  assert.doesNotMatch(source, /chrome\.storage\.local/);
  assert.equal((source.match(/x-presenter-key/g) ?? []).length, 1);
});

test('supports lease coordination, takeover, and safe release', () => {
  assert.match(source, /TAKE_CONTROL/);
  assert.match(source, /action: 'release'/);
  assert.match(source, /ControllerConflictError/);
  assert.match(source, /controller-standby/);
});

test('validates the live Gamma card before consuming a one-use credential', () => {
  const validateAt = source.indexOf('validateGammaOwner(owner);', source.indexOf('async function configureFromPairingCode'));
  const redeemAt = source.indexOf('redeemPairingCode(pairingCode, origin)', source.indexOf('async function configureFromPairingCode'));
  assert.ok(validateAt > 0 && redeemAt > validateAt);
  assert.match(source, /Your pairing code was not used/);
});
