import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('./content-script.js', import.meta.url),
  'utf8',
);

test('overlay host does not inline-reset properties controlled by shadow CSS', () => {
  assert.doesNotMatch(source, /host\.style\.cssText\s*=\s*['"]all\s*:/i);
  assert.match(source, /:host\s*\([^{]*\)|:host\s*\{/);
  assert.match(source, /:host\(\[data-visible="true"\]\)/);
});

test('navigation uses IntersectionObserver instead of rescanning 204 card rectangles', () => {
  assert.match(source, /new IntersectionObserver/);
  assert.doesNotMatch(source, /for \(const section of document\.querySelectorAll\('\[data-card-id\]'\)\)[\s\S]{0,500}getBoundingClientRect/);
});

test('extension reload invalidation is contained by the runtime message boundary', () => {
  assert.match(source, /function runtimeContextAvailable/);
  assert.match(source, /extension context invalidated/i);
  assert.match(source, /function sendRuntimeMessage/);
  assert.equal(source.match(/chrome\.runtime\.sendMessage/g)?.length, 1);
});

test('presenter can move, resize, and minimize the live interaction panel', () => {
  assert.match(source, /class="dock"/);
  assert.match(source, /class="size"/);
  assert.match(source, /class="minimize"/);
  assert.match(source, /pulsedeckGammaSize/);
  assert.match(source, /data-minimized/);
});

test('Gamma renders trusted ambient reactions and a persistent safe audience inbox', () => {
  assert.match(source, /PULSEDECK_AMBIENT_EVENT/);
  assert.match(source, /renderAmbientReaction/);
  assert.match(source, /renderAmbientSignal/);
  assert.match(source, /renderAmbientQuestion/);
  assert.match(source, /renderAudienceHub/);
  assert.match(source, /class="audience-hub"/);
  assert.match(source, /Review questions on the private PulseDeck Remote/);
  assert.match(source, /kind === 'hand' \? 60000 : 30000/);
  assert.doesNotMatch(source, /message\.payload\?\.text/);
});

test('overlay placement scores visible Gamma content and chooses a corner automatically', () => {
  assert.match(source, /function meaningfulContentRects/);
  assert.match(source, /function scorePlacement/);
  assert.match(source, /function placePulseDeckOverlay/);
  assert.match(source, /data-position="top-right"/);
  assert.match(source, /data-position="bottom-left"/);
});
