// Client-side image pipeline: auto-compression + upload.
// Big source images (phone photos, Gamma exports, 4K screenshots) are downscaled
// and re-encoded in the browser before upload, so users can hand us up to 80MB
// and we still ship a compact web-ready asset to storage. SVG (vector) and GIF
// (animation) pass through untouched.

const SOURCE_CAP = 80 * 1024 * 1024; // what we accept from the user
const UPLOAD_CAP = 8 * 1024 * 1024; // /api/upload's server-side cap (post-compression)
const MAX_DIM = 2560; // long-edge px — crisp on a 4K projector
const SKIP_BELOW = 1 * 1024 * 1024; // already small AND within MAX_DIM -> pass through

const PASS_THROUGH = ['image/svg+xml', 'image/gif'];

function friendlyCapMessage(kind: 'source' | 'upload'): string {
  return kind === 'source'
    ? 'That image is larger than 80MB — export a smaller version and try again.'
    : 'That image could not be compressed under the 8MB upload limit. Try a smaller version.';
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file);
  } catch {
    // Fallback for formats createImageBitmap rejects in some browsers.
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read that image file.'));
      };
      img.src = url;
    });
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Downscale + re-encode an image for the web. Returns the original file when
 * compression wouldn't help (small file, vector, animation, or encoder loss).
 */
export async function compressImage(file: File): Promise<File> {
  if (file.size > SOURCE_CAP) throw new Error(friendlyCapMessage('source'));
  if (PASS_THROUGH.includes(file.type)) {
    if (file.size > UPLOAD_CAP) {
      throw new Error(
        file.type === 'image/gif'
          ? 'GIFs are uploaded as-is (to keep the animation) and this one is over 8MB. Try a shorter or smaller GIF.'
          : 'That SVG is over 8MB — simplify it and try again.',
      );
    }
    return file;
  }

  const img = await decode(file);
  const w = 'width' in img ? img.width : 0;
  const h = 'height' in img ? img.height : 0;
  if (!w || !h) throw new Error('Could not read that image file.');

  const scale = Math.min(1, MAX_DIM / Math.max(w, h));
  if (scale === 1 && file.size <= SKIP_BELOW) return file; // already web-sized

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if ('close' in img) img.close();

  // Prefer WebP (smaller, keeps alpha); fall back to JPEG where unsupported.
  let blob = await toBlob(canvas, 'image/webp', 0.82);
  let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob(canvas, 'image/jpeg', 0.85);
    ext = 'jpg';
  }
  canvas.width = 0;
  canvas.height = 0;

  // Keep whichever is smaller — recompressing an optimized file can inflate it.
  if (!blob || (blob.size >= file.size && file.size <= UPLOAD_CAP)) return file;
  if (blob.size > UPLOAD_CAP) throw new Error(friendlyCapMessage('upload'));

  const base = file.name.replace(/\.[a-z0-9]+$/i, '') || 'image';
  return new File([blob], `${base}.${ext}`, { type: blob.type });
}

/**
 * Compress (when useful) then upload an image via POST /api/upload.
 * Resolves with the public URL; rejects with a message safe to show in the UI.
 */
export async function uploadImage(file: File): Promise<string> {
  const prepared = await compressImage(file);
  const fd = new FormData();
  fd.append('file', prepared);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    const reason =
      data.error === 'too_large'
        ? friendlyCapMessage('upload')
        : data.error === 'bad_type'
          ? 'Only PNG, JPEG, WebP, GIF or SVG images can be uploaded.'
          : (data.error ?? 'Upload failed — try again.');
    throw new Error(reason);
  }
  return data.url;
}
