const TRUSTED_KEY = 'pulseDeckGammaSyncTrustedConnection';

async function activeGammaTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('https://gamma.app/docs/')) return null;
  return tab;
}

async function ensureGammaContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'GET_GAMMA_LOCATION' });
    return true;
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-script.js'],
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    await chrome.tabs.sendMessage(tabId, { type: 'GET_GAMMA_LOCATION' });
    return true;
  }
}

const tab = await activeGammaTab();
if (tab) {
  await ensureGammaContentScript(tab.id).catch(() => undefined);
  await chrome.runtime.sendMessage({
    type: 'CLAIM_TRUSTED_PRESENTER',
    tabId: tab.id,
    windowId: tab.windowId,
    gammaUrl: tab.url,
  }).catch(() => undefined);
}

window.addEventListener('DOMContentLoaded', () => {
  const disconnect = document.querySelector('#disconnect');
  disconnect?.addEventListener('click', async () => {
    await chrome.storage.local.remove(TRUSTED_KEY);
  }, { capture: true });
});
