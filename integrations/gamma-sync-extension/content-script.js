// Gamma Sync observes both Gamma's route signal and the card that actually owns
// the viewport. Navigation is settled briefly before it is sent so animated
// transitions and rapid key presses collapse to one authoritative destination.

const OVERLAY_ID = 'pulsedeck-gamma-live-overlay';
const SETTLE_MS = 140;
const HEARTBEAT_MS = 8000;
const EMBED_CONFIRM_TIMEOUT_MS = 1600;

let scheduled = false;
let settleTimer = null;
let retryTimer = null;
let candidateCardId = null;
let lastConfirmedNavigation = '';
let inFlightNavigation = '';
let retryCount = 0;
let trustedPulseDeckOrigin = null;
let iframeLoaded = false;
let latestEmbedState = null;
let pendingOverlay = null;
let revealFallbackTimer = null;

function normalizeCardId(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/^card-/i, '').trim();
  return /^[a-z0-9_-]{6,80}$/i.test(normalized) ? normalized : null;
}

function hidePulseDeckOverlay() {
  const host = document.getElementById(OVERLAY_ID);
  if (!host) return;
  pendingOverlay = null;
  clearTimeout(revealFallbackTimer);
  host.dataset.visible = 'false';
  host.setAttribute('aria-hidden', 'true');
}

function revealPulseDeckOverlay() {
  const host = document.getElementById(OVERLAY_ID);
  if (!host || !pendingOverlay) return;
  host.dataset.mode = pendingOverlay.displayMode ?? 'side';
  host.dataset.visible = 'true';
  host.setAttribute('aria-hidden', 'false');
  pendingOverlay = null;
}

function reportEmbedHealth(message = {}) {
  void chrome.runtime
    .sendMessage({
      type: 'EMBED_HEALTH',
      ready: Boolean(message.ready ?? latestEmbedState?.ready),
      connected: Boolean(message.connected ?? latestEmbedState?.connected),
      degraded: Boolean(message.degraded ?? latestEmbedState?.degraded),
      currentSlideIndex:
        message.currentSlideIndex ?? latestEmbedState?.currentSlideIndex ?? null,
    })
    .catch(() => undefined);
}

function preparePulseDeckOverlay(embedUrl, trustedOrigin) {
  if (!embedUrl || !trustedOrigin) return null;
  trustedPulseDeckOrigin = trustedOrigin;
  let host = document.getElementById(OVERLAY_ID);
  if (!host) {
    host = document.createElement('aside');
    host.id = OVERLAY_ID;
    host.dataset.visible = 'false';
    host.dataset.mode = 'side';
    host.setAttribute('aria-label', 'PulseDeck live interaction');
    host.setAttribute('aria-hidden', 'true');
    // Keep the host isolated without an inline `all` reset. Inline `all: initial`
    // wins over the shadow stylesheet's :host rules and leaves a supposedly
    // hidden overlay visible even after data-visible changes to false.
    host.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host {
          --pd-top: 76px;
          --pd-right: 20px;
          --pd-width: clamp(360px, 45vw, 720px);
          --pd-height: min(66vh, 650px);
          position: fixed !important;
          top: var(--pd-top) !important;
          right: var(--pd-right) !important;
          width: var(--pd-width) !important;
          height: var(--pd-height) !important;
          min-height: 420px !important;
          opacity: 0;
          visibility: hidden;
          transform: translate3d(18px, 0, 0) scale(.985);
          transition: opacity 180ms ease, transform 180ms ease, visibility 0s linear 180ms;
          filter: drop-shadow(0 18px 36px rgba(15,23,42,.24));
          color-scheme: light;
        }
        :host([data-visible="true"]) {
          opacity: 1;
          visibility: visible;
          pointer-events: auto !important;
          transform: translate3d(0, 0, 0) scale(1);
          transition: opacity 180ms ease, transform 180ms ease;
        }
        :host([data-mode="compact"]) {
          --pd-top: auto;
          --pd-right: 20px;
          --pd-width: clamp(320px, 34vw, 520px);
          --pd-height: min(46vh, 430px);
          bottom: 20px !important;
          min-height: 280px !important;
        }
        :host([data-mode="focus"]) {
          --pd-top: 4vh;
          --pd-right: 4vw;
          --pd-width: 92vw;
          --pd-height: 92vh;
          min-height: 0 !important;
        }
        .shell {
          box-sizing: border-box;
          width: 100%; height: 100%; overflow: hidden;
          border: 1px solid rgba(15,118,110,.28); border-radius: 20px;
          background: rgba(255,255,255,.985);
        }
        .label {
          box-sizing: border-box; height: 34px; padding: 8px 14px 6px;
          overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
          color: #0f766e; background: #f0fdfa;
          font: 700 12px/20px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: .04em; text-transform: uppercase;
        }
        iframe {
          display: block; width: 100%; height: calc(100% - 34px);
          border: 0; background: transparent;
        }
        @media (max-width: 900px) {
          :host(:not([data-mode="focus"])) {
            --pd-top: auto;
            --pd-right: 3vw;
            --pd-width: 94vw;
            --pd-height: 52vh;
            bottom: 12px !important;
            min-height: 320px !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          :host { transition: none !important; transform: none !important; }
        }
      </style>
      <div class="shell">
        <div class="label"></div>
        <iframe title="PulseDeck live interaction" allow="clipboard-read; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>`;
    document.documentElement.append(host);
    const iframe = shadow.querySelector('iframe');
    iframe.addEventListener('load', () => {
      iframeLoaded = true;
      reportEmbedHealth({ ready: true });
    });
  }

  const iframe = host.shadowRoot.querySelector('iframe');
  if (iframe.src !== embedUrl) {
    iframeLoaded = false;
    latestEmbedState = null;
    iframe.src = embedUrl;
  }
  return host;
}

function showPulseDeckOverlay(result) {
  const host = preparePulseDeckOverlay(result.embedUrl, result.trustedOrigin);
  if (!host) return;
  host.shadowRoot.querySelector('.label').textContent =
    `Live interaction · ${result.target?.title ?? 'PulseDeck'}`;
  pendingOverlay = {
    expectedIndex: result.expectedIndex,
    displayMode: result.displayMode ?? 'side',
  };

  const confirmed =
    latestEmbedState?.ready && latestEmbedState.currentSlideIndex === result.expectedIndex;
  if (confirmed) {
    revealPulseDeckOverlay();
    return;
  }

  clearTimeout(revealFallbackTimer);
  revealFallbackTimer = setTimeout(() => {
    // Backward-compatible fallback for a deployed embed that predates the
    // readiness protocol. The iframe must at least have completed a load.
    if (iframeLoaded && pendingOverlay?.expectedIndex === result.expectedIndex) {
      revealPulseDeckOverlay();
    }
  }, EMBED_CONFIRM_TIMEOUT_MS);
}

function renderPulseDeckSync(result) {
  if (result?.superseded || result?.paused || result?.notOwner) return;
  if (result?.embedUrl && result?.trustedOrigin) {
    preparePulseDeckOverlay(result.embedUrl, result.trustedOrigin);
  }
  if (result?.ok && result.showEmbed) showPulseDeckOverlay(result);
  else hidePulseDeckOverlay();
}

window.addEventListener('message', (event) => {
  const host = document.getElementById(OVERLAY_ID);
  const iframe = host?.shadowRoot?.querySelector('iframe');
  if (!iframe || event.source !== iframe.contentWindow || event.origin !== trustedPulseDeckOrigin) return;
  if (!['PULSEDECK_EMBED_READY', 'PULSEDECK_EMBED_STATE'].includes(event.data?.type)) return;

  latestEmbedState = {
    ready: true,
    connected: Boolean(event.data.connected),
    degraded: Boolean(event.data.degraded),
    currentSlideIndex: Number.isInteger(event.data.currentSlideIndex)
      ? event.data.currentSlideIndex
      : null,
  };
  reportEmbedHealth(latestEmbedState);
  if (
    pendingOverlay &&
    Number.isInteger(latestEmbedState.currentSlideIndex) &&
    latestEmbedState.currentSlideIndex === pendingOverlay.expectedIndex
  ) {
    clearTimeout(revealFallbackTimer);
    revealPulseDeckOverlay();
  }
});

function viewportCandidate() {
  let best = null;
  let bestScore = 0;
  const viewportArea = Math.max(1, innerWidth * innerHeight);
  for (const section of document.querySelectorAll('[data-card-id]')) {
    if (section.closest('.preview-card-wrapper')) continue;
    const cardId = normalizeCardId(section.getAttribute('data-card-id'));
    if (!cardId) continue;
    const rect = section.getBoundingClientRect();
    const width = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    const height = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    const score = width * height;
    if (score > bestScore) {
      bestScore = score;
      best = cardId;
    }
  }
  return { cardId: best, coverage: bestScore / viewportArea };
}

function gammaInventory() {
  const cardIds = [];
  const seen = new Set();
  for (const card of document.querySelectorAll('[data-card-id]')) {
    if (card.closest('.preview-card-wrapper')) continue;
    const cardId = normalizeCardId(card.getAttribute('data-card-id'));
    if (!cardId || seen.has(cardId)) continue;
    seen.add(cardId);
    cardIds.push(cardId);
  }
  return { cardCount: cardIds.length, cardIds };
}

function activeCardId() {
  const hash = normalizeCardId(window.location.hash.match(/^#card-(.+)$/i)?.[1]);
  const visible = viewportCandidate();
  if (visible.cardId && visible.coverage >= 0.28 && visible.cardId !== hash) {
    return visible.cardId;
  }
  return hash ?? visible.cardId;
}

function gammaUrlForCard(cardId) {
  const url = new URL(window.location.href);
  url.hash = `card-${cardId}`;
  return url.toString();
}

function scheduleRetry(cardId) {
  clearTimeout(retryTimer);
  if (retryCount >= 4 || cardId !== candidateCardId) return;
  const delay = Math.min(6000, 750 * 2 ** retryCount);
  retryCount += 1;
  retryTimer = setTimeout(() => void reportNavigation(cardId), delay);
}

async function reportNavigation(cardId) {
  if (document.visibilityState !== 'visible' || !cardId || cardId !== candidateCardId) return;
  const gammaUrl = gammaUrlForCard(cardId);
  if (gammaUrl === lastConfirmedNavigation || gammaUrl === inFlightNavigation) return;
  inFlightNavigation = gammaUrl;
  try {
    const result = await chrome.runtime.sendMessage({ type: 'GAMMA_NAVIGATED', gammaUrl });
    if (result?.ok) {
      lastConfirmedNavigation = gammaUrl;
      retryCount = 0;
    } else if (!result?.superseded && !result?.paused && !result?.notOwner && !result?.unmapped) {
      scheduleRetry(cardId);
    }
    renderPulseDeckSync(result);
  } catch {
    scheduleRetry(cardId);
  } finally {
    if (inFlightNavigation === gammaUrl) inFlightNavigation = '';
  }
}

function settleNavigation() {
  scheduled = false;
  if (document.visibilityState !== 'visible') return;
  const nextCardId = activeCardId();
  if (!nextCardId) return;
  if (candidateCardId !== nextCardId) {
    candidateCardId = nextCardId;
    retryCount = 0;
    clearTimeout(retryTimer);
  }
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => void reportNavigation(nextCardId), SETTLE_MS);
}

function scheduleReport() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(settleNavigation);
}

window.addEventListener('hashchange', scheduleReport, true);
window.addEventListener('popstate', scheduleReport, true);
window.addEventListener('scroll', scheduleReport, { capture: true, passive: true });
window.addEventListener('focus', scheduleReport, true);
document.addEventListener('visibilitychange', scheduleReport, true);

const observer = new MutationObserver(scheduleReport);
observer.observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['id', 'class', 'style', 'aria-current'],
});

setInterval(scheduleReport, 1000);
setInterval(() => {
  if (document.visibilityState !== 'visible' || !candidateCardId || inFlightNavigation) return;
  const gammaUrl = gammaUrlForCard(candidateCardId);
  void chrome.runtime
    .sendMessage({ type: 'RECONCILE_GAMMA_URL', gammaUrl })
    .then(renderPulseDeckSync)
    .catch(() => undefined);
}, HEARTBEAT_MS);
scheduleReport();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'HIDE_PULSEDECK_OVERLAY') {
    hidePulseDeckOverlay();
    sendResponse({ ok: true });
    return;
  }
  if (message?.type === 'PREPARE_PULSEDECK_OVERLAY') {
    preparePulseDeckOverlay(message.embedUrl, message.trustedOrigin);
    sendResponse({ ok: true });
    return;
  }
  if (message?.type === 'GET_GAMMA_LOCATION') {
    const cardId = activeCardId();
    sendResponse({
      gammaUrl: cardId ? gammaUrlForCard(cardId) : window.location.href,
      inventory: gammaInventory(),
    });
  }
});
