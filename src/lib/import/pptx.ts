// PPTX → deck importer (CLIENT-ONLY: unzips + parses the file in the browser).
// The .pptx never crosses a serverless function — only extracted images are
// uploaded (auto-compressed via media-client), so the old 6MB/40MB transport
// ceilings are gone. Strategy: per-slide text (titles, bullets) becomes native
// editable slides; the first embedded image per slide is carried over.
// jszip + fast-xml-parser are lazy-imported so they never land in the main bundle.

import type { ContentBlock, Slide } from '@/lib/types';
import { uploadImage } from '@/lib/media-client';

const MAX_BYTES = 300 * 1024 * 1024; // browser-memory bound, not a transport limit

const ERR = {
  tooLarge: 'That file is over the 300MB import limit. Try compressing media inside the deck first.',
  notPptx: "That file doesn't look like a PowerPoint (.pptx) file.",
  noSlides:
    "We couldn't find any slides in that file. Older .ppt files aren't supported — re-save it as .pptx and try again.",
};

/** Collect all paragraph texts under a slide XML tree (title first, in document order). */
function collectParagraphs(doc: unknown): string[] {
  const paragraphs: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (obj['a:p']) {
      const ps = Array.isArray(obj['a:p']) ? obj['a:p'] : [obj['a:p']];
      for (const p of ps) {
        const runs: string[] = [];
        const collect = (n: unknown) => {
          if (!n || typeof n !== 'object') return;
          const o = n as Record<string, unknown>;
          if (typeof o['a:t'] === 'string' || typeof o['a:t'] === 'number') runs.push(String(o['a:t']));
          for (const v of Object.values(o)) {
            if (Array.isArray(v)) v.forEach(collect);
            else if (typeof v === 'object') collect(v);
          }
        };
        collect(p);
        const text = runs.join('').trim();
        if (text) paragraphs.push(text);
      }
    } else {
      for (const v of Object.values(obj)) {
        if (Array.isArray(v)) v.forEach(walk);
        else if (typeof v === 'object') walk(v);
      }
    }
  };
  walk(doc);
  return paragraphs;
}

const IMG_TYPE: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

/**
 * Import a .pptx file into PulseDeck slides, entirely in the browser.
 * Reports progress as (slidesDone, totalSlides). Rejects with an Error whose
 * message is safe to show directly in the UI.
 */
export async function importPptx(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<{ title: string; slides: Slide[] }> {
  if (typeof window === 'undefined') throw new Error('PPTX import only runs in the browser.');
  if (file.size > MAX_BYTES) throw new Error(ERR.tooLarge);

  const [{ default: JSZip }, { XMLParser }] = await Promise.all([
    import('jszip'),
    import('fast-xml-parser'),
  ]);

  let zip: InstanceType<typeof JSZip>;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error(ERR.notPptx);
  }

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/(\d+)/)![1]) - parseInt(b.match(/(\d+)/)![1]));

  if (slideFiles.length === 0) throw new Error(ERR.noSlides);
  onProgress?.(0, slideFiles.length);

  const slides: Slide[] = [];

  for (const [idx, name] of slideFiles.entries()) {
    const xml = await zip.file(name)!.async('string');
    const paragraphs = collectParagraphs(parser.parse(xml));

    // First embedded image via the slide's relationships file.
    const relName = name.replace('slides/', 'slides/_rels/') + '.rels';
    let imageUrl: string | undefined;
    const relFile = zip.file(relName);
    if (relFile) {
      const rels = parser.parse(await relFile.async('string'));
      const relList = rels?.Relationships?.Relationship;
      const arr = Array.isArray(relList) ? relList : relList ? [relList] : [];
      const imgRel = arr.find((r: Record<string, string>) => /image/.test(r['@_Type'] ?? '')) as
        | Record<string, string>
        | undefined;
      if (imgRel) {
        const target = imgRel['@_Target'].replace('..', 'ppt');
        const ext = target.split('.').pop()?.toLowerCase() ?? '';
        const imgFile = zip.file(target);
        if (imgFile && IMG_TYPE[ext]) {
          try {
            const buf = await imgFile.async('arraybuffer');
            const imgAsFile = new File([buf], `pptx-image.${ext}`, { type: IMG_TYPE[ext] });
            imageUrl = await uploadImage(imgAsFile); // auto-compressed
          } catch {
            // A single unreadable/oversized image shouldn't sink the whole import.
            imageUrl = undefined;
          }
        }
      }
    }

    const [title, ...rest] = paragraphs;
    const blocks: ContentBlock[] = [];
    if (rest.length === 1) blocks.push({ type: 'text', text: rest[0] });
    else if (rest.length > 1) blocks.push({ type: 'bullets', items: rest.slice(0, 8) });
    if (imageUrl) blocks.push({ type: 'image', url: imageUrl, fit: 'contain' });

    slides.push({
      id: crypto.randomUUID(),
      kind: 'content',
      title: title ?? `Slide ${idx + 1}`,
      body: { blocks },
      settings: { layout: imageUrl && blocks.length > 1 ? 'split' : 'full' },
      position: idx,
    });
    onProgress?.(idx + 1, slideFiles.length);
  }

  return {
    title: file.name.replace(/\.pptx?$/i, '') || 'Imported deck',
    slides,
  };
}
