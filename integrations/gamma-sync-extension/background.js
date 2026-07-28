import {
  buildAutoEmbedUrl,
  buildGammaMappings,
  mappedSlideForUrl,
  parseGammaUrl,
  parseRemoteUrl,
} from './shared.mjs';

const STORAGE_KEY = 'pulseDeckGammaSyncConnection';
const SYNC_TIMEOUT_MS = 8000;

async function readConnection() {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? null;
}

async function writeConnection(connection) {
  await chrome.storage.session.set({ [STORAGE_KEY]: connection });
}

async function clearConnection() {
  await chrome.storage.session.remove(STORAGE_KEY);
  await setBadge('', '#64748b');
}

async function setBadge(text, color) {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
}

async function pulseFetch(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timeout);
  }
}

async function configure(remoteUrl) {
  const parsed = parseRemoteUrl(remoteUrl);
  const response = await pulseFetch(`${parsed.origin}/api/presenter/${parsed.sessionId}`, {
    headers: { 'x-presenter-key': parsed.presenterKey },
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('PulseDeck rejected that presenter key. Create a fresh live session and try again.');
  }
  if (!response.ok) throw new Error(`PulseDeck session could not be loaded (${response.status}).`);

  const session = await response.json();
  if (session.status === 'ended') throw new Error('That PulseDeck session has already ended.');
  const mappings = buildGammaMappings(session.deck);
  const mappingCount = Object.keys(mappings).length;
  if (mappingCount === 0) {
    throw new Error('This PulseDeck deck does not contain Gamma card mappings.');
  }

  const connection = {
    ...parsed,
    deckTitle: session.deck?.title ?? 'PulseDeck session',
    embedUrl: buildAutoEmbedUrl(parsed.origin, session.deckId, session.deck?.theme?.pack ?? 'teal'),
    mappings,
    mappingCount,
    currentIndex: session.currentSlideIndex,
    lastGammaUrl: null,
    lastSyncedAt: null,
    lastError: null,
  };
  await writeConnection(connection);
  await setBadge('ON', '#059669');
  return publicStatus(connection);
}

async function syncGammaNavigation(gammaUrl) {
  const connection = await readConnection();
  if (!connection) return { ok: false, connected: false };

  const gammaLocation = parseGammaUrl(gammaUrl);
  if (!gammaLocation) return { ok: false, connected: true, unmapped: true };
  const target = mappedSlideForUrl(connection.mappings, gammaUrl);
  if (!target) {
    connection.lastGammaUrl = gammaUrl;
    connection.lastError = 'This Gamma card is not mapped in the PulseDeck deck.';
    await writeConnection(connection);
    await setBadge('–', '#d97706');
    return { ok: false, connected: true, unmapped: true };
  }

  if (connection.lastGammaUrl === gammaUrl && connection.currentIndex === target.index) {
    return {
      ok: true,
      connected: true,
      skipped: true,
      target,
      embedUrl: connection.embedUrl,
      showEmbed: target.kind !== 'content',
    };
  }

  try {
    const response = await pulseFetch(
      `${connection.origin}/api/presenter/${connection.sessionId}/advance`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-presenter-key': connection.presenterKey,
        },
        body: JSON.stringify({ index: target.index }),
      },
    );
    if (response.status === 401 || response.status === 403) {
      await clearConnection();
      const error = new Error('Presenter access expired. Reconnect using a fresh PulseDeck remote URL.');
      error.name = 'PresenterAuthError';
      throw error;
    }
    if (!response.ok) throw new Error(`PulseDeck sync failed (${response.status}).`);

    connection.currentIndex = target.index;
    connection.lastGammaUrl = gammaUrl;
    connection.lastSyncedAt = new Date().toISOString();
    connection.lastError = null;
    await writeConnection(connection);
    await setBadge('ON', '#059669');
    return {
      ok: true,
      connected: true,
      target,
      embedUrl: connection.embedUrl,
      showEmbed: target.kind !== 'content',
    };
  } catch (error) {
    if (error?.name !== 'PresenterAuthError') {
      connection.lastError = error instanceof Error ? error.message : 'PulseDeck sync failed.';
      await writeConnection(connection);
    }
    await setBadge('!', '#dc2626');
    throw error;
  }
}

function publicStatus(connection) {
  if (!connection) return { connected: false };
  return {
    connected: true,
    deckTitle: connection.deckTitle,
    mappingCount: connection.mappingCount,
    currentIndex: connection.currentIndex,
    lastGammaUrl: connection.lastGammaUrl,
    lastSyncedAt: connection.lastSyncedAt,
    lastError: connection.lastError,
  };
}

chrome.runtime.onInstalled.addListener(() => setBadge('', '#64748b'));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case 'CONFIGURE':
        return { ok: true, status: await configure(message.remoteUrl) };
      case 'DISCONNECT':
        await clearConnection();
        return { ok: true, status: { connected: false } };
      case 'GET_STATUS':
        return { ok: true, status: publicStatus(await readConnection()) };
      case 'GAMMA_NAVIGATED':
      case 'SYNC_GAMMA_URL':
        return await syncGammaNavigation(message.gammaUrl);
      default:
        return { ok: false, error: 'unknown_message' };
    }
  })()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error?.message ?? 'Unexpected error.' }));
  return true;
});
