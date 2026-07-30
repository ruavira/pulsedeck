const CONNECTION_KEY = 'pulseDeckGammaSyncConnection';
const TRUSTED_KEY = 'pulseDeckGammaSyncTrustedConnection';

const sessionArea = chrome.storage.session;
const localArea = chrome.storage.local;
const sessionGet = sessionArea.get.bind(sessionArea);
const sessionSet = sessionArea.set.bind(sessionArea);
const sessionRemove = sessionArea.remove.bind(sessionArea);

function requestsConnectionKey(keys) {
  return keys == null ||
    keys === CONNECTION_KEY ||
    (Array.isArray(keys) && keys.includes(CONNECTION_KEY)) ||
    (typeof keys === 'object' && Object.prototype.hasOwnProperty.call(keys, CONNECTION_KEY));
}

async function readTrustedConnection() {
  const stored = await localArea.get(TRUSTED_KEY);
  return stored[TRUSTED_KEY] ?? null;
}

async function persistTrustedConnection(connection) {
  if (!connection?.controllerToken || !connection?.sessionId || !connection?.origin) return;
  await localArea.set({
    [TRUSTED_KEY]: {
      ...connection,
      ownerTabId: null,
      ownerWindowId: null,
      leaseState: 'released',
      leaseExpiresAt: null,
      remoteHoldUntil: null,
      paused: false,
    },
  });
}

sessionArea.get = async function patchedGet(keys) {
  const current = await sessionGet(keys);
  if (!requestsConnectionKey(keys) || current?.[CONNECTION_KEY]) return current;
  const trusted = await readTrustedConnection();
  if (!trusted) return current;
  await sessionSet({ [CONNECTION_KEY]: trusted });
  return { ...current, [CONNECTION_KEY]: trusted };
};

sessionArea.set = async function patchedSet(items) {
  const result = await sessionSet(items);
  if (items?.[CONNECTION_KEY]) await persistTrustedConnection(items[CONNECTION_KEY]);
  return result;
};

sessionArea.remove = async function patchedRemove(keys) {
  return await sessionRemove(keys);
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'CLAIM_TRUSTED_PRESENTER') return undefined;
  void (async () => {
    const trusted = await readTrustedConnection();
    if (!trusted) return { ok: false, error: 'no_trusted_presenter' };
    const claimed = {
      ...trusted,
      ownerTabId: Number.isInteger(message.tabId) ? message.tabId : null,
      ownerWindowId: Number.isInteger(message.windowId) ? message.windowId : null,
      lastGammaUrl: message.gammaUrl ?? trusted.lastGammaUrl ?? null,
    };
    await sessionSet({ [CONNECTION_KEY]: claimed });
    return { ok: true };
  })().then(sendResponse).catch((error) => sendResponse({ ok: false, error: error?.message ?? 'claim_failed' }));
  return true;
});

await import('./background.js');
