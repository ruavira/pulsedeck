import 'server-only';

// Animated GIF search via the Giphy API (free key). Env-gated on GIPHY_API_KEY —
// inert with no key, exactly like the other media integrations. Returns a single
// GIF URL usable directly as a slide backgroundImage (CSS background-image
// animates GIFs, so no renderer changes are needed).

const ENDPOINT = 'https://api.giphy.com/v1/gifs/search';

export function giphyEnabled(): boolean {
  return !!process.env.GIPHY_API_KEY;
}

interface GiphyGif {
  title?: string;
  images?: {
    original?: { url?: string };
    downsized_large?: { url?: string };
    fixed_height?: { url?: string };
  };
}

/** Resolve a phrase to one GIF (url + alt), or null. `variant` varies the pick. */
export async function searchGif(
  query: string,
  variant = 0,
): Promise<{ url: string; alt: string } | null> {
  const key = process.env.GIPHY_API_KEY;
  if (!key) return null;
  const q = query.trim().slice(0, 80);
  if (!q) return null;
  const url =
    `${ENDPOINT}?api_key=${key}&q=${encodeURIComponent(q)}` +
    `&limit=12&rating=pg-13&bundle=messaging_non_clips`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: GiphyGif[] };
    const gifs = (data.data ?? []).filter(
      (g) => g.images?.downsized_large?.url || g.images?.original?.url,
    );
    if (gifs.length === 0) return null;
    const pick = gifs[variant % gifs.length];
    const src =
      pick.images?.downsized_large?.url ||
      pick.images?.original?.url ||
      pick.images?.fixed_height?.url;
    if (!src) return null;
    return { url: src, alt: pick.title?.trim() || q };
  } catch {
    return null;
  }
}
