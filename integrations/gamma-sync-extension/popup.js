import { parseGammaUrl } from './shared.mjs';

const disconnected = document.querySelector('#disconnected');
const connected = document.querySelector('#connected');
const remoteInput = document.querySelector('#remote-url');
const pairingInput = document.querySelector('#pairing-code');
const pairingButton = document.querySelector('#connect-pairing');
const connectButton = document.querySelector('#connect');
const disconnectButton = document.querySelector('#disconnect');
const syncButton = document.querySelector('#sync-now');
const pauseButton = document.querySelector('#pause-sync');
const diagnosticsButton = document.querySelector('#copy-diagnostics');
const takeoverButton = document.querySelector('#take-control');
const baselineButton = document.querySelector('#freeze-baseline');
const readiness = document.querySelector('#readiness');
const readinessLabel = document.querySelector('#readiness-label');
const deckTitle = document.querySelector('#deck-title');
const currentCard = document.querySelector('#current-card');
const healthList = document.querySelector('#health-list');
const warningList = document.querySelector('#warning-list');
const lastError = document.querySelector('#last-error');
const message = document.querySelector('#message');
const extensionVersion = document.querySelector('#extension-version');

extensionVersion.textContent = `v${chrome.runtime.getManifest().version}`;

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
      status.paused
        ? 'Released for manual control'
        : status.controllerState === 'standby'
          ? 'Another presenter is active'
          : status.leaseState === 'active'
            ? 'Exclusive lease active'
            : status.controllerState ?? 'Unknown',
      status.paused || status.controllerState === 'standby'
        ? 'warn'
        : status.controllerState === 'error' ? 'bad' : 'good',
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
    healthItem(
      'Gamma version',
      status.baselineState === 'matched'
        ? `${status.gammaInventory?.cardCount ?? 0} cards match the frozen rehearsal`
        : status.baselineState === 'mismatch'
          ? 'Changed since the frozen rehearsal'
          : status.baselineState === 'missing'
            ? 'No rehearsal baseline yet'
            : 'Fingerprint pending',
      status.baselineState === 'matched' ? 'good' : 'warn',
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
  const isStandby = status.controllerState === 'standby';
  const state = status.paused ? 'paused' : status.ready ? 'ready' : 'warning';
  readiness.dataset.state = state;
  readinessLabel.textContent = isStandby
    ? 'Standby — another presenter is active'
    : state === 'ready'
      ? 'Ready to present'
      : state === 'paused'
        ? 'Automatic sync paused'
        : 'Check before presenting';
  deckTitle.textContent = status.deckTitle ?? 'PulseDeck session';
  const parsed = activeGammaTab?.url ? parseGammaUrl(activeGammaTab.url) : null;
  currentCard.textContent = parsed
    ? `Gamma card ${parsed.cardId} · PulseDeck ${Number.isInteger(status.currentIndex) ? status.currentIndex + 1 : '—'} · ${status.lastLatencyMs ?? '—'} ms`
    : 'Open the connected Gamma presentation to continue.';
  syncButton.disabled = !isOwner || status.paused || isStandby;
  pauseButton.disabled = !isOwner || isStandby;
  pauseButton.textContent = status.paused ? 'Resume automatic sync' : 'Pause for mobile control';
  takeoverButton.hidden = !isOwner || status.controllerState !== 'standby';
  baselineButton.hidden = !isOwner || !['missing', 'mismatch'].includes(status.baselineState);
  baselineButton.textContent = status.baselineState === 'mismatch'
    ? 'Accept and freeze this new Gamma version'
    : 'Freeze this Gamma version';
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

async function connectWith(messageBody, button) {
  message.textContent = '';
  button.disabled = true;
  try {
    activeGammaTab = await readActiveGammaTab();
    if (!activeGammaTab) throw new Error('Open the final mapped Gamma presentation first.');
    const response = await send({
      ...messageBody,
      tabId: activeGammaTab.id,
      windowId: activeGammaTab.windowId,
      gammaUrl: activeGammaTab.url,
    });
    if (!response?.ok) throw new Error(response?.error ?? 'Could not connect.');
    remoteInput.value = '';
    pairingInput.value = '';
    status = response.status;
    const synced = await send({
      type: 'SYNC_GAMMA_URL',
      gammaUrl: activeGammaTab.url,
      tabId: activeGammaTab.id,
      force: true,
    });
    if (!synced?.ok && !synced?.controllerConflict) {
      throw new Error(synced?.error ?? 'Connected, but the first card did not sync.');
    }
    await refresh();
    message.textContent = synced?.controllerConflict
      ? 'Securely paired in standby. Use Take Control when this presenter should become active.'
      : 'Secure controller paired, checked and synchronized.';
  } catch (error) {
    message.textContent = error?.message ?? 'Could not connect.';
  } finally {
    button.disabled = false;
  }
}

pairingInput.addEventListener('input', () => {
  const raw = pairingInput.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 9);
  pairingInput.value = [raw.slice(0, 3), raw.slice(3, 6), raw.slice(6, 9)].filter(Boolean).join('-');
});

pairingInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !pairingButton.disabled) pairingButton.click();
});

remoteInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !connectButton.disabled) connectButton.click();
});

pairingButton.addEventListener('click', () => {
  void connectWith(
    { type: 'CONFIGURE_PAIRING', pairingCode: pairingInput.value.trim(), origin: 'https://pulsedeck-live.netlify.app' },
    pairingButton,
  );
});

connectButton.addEventListener('click', () => {
  void connectWith({ type: 'CONFIGURE', remoteUrl: remoteInput.value.trim() }, connectButton);
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

takeoverButton.addEventListener('click', async () => {
  takeoverButton.disabled = true;
  message.textContent = '';
  try {
    activeGammaTab = await readActiveGammaTab();
    const response = await send({ type: 'TAKE_CONTROL', tabId: activeGammaTab?.id });
    if (!response?.ok) throw new Error(response?.error ?? 'Could not take control.');
    status = response.status;
    const synced = await send({
      type: 'SYNC_GAMMA_URL',
      gammaUrl: activeGammaTab.url,
      tabId: activeGammaTab.id,
      force: true,
    });
    if (!synced?.ok) throw new Error(synced?.error ?? 'Control transferred, but sync failed.');
    message.textContent = 'This Chrome now has exclusive control and is synchronized.';
  } catch (error) {
    message.textContent = error?.message ?? 'Could not take control.';
  } finally {
    takeoverButton.disabled = false;
    await refresh();
  }
});

baselineButton.addEventListener('click', async () => {
  baselineButton.disabled = true;
  message.textContent = '';
  try {
    activeGammaTab = await readActiveGammaTab();
    const response = await send({ type: 'FREEZE_GAMMA_BASELINE', tabId: activeGammaTab?.id });
    if (!response?.ok) throw new Error(response?.error ?? 'Could not freeze this Gamma version.');
    status = response.status;
    message.textContent = 'Gamma version frozen. Future card or content changes will be flagged.';
  } catch (error) {
    message.textContent = error?.message ?? 'Could not freeze this Gamma version.';
  } finally {
    baselineButton.disabled = false;
    await refresh();
  }
});

void refresh();
setInterval(() => void refresh(), 1500);
