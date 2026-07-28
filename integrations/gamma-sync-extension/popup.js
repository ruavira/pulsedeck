import { parseGammaUrl } from './shared.mjs';

const disconnected = document.querySelector('#disconnected');
const connected = document.querySelector('#connected');
const remoteInput = document.querySelector('#remote-url');
const connectButton = document.querySelector('#connect');
const disconnectButton = document.querySelector('#disconnect');
const syncButton = document.querySelector('#sync-now');
const deckTitle = document.querySelector('#deck-title');
const mappingCount = document.querySelector('#mapping-count');
const currentCard = document.querySelector('#current-card');
const lastError = document.querySelector('#last-error');
const message = document.querySelector('#message');

let status = { connected: false };
let activeGammaUrl = null;

async function send(messageBody) {
  return await chrome.runtime.sendMessage(messageBody);
}

async function readActiveGammaUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('https://gamma.app/docs/')) return null;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_GAMMA_LOCATION' });
    return response?.gammaUrl ?? tab.url;
  } catch {
    return tab.url;
  }
}

function render() {
  disconnected.hidden = status.connected;
  connected.hidden = !status.connected;
  if (!status.connected) return;
  deckTitle.textContent = status.deckTitle ?? 'PulseDeck session';
  mappingCount.textContent = `${status.mappingCount ?? 0} Gamma cards mapped`;
  lastError.textContent = status.lastError ?? '';
  const parsed = activeGammaUrl ? parseGammaUrl(activeGammaUrl) : null;
  currentCard.textContent = parsed
    ? `Gamma card: ${parsed.cardId}`
    : 'Open one of the mapped Gamma presentations to begin.';
}

async function refresh() {
  activeGammaUrl = await readActiveGammaUrl();
  const response = await send({ type: 'GET_STATUS' });
  status = response?.status ?? { connected: false };
  render();
}

connectButton.addEventListener('click', async () => {
  message.textContent = '';
  connectButton.disabled = true;
  try {
    const response = await send({ type: 'CONFIGURE', remoteUrl: remoteInput.value.trim() });
    if (!response?.ok) throw new Error(response?.error ?? 'Could not connect.');
    remoteInput.value = '';
    status = response.status;
    activeGammaUrl = await readActiveGammaUrl();
    if (activeGammaUrl) await send({ type: 'SYNC_GAMMA_URL', gammaUrl: activeGammaUrl });
    await refresh();
    message.textContent = 'Connected. PulseDeck will now follow Gamma automatically.';
  } catch (error) {
    message.textContent = error?.message ?? 'Could not connect.';
  } finally {
    connectButton.disabled = false;
  }
});

disconnectButton.addEventListener('click', async () => {
  await send({ type: 'DISCONNECT' });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && tab.url?.startsWith('https://gamma.app/docs/')) {
    await chrome.tabs.sendMessage(tab.id, { type: 'HIDE_PULSEDECK_OVERLAY' }).catch(() => undefined);
  }
  status = { connected: false };
  message.textContent = 'Disconnected.';
  render();
});

syncButton.addEventListener('click', async () => {
  message.textContent = '';
  activeGammaUrl = await readActiveGammaUrl();
  if (!activeGammaUrl) {
    message.textContent = 'Open a mapped Gamma card first.';
    return;
  }
  const response = await send({ type: 'SYNC_GAMMA_URL', gammaUrl: activeGammaUrl });
  if (!response?.ok) {
    message.textContent = response?.error ?? 'This Gamma card is not mapped.';
  } else {
    message.textContent = `Synced to ${response.target?.title ?? 'the mapped PulseDeck slide'}.`;
  }
  await refresh();
});

void refresh();
