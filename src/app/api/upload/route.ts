import { getAdmin } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024; // 8MB per asset
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

// POST /api/upload (multipart: file) -> { url }
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'file required' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return Response.json({ error: 'too_large' }, { status: 413 });
  if (!ALLOWED.includes(file.type)) return Response.json({ error: 'bad_type' }, { status: 415 });

  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `u/${crypto.randomUUID()}.${ext}`;
  const admin = getAdmin();
  const { error } = await admin.storage
    .from('media')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data } = admin.storage.from('media').getPublicUrl(path);
  return Response.json({ url: data.publicUrl });
}
