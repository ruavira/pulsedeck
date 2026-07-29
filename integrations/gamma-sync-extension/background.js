import {
  buildAutoEmbedUrl,
  buildGammaMappingReport,
  mappedSlideForUrl,
  parseGammaUrl,
  parsePairingCode,
  parseRemoteUrl,
  summarizeGammaInventory,
} from './shared.mjs';
import { createLatestWinsController, retryTransient } from './sync-controller.mjs';

const STORAGE_KEY = 'pulseDeckGammaSyncConnection';
const SYNC_TIMEOUT_MS = 8000;
const AUTHORITATIVE_CHECK_MS = 8000;
const DIAGNOSTIC_LIMIT = 40;
const LEASE_RENEW_AHEAD_MS = 25_000;
const DEFAULT_PULSEDECK_ORIGIN = 'https://pulsedeck-live.netlify.app';

let runtimeHealth = {
  controllerState: 'disconnected',
  embedReady: false,
  embedMatchesTarget: false,
  embedConnected: false,
  lastEmbedStateAt: null,
  gammaInventory: null,
  baselineState: 'pending',
};

class PulseDeckHttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'PulseDeckHttpError';
    this.status = status;
  }
}

class ControllerConflictError extends Error {
  constructor(message = 'Another presenter currently controls this PulseDeck session.', lease = null) {
    super(message);
    this.name = 'ControllerConflictError';
    this.status = 409;
    this.lease = lease;
  }
}

async function readConnection() {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? null;
}

async function writeConnection(connection) {
  await chrome.storage.session.set({ [STORAGE_KEY]: connection });
}

async function setBadge(text, color) {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
}

async function updateBadge(connection, state = runtimeHealth.controllerState) {
  if (!connection) return setBadge('', '#64748b');
  if (connection.paused) return setBadge('Ⅱ', '#64748b');
  if (state === 'standby') return setBadge('◇', '#d97706');
  if (state === 'error' || state === 'degraded') return setBadge('!', '#dc2626');
  if (state === 'unmapped') return setBadge('–', '#d97706');
  if (state === 'syncing' || state === 'recovering') return setBadge('↻', '#2563eb');
  return setBadge('ON', '#059669');
}

async function messageOwner(connection, message) {
  if (!connection?.ownerTabId) return;
  await chrome.tabs.sendMessage(connection.ownerTabId, message).catch(() => undefined);
}

async function clearConnection(reason = 'manual') {
  const connection = await readConnection();
  await messageOwner(connection, { type: 'HIDE_PULSEDECK_OVERLAY', reason });
  if (connection?.controllerToken) {
    await pulseFetch(
      `${connection.origin}/api/gamma-sync/controllers/lease`,
      {
        method: 'POST',
        headers: controllerHeaders(connection, true),
        body: JSON.stringify({ sessionId: connection.sessionId, action: 'release' }),
      },
    ).catch(() => undefined);
  }
  await chrome.storage.session.remove(STORAGE_KEY);
  runtimeHealth = {
    controllerState: 'disconnected',
    embedReady: false,
    embedMatchesTarget: false,
    embedConnected: false,
    lastEmbedStateAt: null,
    gammaInventory: null,
    baselineState: 'pending',
  };
  await updateBadge(null);
}

function diagnostic(connection, event, detail = {}) {
  const next = {
    at: new Date().toISOString(),
    event,
    ...detail,
  };
  connection.diagnostics = [...(connection.diagnostics ?? []), next].slice(-DIAGNOSTIC_LIMIT);
}

function gammaDetail(gammaUrl) {
  const parsed = parseGammaUrl(gammaUrl);
  return parsed ? { documentSlug: parsed.documentSlug, cardId: parsed.cardId } : {};
}

function ownerMatches(connection, tabId) {
  return Number.isInteger(tabId) && tabId === connection.ownerTabId;
}

function isTransient(error) {
  return (
    error?.name === 'TypeError' ||
    error?.name === 'TimeoutError' ||
    error?.status === 408 ||
    error?.status === 425 ||
    error?.status === 429 ||
    error?.status >= 500
  );
}

async function pulseFetch(url, options = {}, externalSignal) {
  const controller = new AbortController();
  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener('abort', abortFromExternal, { once: true });
  const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    if (externalSignal?.aborted) throw error;
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('PulseDeck did not respond within 8 seconds.');
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}

function controllerHeaders(connection, json = false) {
  return {
    ...(json ? { 'content-type': 'application/json' } : {}),
    'x-gamma-controller-token': connection.controllerToken,
  };
}

async function readPulseDeckSession(connection, signal) {
  const response = await pulseFetch(
    `${connection.origin}/api/presenter/${connection.sessionId}`,
    { headers: controllerHeaders(connection) },
    signal,
  );
  if (response.status === 401 || response.status === 403) {
    const error = new PulseDeckHttpError('Presenter access expired.', response.status);
    error.name = 'PresenterAuthError';
    throw error;
  }
  if (!response.ok) {
    throw new PulseDeckHttpError(`PulseDeck session check failed (${response.status}).`, response.status);
  }
  return await response.json();
}

async function advancePulseDeck(connection, index, signal) {
  const response = await pulseFetch(
    `${connection.origin}/api/presenter/${connection.sessionId}/advance`,
    {
      method: 'POST',
      headers: {
        ...controllerHeaders(connection, true),
      },
      body: JSON.stringify({ index }),
    },
    signal,
  );
  if (response.status === 401 || response.status === 403) {
    const error = new PulseDeckHttpError('Presenter access expired.', response.status);
    error.name = 'PresenterAuthError';
    throw error;
  }
  if (response.status === 409) {
    const body = await response.json().catch(() => ({}));
    throw new ControllerConflictError('Another presenter took control of PulseDeck.', body.lease);
  }
  if (!response.ok) {
    throw new PulseDeckHttpError(`PulseDeck sync failed (${response.status}).`, response.status);
  }
  return await response.json();
}

async function closePulseDeckInteraction(connection, signal) {
  const response = await pulseFetch(
    `${connection.origin}/api/presenter/${connection.sessionId}/advance`,
    {
      method: 'POST',
      headers: {
        ...controllerHeaders(connection, true),
      },
      body: JSON.stringify({ phase: 'show' }),
    },
    signal,
  );
  if (response.status === 401 || response.status === 403) {
    const error = new PulseDeckHttpError('Presenter access expired.', response.status);
    error.name = 'PresenterAuthError';
    throw error;
  }
  if (response.status === 409) {
    const body = await response.json().catch(() => ({}));
    throw new ControllerConflictError('Another presenter took control of PulseDeck.', body.lease);
  }
  if (!response.ok) {
    throw new PulseDeckHttpError(`PulseDeck close failed (${response.status}).`, response.status);
  }
  return await response.json();
}

async function requestControllerLease(connection, action, signal) {
  const response = await pulseFetch(
    `${connection.origin}/api/gamma-sync/controllers/lease`,
    {
      method: 'POST',
      headers: controllerHeaders(connection, true),
      body: JSON.stringify({ sessionId: connection.sessionId, action }),
    },
    signal,
  );
  const body = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) {
    const error = new PulseDeckHttpError('Gamma controller access expired.', response.status);
    error.name = 'PresenterAuthError';
    throw error;
  }
  if (response.status === 409 || !body?.lease?.granted) {
    throw new ControllerConflictError('Another presenter currently controls this session.', body?.lease);
  }
  if (!response.ok) throw new PulseDeckHttpError(`Controller lease failed (${response.status}).`, response.status);
  connection.leaseState = 'active';
  connection.leaseExpiresAt = body.lease.leaseExpiresAt;
  connection.remoteHoldUntil = body.lease.remoteHoldUntil;
  connection.lastLeaseRenewedAt = new Date().toISOString();
  return body.lease;
}

async function releaseControllerLease(connection, signal) {
  const response = await pulseFetch(
    `${connection.origin}/api/gamma-sync/controllers/lease`,
    {
      method: 'POST',
      headers: controllerHeaders(connection, true),
      body: JSON.stringify({ sessionId: connection.sessionId, action: 'release' }),
    },
    signal,
  );
  if (response.status === 401 || response.status === 403) {
    const error = new PulseDeckHttpError('Gamma controller access expired.', response.status);
    error.name = 'PresenterAuthError';
    throw error;
  }
  if (!response.ok) throw new PulseDeckHttpError(`Controller release failed (${response.status}).`, response.status);
  connection.leaseState = 'released';
  connection.leaseExpiresAt = null;
}

async function ensureControllerLease(connection, signal, force = false) {
  const expiresAt = Date.parse(connection.leaseExpiresAt ?? '') || 0;
  if (!force && connection.leaseState === 'active' && expiresAt - Date.now() > LEASE_RENEW_AHEAD_MS) {
    return true;
  }
  await requestControllerLease(connection, force ? 'takeover' : 'renew', signal);
  return true;
}

async function exchangeRemoteUrl(remoteUrl) {
  const parsed = parseRemoteUrl(remoteUrl);
  const response = await pulseFetch(`${parsed.origin}/api/presenter/${parsed.sessionId}/gamma-controller`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-presenter-key': parsed.presenterKey },
    body: JSON.stringify({ label: `Chrome ${navigator.userAgentData?.platform ?? 'presenter'}` }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('PulseDeck could not create a scoped Gamma controller.');
  return { origin: parsed.origin, sessionId: parsed.sessionId, ...body };
}

async function redeemPairingCode(pairingCode, origin = DEFAULT_PULSEDECK_ORIGIN) {
  const code = parsePairingCode(pairingCode);
  if (![DEFAULT_PULSEDECK_ORIGIN, 'https://pulsedeck.app'].includes(origin)) {
    throw new Error('This is not a trusted PulseDeck deployment.');
  }
  const response = await pulseFetch(`${origin}/api/gamma-sync/pair/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, label: `Chrome ${navigator.userAgentData?.platform ?? 'presenter'}` }),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 410) throw new Error('That pairing code expired or was already used. Create a new code.');
  if (!response.ok) throw new Error('PulseDeck could not redeem that pairing code.');
  return { origin, ...body };
}

async function configureController(controllerAuth, owner) {
  if (!Number.isInteger(owner?.tabId) || !owner?.gammaUrl) {
    throw new Error('Open the mapped Gamma presentation before connecting.');
  }
  const gammaLocation = parseGammaUrl(owner.gammaUrl);
  if (!gammaLocation) throw new Error('The active tab is not a supported Gamma presentation.');

  if (!controllerAuth?.controllerToken || !controllerAuth?.sessionId || !controllerAuth?.origin) {
    throw new Error('PulseDeck did not return a valid scoped controller.');
  }
  const provisional = {
    origin: controllerAuth.origin,
    sessionId: controllerAuth.sessionId,
    controllerId: controllerAuth.controllerId,
    controllerToken: controllerAuth.controllerToken,
    leaseState: controllerAuth.lease?.granted ? 'active' : 'standby',
    leaseExpiresAt: controllerAuth.lease?.leaseExpiresAt ?? null,
    remoteHoldUntil: controllerAuth.lease?.remoteHoldUntil ?? null,
  };
  const session = await readPulseDeckSession(provisional);
  if (session.status === 'ended') throw new Error('That PulseDeck session has already ended.');

  const report = buildGammaMappingReport(session.deck);
  if (report.mappingCount === 0) {
    throw new Error('This PulseDeck deck does not contain Gamma card mappings.');
  }
  if (report.duplicates.length > 0) {
    throw new Error('This PulseDeck deck has duplicate Gamma mappings. Correct them before presenting.');
  }
  if (!report.documents.includes(gammaLocation.documentSlug)) {
    throw new Error('This Gamma presentation is not mapped in the selected PulseDeck deck.');
  }

  const warnings = [];
  if (!report.complete) {
    warnings.push(`${report.invalidSlides.length} PulseDeck slide(s) do not have valid Gamma mappings.`);
  }
  if (session.status !== 'live') {
    warnings.push('The PulseDeck session has not been started yet.');
  }

  const connection = {
    ...provisional,
    ownerTabId: owner.tabId,
    ownerWindowId: owner.windowId ?? null,
    deckId: session.deckId,
    deckTitle: session.deck?.title ?? 'PulseDeck session',
    embedUrl: buildAutoEmbedUrl(provisional.origin, session.deckId, session.deck?.theme?.pack ?? 'teal'),
    mappings: report.mappings,
    mappingCount: report.mappingCount,
    slideCount: report.slideCount,
    activityCount: report.activityCount,
    documentSlugs: report.documents,
    preflightWarnings: warnings,
    gammaBaselines: Array.isArray(session.gammaBaselines) ? session.gammaBaselines : [],
    currentIndex: session.currentSlideIndex,
    sessionStatus: session.status,
    phase: session.phase,
    paused: false,
    pairingMode: controllerAuth.pairingMode ?? 'code',
    lastGammaUrl: null,
    lastSyncedAt: null,
    lastAuthoritativeCheckAt: new Date().toISOString(),
    lastLatencyMs: null,
    lastRetryCount: 0,
    lastLeaseRenewedAt: new Date().toISOString(),
    lastError: null,
    diagnostics: [],
  };
  diagnostic(connection, 'connected', {
    mappingCount: report.mappingCount,
    slideCount: report.slideCount,
    activityCount: report.activityCount,
    sessionStatus: session.status,
  });

  runtimeHealth = {
    controllerState: provisional.leaseState === 'active'
      ? warnings.length > 0 ? 'degraded' : 'ready'
      : 'standby',
    embedReady: false,
    embedMatchesTarget: false,
    embedConnected: false,
    lastEmbedStateAt: null,
    gammaInventory: null,
    baselineState: 'pending',
  };
  await writeConnection(connection);
  await updateBadge(connection);
  await messageOwner(connection, {
    type: 'PREPARE_PULSEDECK_OVERLAY',
    embedUrl: connection.embedUrl,
    trustedOrigin: connection.origin,
  });
  return publicStatus(connection);
}

async function configureFromRemoteUrl(remoteUrl, owner) {
  const controller = await exchangeRemoteUrl(remoteUrl);
  return await configureController({ ...controller, pairingMode: 'remote-exchange' }, owner);
}

async function configureFromPairingCode(pairingCode, origin, owner) {
  const controller = await redeemPairingCode(pairingCode, origin);
  return await configureController({ ...controller, pairingMode: 'pairing-code' }, owner);
}

async function enterStandby(connection, error) {
  connection.leaseState = 'standby';
  connection.leaseExpiresAt = error?.lease?.leaseExpiresAt ?? null;
  connection.remoteHoldUntil = error?.lease?.remoteHoldUntil ?? null;
  connection.lastError = error?.message ?? 'Another presenter currently controls PulseDeck.';
  diagnostic(connection, 'controller-standby', {
    remoteHoldUntil: connection.remoteHoldUntil,
  });
  runtimeHealth.controllerState = 'standby';
  await writeConnection(connection);
  await updateBadge(connection);
  await messageOwner(connection, { type: 'HIDE_PULSEDECK_OVERLAY', reason: 'controller-standby' });
  return {
    ok: false,
    connected: true,
    controllerConflict: true,
    showEmbed: false,
    error: connection.lastError,
  };
}

async function executeSync(payload, context) {
  const startedAt = Date.now();
  const connection = await readConnection();
  if (!connection) return { ok: false, connected: false };
  if (!ownerMatches(connection, payload.tabId)) {
    return { ok: false, connected: true, notOwner: true };
  }
  if (connection.paused && !payload.force) {
    return { ok: false, connected: true, paused: true };
  }

  try {
    await ensureControllerLease(connection, context.signal, false);
  } catch (error) {
    if (error?.name === 'ControllerConflictError') return await enterStandby(connection, error);
    throw error;
  }

  const gammaLocation = parseGammaUrl(payload.gammaUrl);
  const target = mappedSlideForUrl(connection.mappings, payload.gammaUrl);
  if (!gammaLocation) {
    connection.lastGammaUrl = payload.gammaUrl;
    connection.lastError = 'This Gamma card is not mapped in the PulseDeck deck.';
    diagnostic(connection, 'unmapped', gammaDetail(payload.gammaUrl));
    runtimeHealth.controllerState = 'unmapped';
    await writeConnection(connection);
    await updateBadge(connection);
    return { ok: false, connected: true, unmapped: true };
  }

  if (!target) {
    runtimeHealth.controllerState = 'syncing';
    await updateBadge(connection);
    try {
      let state = null;
      let retries = 0;
      if (connection.phase !== 'show') {
        const closed = await retryTransient(
          () => closePulseDeckInteraction(connection, context.signal),
          {
            signal: context.signal,
            isRetryable: isTransient,
            delays: [250, 750, 1500],
          },
        );
        retries = closed.retries;
        state = closed.value?.state ?? null;
      }
      if (!context.isLatest()) return { ok: false, superseded: true };

      connection.phase = state?.phase ?? 'show';
      connection.sessionStatus = state?.status ?? connection.sessionStatus;
      connection.lastGammaUrl = payload.gammaUrl;
      connection.lastSyncedAt = new Date().toISOString();
      connection.lastLatencyMs = Date.now() - startedAt;
      connection.lastRetryCount = retries;
      connection.lastError = null;
      diagnostic(connection, 'neutral-content', {
        ...gammaDetail(payload.gammaUrl),
        latencyMs: connection.lastLatencyMs,
        retries,
      });
      runtimeHealth.controllerState = 'ready';
      await writeConnection(connection);
      await updateBadge(connection);
      return {
        ok: true,
        connected: true,
        neutralized: true,
        unmapped: true,
        embedUrl: connection.embedUrl,
        trustedOrigin: connection.origin,
        showEmbed: false,
        latencyMs: connection.lastLatencyMs,
        retries,
      };
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      if (error?.name === 'ControllerConflictError') return await enterStandby(connection, error);
      if (error?.name === 'PresenterAuthError') {
        await clearConnection('auth-expired');
        throw new Error('Presenter access expired. Reconnect using a fresh PulseDeck remote URL.');
      }
      connection.lastError = error instanceof Error ? error.message : 'PulseDeck close failed.';
      diagnostic(connection, 'neutral-content-error', {
        ...gammaDetail(payload.gammaUrl),
        message: connection.lastError,
      });
      runtimeHealth.controllerState = 'error';
      await writeConnection(connection);
      await updateBadge(connection);
      throw error;
    }
  }

  runtimeHealth.controllerState = 'syncing';
  await updateBadge(connection);

  try {
    let authoritative = null;
    const lastCheckMs = Date.parse(connection.lastAuthoritativeCheckAt ?? '') || 0;
    const shouldCheck =
      payload.reconcile ||
      payload.force ||
      (connection.lastGammaUrl === payload.gammaUrl && Date.now() - lastCheckMs >= AUTHORITATIVE_CHECK_MS);

    if (shouldCheck) {
      const checked = await retryTransient(
        () => readPulseDeckSession(connection, context.signal),
        {
          signal: context.signal,
          isRetryable: isTransient,
          delays: [250, 750],
        },
      );
      authoritative = checked.value;
      connection.currentIndex = authoritative.currentSlideIndex;
      connection.sessionStatus = authoritative.status;
      connection.phase = authoritative.phase;
      connection.lastAuthoritativeCheckAt = new Date().toISOString();
      if (authoritative.status === 'ended') {
        throw new Error('The PulseDeck session has ended. Start a fresh session and reconnect.');
      }
    }

    const alreadyAligned = connection.currentIndex === target.index;
    let retries = 0;
    let state = authoritative;
    if (!alreadyAligned || payload.force) {
      const advanced = await retryTransient(
        () => advancePulseDeck(connection, target.index, context.signal),
        {
          signal: context.signal,
          isRetryable: isTransient,
          onRetry: async (_error, retryCount) => {
            runtimeHealth.controllerState = 'recovering';
            connection.lastRetryCount = retryCount;
            await updateBadge(connection);
          },
        },
      );
      retries = advanced.retries;
      state = advanced.value?.state ?? null;
    }

    if (!context.isLatest()) return { ok: false, superseded: true };

    connection.currentIndex = state?.currentSlideIndex ?? target.index;
    connection.sessionStatus = state?.status ?? connection.sessionStatus;
    connection.phase = state?.phase ?? connection.phase;
    connection.lastGammaUrl = payload.gammaUrl;
    connection.lastSyncedAt = new Date().toISOString();
    connection.lastAuthoritativeCheckAt = new Date().toISOString();
    connection.lastLatencyMs = Date.now() - startedAt;
    connection.lastRetryCount = retries;
    connection.lastError = null;
    diagnostic(connection, alreadyAligned && !payload.force ? 'reconciled' : 'synced', {
      ...gammaDetail(payload.gammaUrl),
      targetIndex: target.index,
      latencyMs: connection.lastLatencyMs,
      retries,
    });
    runtimeHealth.controllerState = 'ready';
    runtimeHealth.embedMatchesTarget = false;
    await writeConnection(connection);
    await updateBadge(connection);

    return {
      ok: true,
      connected: true,
      skipped: alreadyAligned && !payload.force,
      target,
      expectedIndex: target.index,
      embedUrl: connection.embedUrl,
      trustedOrigin: connection.origin,
      showEmbed: target.displayMode !== 'hidden',
      displayMode: target.displayMode,
      latencyMs: connection.lastLatencyMs,
      retries,
    };
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    if (error?.name === 'ControllerConflictError') return await enterStandby(connection, error);
    if (error?.name === 'PresenterAuthError') {
      await clearConnection('auth-expired');
      throw new Error('Presenter access expired. Reconnect using a fresh PulseDeck remote URL.');
    }
    connection.lastError = error instanceof Error ? error.message : 'PulseDeck sync failed.';
    connection.lastLatencyMs = Date.now() - startedAt;
    diagnostic(connection, 'sync-error', {
      ...gammaDetail(payload.gammaUrl),
      message: connection.lastError,
    });
    runtimeHealth.controllerState = 'error';
    await writeConnection(connection);
    await updateBadge(connection);
    throw error;
  }
}

const syncController = createLatestWinsController(executeSync);

function publicStatus(connection) {
  if (!connection) return { connected: false, controllerState: 'disconnected' };
  const ready =
    !connection.paused &&
    connection.preflightWarnings.length === 0 &&
    connection.sessionStatus === 'live' &&
    runtimeHealth.embedReady &&
    runtimeHealth.gammaInventory?.mappedActivityCount === connection.activityCount &&
    runtimeHealth.baselineState === 'matched' &&
    connection.leaseState === 'active' &&
    runtimeHealth.controllerState !== 'error' &&
    runtimeHealth.controllerState !== 'unmapped';
  return {
    connected: true,
    ready,
    paused: connection.paused,
    pairingMode: connection.pairingMode,
    leaseState: connection.leaseState,
    leaseExpiresAt: connection.leaseExpiresAt,
    remoteHoldUntil: connection.remoteHoldUntil,
    controllerState: runtimeHealth.controllerState,
    deckTitle: connection.deckTitle,
    mappingCount: connection.mappingCount,
    slideCount: connection.slideCount,
    activityCount: connection.activityCount,
    documentSlugs: connection.documentSlugs,
    preflightWarnings: connection.preflightWarnings,
    currentIndex: connection.currentIndex,
    sessionStatus: connection.sessionStatus,
    phase: connection.phase,
    lastGammaUrl: connection.lastGammaUrl,
    lastSyncedAt: connection.lastSyncedAt,
    lastLatencyMs: connection.lastLatencyMs,
    lastRetryCount: connection.lastRetryCount,
    lastError: connection.lastError,
    ownerTabId: connection.ownerTabId,
    embedReady: runtimeHealth.embedReady,
    embedMatchesTarget: runtimeHealth.embedMatchesTarget,
    embedConnected: runtimeHealth.embedConnected,
    lastEmbedStateAt: runtimeHealth.lastEmbedStateAt,
    gammaInventory: runtimeHealth.gammaInventory,
    baselineState: runtimeHealth.baselineState,
    gammaBaseline: connection.gammaBaselines?.find(
      (baseline) => baseline.documentSlug === runtimeHealth.gammaInventory?.documentSlug,
    ) ?? null,
  };
}

async function setPaused(paused, tabId) {
  const connection = await readConnection();
  if (!connection) return { connected: false };
  if (!ownerMatches(connection, tabId)) throw new Error('Only the connected Gamma tab can control sync.');
  if (paused) {
    await releaseControllerLease(connection).catch(() => undefined);
  } else {
    try {
      await ensureControllerLease(connection, undefined, false);
    } catch (error) {
      if (error?.name === 'ControllerConflictError') {
        await enterStandby(connection, error);
        return publicStatus(connection);
      }
      throw error;
    }
  }
  connection.paused = paused;
  connection.lastError = null;
  diagnostic(connection, paused ? 'paused' : 'resumed');
  runtimeHealth.controllerState = paused ? 'paused' : 'ready';
  await writeConnection(connection);
  await updateBadge(connection);
  return publicStatus(connection);
}

async function receiveEmbedHealth(message, tabId) {
  const connection = await readConnection();
  if (!connection || !ownerMatches(connection, tabId)) return { ok: false };
  runtimeHealth.embedReady = Boolean(message.ready);
  runtimeHealth.embedConnected = Boolean(message.connected);
  runtimeHealth.embedMatchesTarget =
    Number.isInteger(message.currentSlideIndex) && message.currentSlideIndex === connection.currentIndex;
  runtimeHealth.lastEmbedStateAt = new Date().toISOString();
  if (message.degraded) runtimeHealth.controllerState = 'degraded';
  return { ok: true };
}

async function receiveGammaInventory(message) {
  const connection = await readConnection();
  if (!connection || !ownerMatches(connection, message.tabId)) return { ok: false };
  const location = parseGammaUrl(message.gammaUrl);
  const cardIds = Array.isArray(message.inventory?.cardIds)
    ? [...new Set(message.inventory.cardIds.filter((id) => /^[a-z0-9_-]{6,80}$/i.test(id)))]
    : [];
  if (!location || cardIds.length === 0) return { ok: false };

  runtimeHealth.gammaInventory = summarizeGammaInventory(
    connection.mappings,
    location.documentSlug,
    cardIds,
    message.inventory?.fingerprint,
  );
  const baseline = connection.gammaBaselines?.find(
    (candidate) => candidate.documentSlug === location.documentSlug,
  );
  runtimeHealth.baselineState = !baseline
    ? 'missing'
    : baseline.fingerprint === runtimeHealth.gammaInventory.fingerprint &&
        baseline.cardCount === runtimeHealth.gammaInventory.cardCount
      ? 'matched'
      : 'mismatch';
  return { ok: true };
}

async function freezeGammaBaseline(message) {
  const connection = await readConnection();
  if (!connection || !ownerMatches(connection, message.tabId)) return { ok: false };
  const inventory = runtimeHealth.gammaInventory;
  if (!inventory?.fingerprint || !inventory?.documentSlug || !inventory?.cardCount) {
    throw new Error('Gamma inventory is still loading. Try again in a moment.');
  }
  await ensureControllerLease(connection, undefined, false);
  const response = await pulseFetch(`${connection.origin}/api/gamma-sync/baseline`, {
    method: 'POST',
    headers: controllerHeaders(connection, true),
    body: JSON.stringify({
      sessionId: connection.sessionId,
      documentSlug: inventory.documentSlug,
      fingerprint: inventory.fingerprint,
      cardCount: inventory.cardCount,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 409) throw new ControllerConflictError('Another presenter controls baseline changes.', body.lease);
  if (!response.ok) throw new Error('PulseDeck could not freeze this Gamma version.');
  connection.gammaBaselines = [
    ...(connection.gammaBaselines ?? []).filter(
      (baseline) => baseline.documentSlug !== body.baseline.documentSlug,
    ),
    body.baseline,
  ];
  runtimeHealth.baselineState = 'matched';
  diagnostic(connection, 'baseline-frozen', {
    documentSlug: body.baseline.documentSlug,
    cardCount: body.baseline.cardCount,
  });
  await writeConnection(connection);
  return { ok: true, status: publicStatus(connection) };
}

async function takeControl(tabId) {
  const connection = await readConnection();
  if (!connection || !ownerMatches(connection, tabId)) throw new Error('Return to the connected Gamma tab.');
  await ensureControllerLease(connection, undefined, true);
  connection.leaseState = 'active';
  connection.paused = false;
  connection.lastError = null;
  runtimeHealth.controllerState = 'ready';
  diagnostic(connection, 'controller-takeover');
  await writeConnection(connection);
  await updateBadge(connection);
  return publicStatus(connection);
}

chrome.runtime.onInstalled.addListener(() => setBadge('', '#64748b'));

chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    const connection = await readConnection();
    if (connection?.ownerTabId === tabId) await clearConnection('owner-tab-closed');
  })();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const senderTabId = sender.tab?.id;
    switch (message?.type) {
      case 'CONFIGURE':
        return {
          ok: true,
          status: await configureFromRemoteUrl(message.remoteUrl, {
            tabId: message.tabId,
            windowId: message.windowId,
            gammaUrl: message.gammaUrl,
          }),
        };
      case 'CONFIGURE_PAIRING':
        return {
          ok: true,
          status: await configureFromPairingCode(message.pairingCode, message.origin, {
            tabId: message.tabId,
            windowId: message.windowId,
            gammaUrl: message.gammaUrl,
          }),
        };
      case 'DISCONNECT':
        await clearConnection('manual');
        return { ok: true, status: { connected: false } };
      case 'GET_STATUS':
        return { ok: true, status: publicStatus(await readConnection()) };
      case 'GET_DIAGNOSTICS': {
        const connection = await readConnection();
        return {
          ok: true,
          diagnostics: connection?.diagnostics ?? [],
          status: publicStatus(connection),
        };
      }
      case 'SET_PAUSED':
        return { ok: true, status: await setPaused(Boolean(message.paused), message.tabId) };
      case 'TAKE_CONTROL':
        return { ok: true, status: await takeControl(message.tabId) };
      case 'FREEZE_GAMMA_BASELINE':
        return await freezeGammaBaseline(message);
      case 'EMBED_HEALTH':
        return await receiveEmbedHealth(message, senderTabId);
      case 'UPDATE_GAMMA_INVENTORY':
        return await receiveGammaInventory(message);
      case 'GAMMA_NAVIGATED':
        return await syncController.submit({
          gammaUrl: message.gammaUrl,
          tabId: senderTabId,
          reconcile: false,
          force: false,
        });
      case 'RECONCILE_GAMMA_URL':
        return await syncController.submit({
          gammaUrl: message.gammaUrl,
          tabId: senderTabId,
          reconcile: true,
          force: false,
        });
      case 'SYNC_GAMMA_URL':
        return await syncController.submit({
          gammaUrl: message.gammaUrl,
          tabId: message.tabId,
          reconcile: true,
          force: Boolean(message.force),
        });
      default:
        return { ok: false, error: 'unknown_message' };
    }
  })()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error?.message ?? 'Unexpected error.' }));
  return true;
});
