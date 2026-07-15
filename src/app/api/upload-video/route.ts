import { getAdmin } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth';

export const runtime = 'nodejs';

const MAX_BYTES = 200 * 1024 * 1024; // 200MB — browser uploads direct to storage, never through Netlify
const ALLOWED = ['video/mp4', 'video/webm', 'video/quicktime'];

// POST /api/upload-video { filename, size, type } -> { path, token, publicUrl }
// Returns a signed upload URL so the browser uploads DIRECTLY to Supabase storage
// (Netlify functions cap request bodies well below video size — never proxy the bytes).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const { filename, size, type } = (body ?? {}) as {
    filename?: string;
    size?: number;
    type?: string;
  };
  if (!filename || !size || !type) {
    return Response.json({ error: 'filename, size, type required' }, { status: 400 });
  }
  if (size > MAX_BYTES) {
    return Response.json({ error: 'too_large', maxBytes: MAX_BYTES }, { status: 413 });
  }
  if (!ALLOWED.includes(type)) {
    return Response.json({ error: 'bad_type', allowed: ALLOWED }, { status: 415 });
  }

  const ext = (filename.split('.').pop() ?? 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const path = `video/${crypto.randomUUID()}.${ext}`;
  const admin = getAdmin();

  const { data, error } = await admin.storage.from('media').createSignedUploadUrl(path);
  if (error || !data) {
    return Response.json({ error: error?.message ?? 'sign_failed' }, { status: 500 });
  }

  const { data: pub } = admin.storage.from('media').getPublicUrl(path);
  return Response.json({ path: data.path, token: data.token, publicUrl: pub.publicUrl });
}
