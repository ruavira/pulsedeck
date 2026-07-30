const CONNECTION_KEY = 'pulseDeckGammaSyncConnection';
const TRUSTED_KEY = 'pulseDeckGammaSyncTrustedConnection';

function sanitizedTrustedConnection(connection) {
  if (!connection?.controllerToken || !connection?.sessionId || !connection?.origin) return null;
  return {
    ...connection,
    ownerTabId: null,
    ownerWindowId: null,
    leaseState: 'released',
    leaseExpiresAt: null,
    remoteHoldUntil: null,
    paused: false,
  };
}

async function readTrustedConnection() {
  const stored = await chrome.storage.local.get(TRUSTED_KEY);
  return stored[TRUSTED_KEY] ?? null;
}

async function restoreTrustedConnection() {
  const current = await chrome.storage.session.get(CONNECTION_KEY);
  if (current[CONNECTION_KEY]) return;
  const trusted = await readTrustedConnection();
  if (trusted) await chrome.storage.session.set({ [CONNECTION_KEY]: trusted });
}

async function persistTrustedConnection(connection) {
  const trusted = sanitizedTrustedConnection(connection);
  if (trusted) await chrome.storage.local.set({ [TRUSTED_KEY]: trusted });
}

// Restore the trusted credential before the normal background controller starts.
// This uses supported storage APIs instead of replacing Chrome's API methods.
await restoreTrustedConnection();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'session') return;
  const connection = changes[CONNECTION_KEY]?.newValue;
  if (connection) void persistTrustedConnection(connection);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'CLAIM_TRUSTED_PRESENTER') {
    void (async () => {
      const trusted = await readTrustedConnection();
      if (!trusted) return { ok: false, error: 'no_trusted_presenter' };
      const claimed = {
        ...trusted,
        ownerTabId: Number.isInteger(message.tabId) ? message.tabId : null,
        ownerWindowId: Number.isInteger(message.windowId) ? message.windowId : null,
        lastGammaUrl: message.gammaUrl ?? trusted.lastGammaUrl ?? null,
      };
      await chrome.storage.session.set({ [CONNECTION_KEY]: claimed });
      return { ok: true };
    })().then(sendResponse).catch((error) => sendResponse({ ok: false, error: error?.message ?? 'claim_failed' }));
    return true;
  }

  if (message?.type === 'FORGET_TRUSTED_PRESENTER') {
    void chrome.storage.local.remove(TRUSTED_KEY)
      .then(() => ({ ok: true }))
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error?.message ?? 'forget_failed' }));
    return true;
  }

  return undefined;
});

await import('./background.js');
