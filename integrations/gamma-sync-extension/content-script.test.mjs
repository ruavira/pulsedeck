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
