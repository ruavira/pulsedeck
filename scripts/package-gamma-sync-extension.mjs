#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import JSZip from 'jszip';

const sourceDir = resolve('integrations/gamma-sync-extension');
const releaseDir = resolve('.release');
const manifest = JSON.parse(await readFile(resolve(sourceDir, 'manifest.json'), 'utf8'));
const files = [
  'manifest.json',
  'background.js',
  'content-script.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'shared.mjs',
  'sync-controller.mjs',
];

if (manifest.manifest_version !== 3 || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  throw new Error('Extension manifest version is invalid.');
}

const zip = new JSZip();
const reproducibleTimestamp = new Date('1980-01-01T00:00:00.000Z');
for (const name of files) {
  const bytes = await readFile(resolve(sourceDir, name));
  const text = bytes.toString('utf8');
  if (/(?:ghp_|github_pat_|sk-[A-Za-z0-9_-]{20,}|-----BEGIN .*PRIVATE KEY-----)/.test(text)) {
    throw new Error(`Credential-like content detected in ${name}.`);
  }
  zip.file(name, bytes, { date: reproducibleTimestamp, unixPermissions: 0o644 });
}

const archive = await zip.generateAsync({
  type: 'nodebuffer',
  platform: 'UNIX',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
});
const digest = createHash('sha256').update(archive).digest('hex');
const baseName = `pulsedeck-gamma-sync-v${manifest.version}`;
await mkdir(releaseDir, { recursive: true });
await writeFile(resolve(releaseDir, `${baseName}.zip`), archive, { mode: 0o600 });
await writeFile(resolve(releaseDir, `${baseName}.sha256`), `${digest}  ${baseName}.zip\n`, { mode: 0o600 });
console.log(`Packaged ${files.length} reviewed files as ${baseName}.zip`);
console.log(`SHA-256: ${digest}`);
