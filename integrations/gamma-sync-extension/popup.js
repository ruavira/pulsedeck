import { parseGammaUrl } from './shared.mjs';

const disconnected = document.querySelector('#disconnected');
const connected = document.querySelector('#connected');
const remoteInput = document.querySelector('#remote-url');
const connectButton = document.querySelector('#connect');
const disconnectButton = document.querySelector('#disconnect');
const syncButton = document.querySelector('#sync-now');
const pauseButton = document.querySelector('#pause-sync');
const diagnosticsButton = document.querySelector('#copy-diagnostics');
const readiness = document.querySelector('#readiness');
const readinessLabel = document.querySelector('#readiness-label');
const deckTitle = document.querySelector('#deck-title');
const currentCard = document.querySelector('#current-card');
const healthList = document.querySelector('#health-list');
const warningList = document.querySelector('#warning-list');
const lastError = document.querySelector('#last-error');
const message = document.querySelector('#message');

let status = { connected: false };
let activeGammaTab = null;

async function send(messageBody) {
  return await chrome.runtime.sendMessage(messageBody);
}

async function readActiveGammaTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('https://gamma.app/docs/')) return null;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_GAMMA_LOCATION' });
    return {
      id: tab.id,
      windowId: tab.windowId,
      url: response?.gammaUrl ?? tab.url,
      inventory: response?.inventory ?? null,
    };
  } catch {
    return { id: tab.id, windowId: tab.windowId, url: tab.url };
  }
}

function healthItem(label, detail, tone) {
  const item = document.createElement('li');
  item.className = tone;
  const indicator = document.createElement('span');
  indicator.className = 'health-dot';
  indicator.setAttribute('aria-hidden', 'true');
  const copy = document.createElement('span');
  const strong = document.createElement('strong');
  strong.textContent = label;
  copy.append(strong, document.createTextNode(` · ${detail}`));
  item.append(indicator, copy);
  return item;
}

function renderHealth() {
  healthList.replaceChildren();
  const mappingsComplete =
    status.slideCount > 0 && status.mappingCount === status.slideCount;
  const gammaInventory = status.gammaInventory;
  const activitiesReady =
    gammaInventory && gammaInventory.mappedActivityCount === status.activityCount;
  healthList.append(
    healthItem(
      'PulseDeck snapshot',
      `${status.mappingCount ?? 0}/${status.slideCount ?? 0} mapped slides`,
      mappingsComplete ? 'good' : 'warn',
    ),
    healthItem(
      'Gamma activities',
      gammaInventory
        ? `${gammaInventory.mappedActivityCount}/${status.activityCount ?? 0} ready across ${gammaInventory.cardCount} cards`
        : 'Inventory pending',
      activitiesReady ? 'good' : 'warn',
    ),
    healthItem(
      'Added content safety',
      gammaInventory
        ? `${gammaInventory.safeNeutralCount} cards close interactions automatically`
        : 'Inventory pending',
      gammaInventory ? 'good' : 'warn',
    ),
    healthItem(
      'PulseDeck session',
      status.sessionStatus === 'live' ? 'Live' : status.sessionStatus ?? 'Unknown',
      status.sessionStatus === 'live' ? 'good' : 'warn',
    ),
    healthItem(
      'Sync controller',
      status.paused ? 'Paused for manual control' : status.controllerState ?? 'Unknown',
      status.paused ? 'warn' : status.controllerState === 'error' ? 'bad' : 'good',
    ),
    healthItem(
      'Live panel',
      status.embedReady
        ? status.embedConnected
          ? 'Loaded and realtime connected'
          : 'Loaded; awaiting realtime state'
        : 'Prewarming',
      status.embedReady ? (status.embedConnected ? 'good' : 'warn') : 'warn',
    ),
  );
}

function renderWarnings() {
  const warnings = [...(status.preflightWarnings ?? [])];
  if (status.lastError) warnings.push(status.lastError);
  warningList.replaceChildren();
  warningList.hidden = warnings.length === 0;
  for (const warning of warnings) {
    const item = document.createElement('li');
    item.textContent = warning;
    warningList.append(item);
  }
}

function render() {
  disconnected.hidden = status.connected;
  connected.hidden = !status.connected;
  if (!status.connected) return;

  const isOwner = activeGammaTab?.id === status.ownerTabId;
  const state = status.paused ? 'paused' : status.ready ? 'ready' : 'warning';
  readiness.dataset.state = state;
  readinessLabel.textContent =
    state === 'ready' ? 'Ready to present' : state === 'paused' ? 'Automatic sync paused' : 'Check before presenting';
  deckTitle.textContent = status.deckTitle ?? 'PulseDeck session';
  const parsed = activeGammaTab?.url ? parseGammaUrl(activeGammaTab.url) : null;
  currentCard.textContent = parsed
    ? `Gamma card ${parsed.cardId} · PulseDeck ${Number.isInteger(status.currentIndex) ? status.currentIndex + 1 : '—'} · ${status.lastLatencyMs ?? '—'} ms`
    : 'Open the connected Gamma presentation to continue.';
  syncButton.disabled = !isOwner || status.paused;
  pauseButton.disabled = !isOwner;
  pauseButton.textContent = status.paused ? 'Resume automatic sync' : 'Pause for mobile control';
  renderHealth();
  renderWarnings();
  lastError.textContent = !isOwner
    ? 'This is not the connected Gamma tab. Return to the original tab to control the session.'
    : '';
}

async function refresh() {
  activeGammaTab = await readActiveGammaTab();
  if (activeGammaTab?.inventory) {
    await send({
      type: 'UPDATE_GAMMA_INVENTORY',
      tabId: activeGammaTab.id,
      gammaUrl: activeGammaTab.url,
      inventory: activeGammaTab.inventory,
    });
  }
  const response = await send({ type: 'GET_STATUS' });
  status = response?.status ?? { connected: false };
  render();
}

connectButton.addEventListener('click', async () => {
  message.textContent = '';
  connectButton.disabled = true;
  try {
    activeGammaTab = await readActiveGammaTab();
    if (!activeGammaTab) throw new Error('Open the final mapped Gamma presentation first.');
    const response = await send({
      type: 'CONFIGURE',
      remoteUrl: remoteInput.value.trim(),
      tabId: activeGammaTab.id,
      windowId: activeGammaTab.windowId,
      gammaUrl: activeGammaTab.url,
    });
    if (!response?.ok) throw new Error(response?.error ?? 'Could not connect.');
    remoteInput.value = '';
    status = response.status;
    const synced = await send({
      type: 'SYNC_GAMMA_URL',
      gammaUrl: activeGammaTab.url,
      tabId: activeGammaTab.id,
      force: true,
    });
    if (!synced?.ok) throw new Error(synced?.error ?? 'Connected, but the first card did not sync.');
    await refresh();
    message.textContent = 'Connected, checked and synchronized.';
  } catch (error) {
    message.textContent = error?.message ?? 'Could not connect.';
  } finally {
    connectButton.disabled = false;
  }
});

disconnectButton.addEventListener('click', async () => {
  await send({ type: 'DISCONNECT' });
  status = { connected: false };
  message.textContent = 'Disconnected and live panels hidden.';
  render();
});

syncButton.addEventListener('click', async () => {
  message.textContent = '';
  activeGammaTab = await readActiveGammaTab();
  if (!activeGammaTab || activeGammaTab.id !== status.ownerTabId) {
    message.textContent = 'Return to the connected Gamma tab first.';
    return;
  }
  syncButton.disabled = true;
  try {
    const response = await send({
      type: 'SYNC_GAMMA_URL',
      gammaUrl: activeGammaTab.url,
      tabId: activeGammaTab.id,
      force: true,
    });
    if (!response?.ok) throw new Error(response?.error ?? 'This Gamma card could not be synchronized.');
    message.textContent = `Confirmed ${response.target?.title ?? 'the mapped PulseDeck slide'} in ${response.latencyMs ?? '—'} ms.`;
  } catch (error) {
    message.textContent = error?.message ?? 'Synchronization failed.';
  }
  await refresh();
});

pauseButton.addEventListener('click', async () => {
  message.textContent = '';
  if (!activeGammaTab || activeGammaTab.id !== status.ownerTabId) return;
  const shouldPause = !status.paused;
  const response = await send({
    type: 'SET_PAUSED',
    paused: shouldPause,
    tabId: activeGammaTab.id,
  });
  if (!response?.ok) {
    message.textContent = response?.error ?? 'Could not change the sync mode.';
    return;
  }
  status = response.status;
  if (!shouldPause) {
    const synced = await send({
      type: 'SYNC_GAMMA_URL',
      gammaUrl: activeGammaTab.url,
      tabId: activeGammaTab.id,
      force: true,
    });
    message.textContent = synced?.ok
      ? 'Automatic sync resumed and Gamma is authoritative again.'
      : synced?.error ?? 'Sync resumed, but reconciliation failed.';
  } else {
    message.textContent = 'Automatic sync paused. The mobile remote may now be used without competition.';
  }
  await refresh();
});

diagnosticsButton.addEventListener('click', async () => {
  const response = await send({ type: 'GET_DIAGNOSTICS' });
  const safeReport = {
    generatedAt: new Date().toISOString(),
    extensionVersion: chrome.runtime.getManifest().version,
    status: response?.status,
    events: response?.diagnostics ?? [],
  };
  try {
    await navigator.clipboard.writeText(JSON.stringify(safeReport, null, 2));
    message.textContent = 'Redacted diagnostics copied.';
  } catch {
    message.textContent = 'Chrome could not copy diagnostics.';
  }
});

void refresh();
setInterval(() => void refresh(), 1000);
