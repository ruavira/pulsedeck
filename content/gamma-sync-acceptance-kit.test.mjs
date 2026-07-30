import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const kit = JSON.parse(
  await readFile(new URL('./gamma-sync-acceptance-kit.json', import.meta.url), 'utf8'),
);
const pairingRoute = await readFile(
  new URL('../src/app/api/presenter/%5BsessionId%5D/gamma-pair/route.ts', import.meta.url),
  'utf8',
);
const remoteCard = await readFile(
  new URL('../src/components/remote/gamma-sync-card.tsx', import.meta.url),
  'utf8',
);
const extensionPopup = await readFile(
  new URL('../integrations/gamma-sync-extension/popup.html', import.meta.url),
  'utf8',
);
const manifest = JSON.parse(
  await readFile(new URL('../integrations/gamma-sync-extension/manifest.json', import.meta.url), 'utf8'),
);
const trustedBackground = await readFile(
  new URL('../integrations/gamma-sync-extension/trusted-background.js', import.meta.url),
  'utf8',
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

test('Gamma pairing codes remain one-use credentials until redeemed or superseded', () => {
  assert.match(pairingRoute, /const expiresAt = 'infinity';/);
  assert.match(pairingRoute, /code_hash: hashGammaSecret/);
  assert.match(pairingRoute, /neverExpires: true/);
  assert.match(pairingRoute, /trustedDevice: true/);
});

test('creating a code supersedes the earlier unused code for the same session', () => {
  const expireAt = pairingRoute.indexOf(".update({ expires_at: now })");
  const insertAt = pairingRoute.indexOf(".from('gamma_pairing_codes').insert");
  assert.ok(expireAt > 0 && insertAt > expireAt);
  assert.match(pairingRoute, /\.eq\('session_id', sessionId\)/);
  assert.match(pairingRoute, /\.is\('redeemed_at', null\)/);
  assert.match(pairingRoute, /\.gt\('expires_at', now\)/);
});

test('Remote and extension explain the trusted-presenter one-use behavior', () => {
  assert.match(remoteCard, /one-use pairing code that does not expire/);
  assert.match(remoteCard, /Never expires · one use only/);
  assert.match(extensionPopup, /never-expiring, one-use code/);
  assert.match(extensionPopup, /invalidates the previous unused code/);
});

test('trusted presenter state persists while tab ownership and leases reset', () => {
  assert.equal(manifest.version, '0.7.1');
  assert.equal(manifest.background.service_worker, 'trusted-background.js');
  assert.match(trustedBackground, /chrome\.storage\.local\.set/);
  assert.match(trustedBackground, /chrome\.storage\.session\.set/);
  assert.match(trustedBackground, /ownerTabId: null/);
  assert.match(trustedBackground, /leaseState: 'released'/);
  assert.match(trustedBackground, /FORGET_TRUSTED_PRESENTER/);
});
