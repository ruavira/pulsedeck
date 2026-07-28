export const TRUSTED_PULSEDECK_ORIGINS = new Set([
  'https://pulsedeck-live.netlify.app',
  'https://pulsedeck.app',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CARD_ID_RE = /^[a-z0-9_-]{6,80}$/i;

export function buildAutoEmbedUrl(origin, deckId, theme = 'teal') {
  if (!TRUSTED_PULSEDECK_ORIGINS.has(origin) || !UUID_RE.test(deckId)) {
    throw new Error('PulseDeck returned an invalid public embed target.');
  }
  const url = new URL(`/embed/deck/${deckId}/auto`, origin);
  url.searchParams.set('preset', 'gamma');
  url.searchParams.set('theme', theme);
  return url.toString();
}

export function parseRemoteUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Paste the complete PulseDeck remote URL.');
  }

  if (!TRUSTED_PULSEDECK_ORIGINS.has(url.origin)) {
    throw new Error('This is not a trusted PulseDeck deployment.');
  }
  const match = url.pathname.match(/^\/remote\/([^/]+)\/?$/i);
  const sessionId = match?.[1] ?? '';
  const presenterKey = url.searchParams.get('key')?.trim() ?? '';
  if (!UUID_RE.test(sessionId) || presenterKey.length < 16) {
    throw new Error('Use the full remote URL from PulseDeck, including its one-time key.');
  }
  return { origin: url.origin, sessionId, presenterKey };
}

export function parseGammaUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.origin !== 'https://gamma.app') return null;
  const slugMatch = url.pathname.match(/^\/docs\/([^/]+)\/?$/i);
  const cardMatch = url.hash.match(/^#card-([a-z0-9_-]+)$/i);
  if (!slugMatch || !cardMatch) return null;
  return {
    documentSlug: decodeURIComponent(slugMatch[1]),
    cardId: cardMatch[1],
  };
}

export function gammaMappingKey(documentSlug, cardId) {
  return `${documentSlug}#${cardId}`;
}

export function buildGammaMappings(deck) {
  const mappings = {};
  const slides = Array.isArray(deck?.slides) ? deck.slides : [];
  slides.forEach((slide, index) => {
    const sync = slide?.settings?.gammaSync;
    if (
      !sync ||
      typeof sync.documentSlug !== 'string' ||
      typeof sync.cardId !== 'string' ||
      !sync.documentSlug.trim() ||
      !CARD_ID_RE.test(sync.cardId)
    ) {
      return;
    }
    const key = gammaMappingKey(sync.documentSlug.trim(), sync.cardId);
    mappings[key] = {
      index,
      title: typeof slide.title === 'string' ? slide.title : `Slide ${index + 1}`,
      kind: typeof slide.kind === 'string' ? slide.kind : 'content',
    };
  });
  return mappings;
}

export function mappedSlideForUrl(mappings, gammaUrl) {
  const location = parseGammaUrl(gammaUrl);
  if (!location) return null;
  return mappings[gammaMappingKey(location.documentSlug, location.cardId)] ?? null;
}
