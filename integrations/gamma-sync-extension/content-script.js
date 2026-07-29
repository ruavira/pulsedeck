// Gamma Sync observes both Gamma's route signal and the card that actually owns
// the viewport. Navigation is settled briefly before it is sent so animated
// transitions and rapid key presses collapse to one authoritative destination.

const OVERLAY_ID = 'pulsedeck-gamma-live-overlay';
const AMBIENT_ID = 'pulsedeck-gamma-ambient-layer';
const SETTLE_MS = 140;
const HEARTBEAT_MS = 8000;
const EMBED_CONFIRM_TIMEOUT_MS = 1600;
const HASH_PRIORITY_MS = 700;

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
let lastHashChangeAt = Date.now();
let inventoryTimer = null;
let cachedInventory = null;
let runtimeContextActive = true;
const visibleCards = new Map();
const observedCards = new WeakSet();
const ambientSignalCounts = new Map();
let ambientSignalTimer = null;
let ambientQuestionCount = 0;
let ambientQuestionTimer = null;

const REACTIONS = new Set(['👏', '❤️', '😂', '🤯', '👍']);
const SIGNALS = {
  got_it: ['👍', 'Got it'],
  slow: ['🐢', 'Slow down'],
  lost: ['🤔', "I'm lost"],
  fast: ['⚡', 'Speed up'],
  hand: ['✋', 'Hand raised'],
};

function prepareAmbientLayer() {
  let host = document.getElementById(AMBIENT_ID);
  if (host) return host;
  host = document.createElement('div');
  host.id = AMBIENT_ID;
  host.setAttribute('aria-live', 'polite');
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { position: fixed !important; inset: 0 !important; pointer-events: none !important; }
      .reaction {
        position: fixed; bottom: 16px; left: var(--left); z-index: 3;
        font: 42px/1 Apple Color Emoji, Segoe UI Emoji, sans-serif;
        filter: drop-shadow(0 5px 8px rgba(15,23,42,.25));
        animation: pd-reaction-float 2800ms ease-out forwards;
      }
      @keyframes pd-reaction-float {
        0% { opacity: 0; transform: translate3d(0,0,0) scale(.65); }
        12% { opacity: 1; transform: translate3d(0,-8vh,0) scale(1); }
        100% { opacity: 0; transform: translate3d(var(--drift),-72vh,0) scale(1.18); }
      }
      .notice {
        position: fixed; z-index: 4; box-sizing: border-box; max-width: min(440px, calc(100vw - 32px));
        border: 1px solid rgba(15,118,110,.26); border-radius: 14px;
        background: rgba(255,255,255,.97); color: #0f2940;
        box-shadow: 0 12px 34px rgba(15,23,42,.2); backdrop-filter: blur(12px);
        padding: 12px 16px; font: 700 15px/1.35 ui-sans-serif, system-ui, sans-serif;
        animation: pd-notice-in 180ms ease-out;
      }
      .notice small { display:block; margin-top:3px; color:#56728a; font-weight:500; }
      .question { top: 18px; left: 18px; }
      .signal { bottom: 18px; left: 18px; }
      @keyframes pd-notice-in { from { opacity:0; transform:translateY(-8px) scale(.98); } }
      @media (prefers-reduced-motion: reduce) {
        .reaction { display:none; }
        .notice { animation:none; }
      }
    </style>
    <div class="events"></div>
    <div class="notice question" hidden></div>
    <div class="notice signal" hidden></div>`;
  document.documentElement.append(host);
  return host;
}

function renderAmbientReaction(emoji) {
  if (!REACTIONS.has(emoji) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const shadow = prepareAmbientLayer().shadowRoot;
  const reaction = document.createElement('span');
  reaction.className = 'reaction';
  reaction.textContent = emoji;
  reaction.style.setProperty('--left', `${12 + Math.random() * 76}%`);
  reaction.style.setProperty('--drift', `${(Math.random() - 0.5) * 120}px`);
  shadow.querySelector('.events').append(reaction);
  setTimeout(() => reaction.remove(), 3000);
}

function renderAmbientSignal(kind) {
  const signal = SIGNALS[kind];
  if (!signal) return;
  ambientSignalCounts.set(kind, (ambientSignalCounts.get(kind) ?? 0) + 1);
  const notice = prepareAmbientLayer().shadowRoot.querySelector('.signal');
  const parts = [...ambientSignalCounts.entries()].map(([key, count]) => {
    const [emoji, label] = SIGNALS[key];
    return `${emoji} ${label}${count > 1 ? ` ×${count}` : ''}`;
  });
  notice.textContent = parts.join(' · ');
  notice.hidden = false;
  clearTimeout(ambientSignalTimer);
  ambientSignalTimer = setTimeout(() => {
    ambientSignalCounts.clear();
    notice.hidden = true;
  }, 6500);
}

function renderAmbientQuestion(payload = {}) {
  if (payload.action && payload.action !== 'submitted') return;
  ambientQuestionCount += 1;
  const notice = prepareAmbientLayer().shadowRoot.querySelector('.question');
  notice.replaceChildren();
  const title = document.createElement('div');
  title.textContent = `❓ ${ambientQuestionCount === 1 ? 'New audience question' : `${ambientQuestionCount} new audience questions`}`;
  const detail = document.createElement('small');
  detail.textContent = 'Review or moderate it on the PulseDeck Remote.';
  notice.append(title, detail);
  notice.hidden = false;
  clearTimeout(ambientQuestionTimer);
  ambientQuestionTimer = setTimeout(() => {
    ambientQuestionCount = 0;
    notice.hidden = true;
  }, 8500);
}

function renderAmbientEvent(message) {
  if (message.event === 'reaction') renderAmbientReaction(message.payload?.emoji);
  else if (message.event === 'signal') renderAmbientSignal(message.payload?.kind);
  else if (message.event === 'qa') renderAmbientQuestion(message.payload);
}

function runtimeContextAvailable() {
  if (!runtimeContextActive) return false;
  try {
    if (!chrome.runtime?.id) {
      runtimeContextActive = false;
      return false;
    }
    return true;
  } catch {
    runtimeContextActive = false;
    return false;
  }
}

function isContextInvalidation(error) {
  return /extension context invalidated/i.test(error?.message ?? '');
}

function deactivateInvalidatedContext() {
  runtimeContextActive = false;
  clearTimeout(settleTimer);
  clearTimeout(retryTimer);
  clearTimeout(inventoryTimer);
  clearTimeout(revealFallbackTimer);
  hidePulseDeckOverlay();
}

async function sendRuntimeMessage(message) {
  if (!runtimeContextAvailable()) return { contextInvalidated: true };
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    if (isContextInvalidation(error) || !runtimeContextAvailable()) {
      deactivateInvalidatedContext();
      return { contextInvalidated: true };
    }
    throw error;
  }
}

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
  host.dataset.state = 'hidden';
  host.setAttribute('aria-hidden', 'true');
}

function revealPulseDeckOverlay() {
  const host = document.getElementById(OVERLAY_ID);
  if (!host || !pendingOverlay) return;
  host.dataset.mode = pendingOverlay.displayMode ?? 'side';
  host.shadowRoot.querySelector('.label').textContent =
    `Live interaction · ${pendingOverlay.title ?? 'PulseDeck'}`;
  host.dataset.visible = 'true';
  host.dataset.state = 'ready';
  host.setAttribute('aria-hidden', 'false');
  pendingOverlay = null;
}

function reportEmbedHealth(message = {}) {
  void sendRuntimeMessage({
      type: 'EMBED_HEALTH',
      ready: Boolean(message.ready ?? latestEmbedState?.ready),
      connected: Boolean(message.connected ?? latestEmbedState?.connected),
      degraded: Boolean(message.degraded ?? latestEmbedState?.degraded),
      currentSlideIndex:
        message.currentSlideIndex ?? latestEmbedState?.currentSlideIndex ?? null,
    }).catch(() => undefined);
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
    host.setAttribute('role', 'region');
    host.setAttribute('aria-live', 'polite');
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
          --pd-width: clamp(340px, 36vw, 600px);
          --pd-height: min(62vh, 610px);
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
          --pd-width: clamp(300px, 27vw, 440px);
          --pd-height: min(38vh, 360px);
          bottom: 20px !important;
          min-height: 240px !important;
        }
        :host([data-mode="focus"]) {
          --pd-top: 4vh;
          --pd-right: 4vw;
          --pd-width: 92vw;
          --pd-height: 92vh;
          min-height: 0 !important;
        }
        :host([data-presentation="true"][data-mode="side"]) {
          --pd-top: 7vh;
          --pd-right: 1.4vw;
          --pd-width: clamp(340px, 32vw, 540px);
          --pd-height: 86vh;
          min-height: 0 !important;
        }
        :host([data-size="small"][data-mode="side"]) { --pd-width: clamp(300px, 26vw, 430px); }
        :host([data-size="small"][data-mode="compact"]) {
          --pd-width: clamp(280px, 22vw, 360px); --pd-height: min(32vh, 310px); min-height: 210px !important;
        }
        :host([data-size="large"][data-mode="side"]) { --pd-width: clamp(380px, 40vw, 660px); }
        :host([data-size="large"][data-mode="compact"]) { --pd-width: clamp(340px, 34vw, 520px); }
        :host([data-dock="left"]) { left: 20px !important; right: auto !important; }
        :host([data-presentation="true"][data-dock="left"]) { left: 1.4vw !important; right: auto !important; }
        :host([data-minimized="true"]) {
          --pd-top: 76px; --pd-width: 280px; --pd-height: 38px;
          bottom: auto !important; min-height: 38px !important;
        }
        .shell {
          box-sizing: border-box;
          width: 100%; height: 100%; overflow: hidden;
          border: 1px solid rgba(15,118,110,.28); border-radius: 20px;
          background: rgba(255,255,255,.985);
        }
        .bar {
          box-sizing: border-box; height: 38px; display:flex; align-items:center;
          color: #0f766e; background: #f0fdfa;
        }
        .label {
          box-sizing: border-box; min-width:0; flex:1; padding: 8px 8px 6px 14px;
          overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
          font: 700 12px/20px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: .04em; text-transform: uppercase;
        }
        .controls { display:flex; align-items:center; gap:2px; padding-right:7px; }
        .controls button {
          width:27px; height:27px; border:0; border-radius:7px; background:transparent; color:#0f766e;
          cursor:pointer; font:700 15px/1 ui-sans-serif,system-ui,sans-serif;
        }
        .controls button:hover, .controls button:focus-visible { background:#ccfbf1; outline:none; }
        iframe {
          display: block; width: 100%; height: calc(100% - 38px);
          border: 0; background: transparent;
        }
        :host([data-minimized="true"]) iframe { display:none; }
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
        <div class="bar">
          <div class="label"></div>
          <div class="controls">
            <button class="dock" type="button" title="Move panel to the other side" aria-label="Move panel to the other side">↔</button>
            <button class="size" type="button" title="Change panel size" aria-label="Change panel size">◲</button>
            <button class="minimize" type="button" title="Minimize panel" aria-label="Minimize panel">−</button>
          </div>
        </div>
        <iframe title="PulseDeck live interaction" allow="clipboard-read; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>`;
    document.documentElement.append(host);
    host.dataset.dock = sessionStorage.getItem('pulsedeckGammaDock') === 'left' ? 'left' : 'right';
    host.dataset.size = sessionStorage.getItem('pulsedeckGammaSize') ?? 'normal';
    host.dataset.minimized = 'false';
    shadow.querySelector('.dock').addEventListener('click', () => {
      host.dataset.dock = host.dataset.dock === 'left' ? 'right' : 'left';
      sessionStorage.setItem('pulsedeckGammaDock', host.dataset.dock);
    });
    shadow.querySelector('.size').addEventListener('click', () => {
      host.dataset.size = host.dataset.size === 'normal' ? 'small' : host.dataset.size === 'small' ? 'large' : 'normal';
      sessionStorage.setItem('pulsedeckGammaSize', host.dataset.size);
    });
    shadow.querySelector('.minimize').addEventListener('click', () => {
      const minimized = host.dataset.minimized !== 'true';
      host.dataset.minimized = minimized ? 'true' : 'false';
      shadow.querySelector('.minimize').textContent = minimized ? '+' : '−';
      shadow.querySelector('.minimize').setAttribute('aria-label', minimized ? 'Expand panel' : 'Minimize panel');
    });
    const iframe = shadow.querySelector('iframe');
    iframe.addEventListener('load', () => {
      iframeLoaded = true;
      reportEmbedHealth({ ready: true });
    });
  }

  host.dataset.presentation = new URL(window.location.href).searchParams.get('mode') === 'present'
    ? 'true'
    : 'false';

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
  host.dataset.state = 'syncing';
  host.shadowRoot.querySelector('.label').textContent =
    `Live interaction · ${result.target?.title ?? 'PulseDeck'} · Synchronizing`;
  pendingOverlay = {
    expectedIndex: result.expectedIndex,
    displayMode: result.displayMode ?? 'side',
    title: result.target?.title ?? 'PulseDeck',
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
  if (event.data?.type === 'PULSEDECK_AMBIENT_EVENT') {
    renderAmbientEvent(event.data);
    return;
  }
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
  let bestCoverage = 0;
  for (const [cardId, coverage] of visibleCards) {
    if (coverage > bestCoverage) {
      bestCoverage = coverage;
      best = cardId;
    }
  }
  return { cardId: best, coverage: bestCoverage };
}

function gammaInventory() {
  if (cachedInventory) return cachedInventory;
  const entries = [];
  const seen = new Set();
  for (const card of document.querySelectorAll('[data-card-id]')) {
    if (card.closest('.preview-card-wrapper')) continue;
    const cardId = normalizeCardId(card.getAttribute('data-card-id'));
    if (!cardId || seen.has(cardId)) continue;
    seen.add(cardId);
    entries.push({
      cardId,
      text: (card.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 800),
    });
  }
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const entry of entries) {
    const value = `${entry.cardId}\u001f${entry.text}\u001e`;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= BigInt(value.charCodeAt(i));
      hash = (hash * prime) & mask;
    }
  }
  cachedInventory = {
    cardCount: entries.length,
    cardIds: entries.map((entry) => entry.cardId),
    fingerprint: hash.toString(16).padStart(16, '0'),
  };
  return cachedInventory;
}

function activeCardId() {
  const hash = normalizeCardId(window.location.hash.match(/^#card-(.+)$/i)?.[1]);
  const presentation = new URL(window.location.href).searchParams.get('mode') === 'present';
  if (hash && (presentation || Date.now() - lastHashChangeAt <= HASH_PRIORITY_MS)) return hash;
  const visible = viewportCandidate();
  if (visible.cardId && visible.coverage >= 0.28 && visible.cardId !== hash) {
    return visible.cardId;
  }
  return hash ?? visible.cardId;
}

const intersectionObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const cardId = normalizeCardId(entry.target.getAttribute('data-card-id'));
      if (!cardId) continue;
      if (entry.isIntersecting) visibleCards.set(cardId, entry.intersectionRatio);
      else visibleCards.delete(cardId);
    }
    scheduleReport();
  },
  { threshold: [0, 0.25, 0.5, 0.75, 1] },
);

function refreshObservedCards() {
  for (const card of document.querySelectorAll('[data-card-id]')) {
    if (card.closest('.preview-card-wrapper') || observedCards.has(card)) continue;
    observedCards.add(card);
    intersectionObserver.observe(card);
  }
}

function gammaUrlForCard(cardId) {
  const url = new URL(window.location.href);
  url.hash = `card-${cardId}`;
  return url.toString();
}

function scheduleRetry(cardId) {
  clearTimeout(retryTimer);
  if (!runtimeContextAvailable() || retryCount >= 4 || cardId !== candidateCardId) return;
  const delay = Math.min(6000, 750 * 2 ** retryCount);
  retryCount += 1;
  retryTimer = setTimeout(() => void reportNavigation(cardId), delay);
}

async function reportNavigation(cardId) {
  if (
    !runtimeContextAvailable() ||
    document.visibilityState !== 'visible' ||
    !cardId ||
    cardId !== candidateCardId
  ) return;
  const gammaUrl = gammaUrlForCard(cardId);
  if (gammaUrl === lastConfirmedNavigation || gammaUrl === inFlightNavigation) return;
  inFlightNavigation = gammaUrl;
  try {
    const result = await sendRuntimeMessage({ type: 'GAMMA_NAVIGATED', gammaUrl });
    if (result?.contextInvalidated) return;
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
  if (!runtimeContextAvailable() || scheduled) return;
  scheduled = true;
  requestAnimationFrame(settleNavigation);
}

window.addEventListener('hashchange', () => {
  lastHashChangeAt = Date.now();
  scheduleReport();
}, true);
window.addEventListener('popstate', scheduleReport, true);
window.addEventListener('scroll', scheduleReport, { capture: true, passive: true });
window.addEventListener('focus', scheduleReport, true);
document.addEventListener('visibilitychange', scheduleReport, true);

const observer = new MutationObserver(() => {
  cachedInventory = null;
  refreshObservedCards();
  clearTimeout(inventoryTimer);
  inventoryTimer = setTimeout(scheduleReport, 300);
});
observer.observe(document.documentElement, {
  subtree: true,
  childList: true,
  characterData: true,
});

setInterval(scheduleReport, 1000);
setInterval(() => {
  if (document.visibilityState !== 'visible' || !candidateCardId || inFlightNavigation) return;
  const gammaUrl = gammaUrlForCard(candidateCardId);
  void sendRuntimeMessage({ type: 'RECONCILE_GAMMA_URL', gammaUrl })
    .then(renderPulseDeckSync)
    .catch(() => undefined);
}, HEARTBEAT_MS);
refreshObservedCards();
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
