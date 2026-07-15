import { getSessionUser, getUserPlan } from '@/lib/auth';
import { availableProviders } from '@/lib/server/imagegen';
import { stockEnabled, stockSources } from '@/lib/server/stock';
import { giphyEnabled } from '@/lib/server/giphy';

export const runtime = 'nodejs';

// GET /api/media/providers
// Tells the studio which image engines + stock sources are actually configured on
// this deployment (so the pickers can disable/label the ones missing a key) and
// whether the signed-in user is on Pro (paid engines are Pro-gated in the UI).
// Returns booleans/ids only — never any key values.
export async function GET() {
  const user = await getSessionUser();
  const plan = user ? await getUserPlan(user.id) : 'free';
  return Response.json({
    available: availableProviders(), // image-engine ids that can generate right now
    stock: stockEnabled(),
    stockSources: stockSources(), // configured stock libraries (unsplash/pexels/pixabay)
    gif: giphyEnabled(), // animated-GIF backgrounds available
    plan,
  });
}
