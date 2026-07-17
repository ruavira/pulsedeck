// PDF → deck importer (CLIENT-ONLY: renders pages with pdfjs-dist in the browser).
// Each page becomes a full-bleed content slide backed by a JPEG uploaded to
// /api/upload. pdfjs-dist is lazy-imported so it never lands in the main bundle.

import type { Slide } from '@/lib/types';
// Type-only import — erased at compile time, so pdfjs stays lazy-loaded.
import type { PDFDocumentProxy } from 'pdfjs-dist';

const MAX_PAGES = 150;
const TARGET_WIDTH = 1600; // px — crisp on a projector, small enough to upload fast
const JPEG_QUALITY = 0.85;
const UPLOAD_CONCURRENCY = 3; // pages render sequentially; uploads overlap

type PdfJs = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfJs> | null = null;

/** Lazy-load pdfjs and wire up its worker exactly once. */
function loadPdfjs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode a page image.'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

async function uploadPageImage(blob: Blob, pageNum: number): Promise<string> {
  const form = new FormData();
  form.append('file', new File([blob], `pdf-page-${pageNum}.jpg`, { type: 'image/jpeg' }));
  let res: Response;
  try {
    res = await fetch('/api/upload', { method: 'POST', body: form });
  } catch {
    throw new Error(`Upload failed on page ${pageNum} — check your connection and try again.`);
  }
  if (!res.ok) {
    throw new Error(
      res.status === 413
        ? `Page ${pageNum} rendered too large to upload. Try a smaller PDF.`
        : `Upload failed on page ${pageNum} (server responded ${res.status}).`,
    );
  }
  const data = (await res.json().catch(() => ({}))) as { url?: string };
  if (!data.url) throw new Error(`Upload failed on page ${pageNum} — no URL returned.`);
  return data.url;
}

/**
 * Render every page of a PDF to an image slide.
 * Reports progress as (pagesDone, totalPages). Throws a friendly Error on
 * unreadable files, encrypted PDFs, or decks over the 150-page cap.
 */
export async function importPdf(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<Slide[]> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('PDF import only runs in the browser.');
  }

  const pdfjs = await loadPdfjs();

  let doc: PDFDocumentProxy;
  try {
    doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    throw new Error(
      /password/i.test(msg)
        ? 'That PDF is password-protected. Remove the password and try again.'
        : "We couldn't read that PDF. Make sure it's a valid, uncorrupted file.",
    );
  }

  const total = doc.numPages;
  try {
    if (total === 0) throw new Error('That PDF has no pages.');
    if (total > MAX_PAGES) {
      throw new Error(
        `That PDF has ${total} pages — the import cap is ${MAX_PAGES}. Split it and import the part you need.`,
      );
    }

    onProgress?.(0, total);
    const slides: Slide[] = new Array<Slide>(total);

    // Pages render sequentially (bounded canvas memory) while uploads overlap
    // up to UPLOAD_CONCURRENCY deep — long PDFs import in roughly render time.
    const pending = new Set<Promise<void>>();
    let done = 0;
    let uploadError: Error | null = null;

    for (let pageNum = 1; pageNum <= total; pageNum++) {
      if (uploadError) throw uploadError;
      const page = await doc.getPage(pageNum);
      let blob: Blob;
      try {
        const base = page.getViewport({ scale: 1 });
        const scale = base.width > 0 ? TARGET_WIDTH / base.width : 1;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));

        await page.render({ canvas, viewport }).promise;
        blob = await canvasToJpeg(canvas);

        // Release canvas memory promptly (matters on phones with big PDFs).
        canvas.width = 0;
        canvas.height = 0;
      } finally {
        page.cleanup();
      }

      const task = uploadPageImage(blob, pageNum)
        .then((url) => {
          slides[pageNum - 1] = {
            id: crypto.randomUUID(),
            kind: 'content',
            title: '',
            body: { backgroundImage: url, blocks: [] },
            settings: { layout: 'full' },
            position: pageNum - 1,
          };
          done += 1;
          onProgress?.(done, total);
        })
        .catch((e) => {
          uploadError ??= e instanceof Error ? e : new Error('Upload failed.');
        });
      pending.add(task);
      void task.finally(() => pending.delete(task));
      if (pending.size >= UPLOAD_CONCURRENCY) await Promise.race(pending);
    }

    await Promise.all(pending);
    if (uploadError) throw uploadError;
    return slides;
  } finally {
    await (doc as unknown as { destroy?: () => Promise<void> }).destroy?.().catch(() => undefined);
  }
}
