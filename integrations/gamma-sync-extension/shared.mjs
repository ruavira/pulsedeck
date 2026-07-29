export const TRUSTED_PULSEDECK_ORIGINS = new Set([
  'https://pulsedeck-live.netlify.app',
  'https://pulsedeck.app',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CARD_ID_RE = /^[a-z0-9_-]{6,80}$/i;
const DISPLAY_MODES = new Set(['hidden', 'compact', 'side', 'focus']);
const PAIRING_CODE_RE = /^[A-Z2-9]{9}$/;

export const INTERACTIVE_KINDS = new Set([
  'poll',
  'quiz',
  'ranking',
  'wordcloud',
  'scale',
  'open_text',
  'qa',
]);

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

export function parsePairingCode(value) {
  const normalized = typeof value === 'string'
    ? value.replace(/[^a-z0-9]/gi, '').toUpperCase()
    : '';
  if (!PAIRING_CODE_RE.test(normalized)) {
    throw new Error('Enter the 9-character pairing code shown on the PulseDeck remote.');
  }
  return normalized;
}

/**
 * Stable, non-cryptographic 64-bit fingerprint of Gamma card order and content.
 * Only the fingerprint leaves Gamma; card text is never sent to PulseDeck.
 */
export function fingerprintGammaCards(entries) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const cardId = typeof entry?.cardId === 'string' ? entry.cardId : '';
    const text = typeof entry?.text === 'string'
      ? entry.text.replace(/\s+/g, ' ').trim().slice(0, 800)
      : '';
    const value = `${cardId}\u001f${text}\u001e`;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= BigInt(value.charCodeAt(i));
      hash = (hash * prime) & mask;
    }
  }
  return hash.toString(16).padStart(16, '0');
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
  return buildGammaMappingReport(deck).mappings;
}

export function buildGammaMappingReport(deck) {
  const mappings = {};
  const slides = Array.isArray(deck?.slides) ? deck.slides : [];
  const duplicates = [];
  const invalidSlides = [];
  const documents = new Set();
  let activityCount = 0;

  slides.forEach((slide, index) => {
    const sync = slide?.settings?.gammaSync;
    if (
      !sync ||
      typeof sync.documentSlug !== 'string' ||
      typeof sync.cardId !== 'string' ||
      !sync.documentSlug.trim() ||
      !CARD_ID_RE.test(sync.cardId)
    ) {
      invalidSlides.push({
        index,
        title: typeof slide?.title === 'string' ? slide.title : `Slide ${index + 1}`,
      });
      return;
    }

    const documentSlug = sync.documentSlug.trim();
    const key = gammaMappingKey(documentSlug, sync.cardId);
    if (mappings[key]) {
      duplicates.push({ key, firstIndex: mappings[key].index, duplicateIndex: index });
      return;
    }

    const kind = typeof slide.kind === 'string' ? slide.kind : 'content';
    const requestedMode = typeof sync.displayMode === 'string' ? sync.displayMode : '';
    const displayMode = DISPLAY_MODES.has(requestedMode)
      ? requestedMode
      : kind === 'content'
        ? 'hidden'
        : 'side';

    documents.add(documentSlug);
    if (INTERACTIVE_KINDS.has(kind)) activityCount += 1;
    mappings[key] = {
      index,
      title: typeof slide.title === 'string' ? slide.title : `Slide ${index + 1}`,
      kind,
      displayMode,
      documentSlug,
      cardId: sync.cardId,
    };
  });

  const mappingCount = Object.keys(mappings).length;
  return {
    mappings,
    mappingCount,
    slideCount: slides.length,
    activityCount,
    documents: [...documents].sort(),
    duplicates,
    invalidSlides,
    complete: slides.length > 0 && mappingCount === slides.length && duplicates.length === 0,
  };
}

export function mappedSlideForUrl(mappings, gammaUrl) {
  const location = parseGammaUrl(gammaUrl);
  if (!location) return null;
  const exact = mappings[gammaMappingKey(location.documentSlug, location.cardId)];
  if (exact) return exact;

  // Gamma preserves card IDs when documents are duplicated or merged. Permit a
  // slug-independent match only when that card ID is globally unambiguous in
  // the authenticated PulseDeck snapshot.
  const aliases = Object.values(mappings).filter((entry) => entry.cardId === location.cardId);
  return aliases.length === 1 ? aliases[0] : null;
}

export function summarizeGammaInventory(mappings, documentSlug, cardIds, fingerprint = null) {
  const uniqueIds = [
    ...new Set(
      (Array.isArray(cardIds) ? cardIds : []).filter(
        (cardId) => typeof cardId === 'string' && CARD_ID_RE.test(cardId),
      ),
    ),
  ];
  let mappedCount = 0;
  let mappedActivityCount = 0;
  for (const cardId of uniqueIds) {
    const target = mappedSlideForUrl(
      mappings,
      `https://gamma.app/docs/${encodeURIComponent(documentSlug)}#card-${cardId}`,
    );
    if (!target) continue;
    mappedCount += 1;
    if (INTERACTIVE_KINDS.has(target.kind)) mappedActivityCount += 1;
  }
  return {
    documentSlug,
    cardCount: uniqueIds.length,
    mappedCount,
    mappedActivityCount,
    safeNeutralCount: uniqueIds.length - mappedCount,
    fingerprint: typeof fingerprint === 'string' && /^[0-9a-f]{16}$/i.test(fingerprint)
      ? fingerprint.toLowerCase()
      : null,
  };
}
