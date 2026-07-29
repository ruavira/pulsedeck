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
