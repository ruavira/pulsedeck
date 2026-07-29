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
let ambientQuestionCount = 0;
let audienceHubOpen = false;

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
      .audience-hub {
        position: fixed; right: 0; top: 48%; z-index: 5; pointer-events: auto;
        display: flex; align-items: center; gap: 7px; box-sizing: border-box;
        min-width: 42px; height: 46px; padding: 0 10px; border: 0;
        border-radius: 14px 0 0 14px; color: #fff; background: #0f766e;
        box-shadow: 0 8px 24px rgba(15,23,42,.22); cursor: pointer;
        font: 800 15px/1 ui-sans-serif, system-ui, sans-serif;
        transform: translateY(-50%); transition: transform 160ms ease, background 160ms ease;
      }
      .audience-hub:hover, .audience-hub:focus-visible { background:#115e59; outline:3px solid rgba(45,212,191,.35); }
      .audience-hub[data-unread="true"] { animation: pd-hub-pulse 700ms ease-out 2; }
      .audience-hub .icon { font-size:20px; }
      .audience-hub .count { min-width:18px; text-align:center; }
      .audience-hub[data-edge="left"] { left:0; right:auto; border-radius:0 14px 14px 0; }
      .audience-drawer {
        position: fixed; right: 54px; top: 48%; z-index: 5; pointer-events: auto;
        box-sizing: border-box; width: min(330px, calc(100vw - 82px)); max-height: min(520px, 74vh);
        overflow: auto; padding: 16px; border: 1px solid rgba(15,118,110,.26); border-radius: 18px;
        background: rgba(255,255,255,.98); color:#0f2940;
        box-shadow:0 16px 42px rgba(15,23,42,.24); backdrop-filter:blur(14px);
        transform: translateY(-50%); font: 600 14px/1.4 ui-sans-serif,system-ui,sans-serif;
      }
      .audience-drawer h2 { margin:0 0 10px; font-size:16px; }
      .audience-drawer ul { list-style:none; margin:0; padding:0; }
      .audience-drawer li { display:flex; justify-content:space-between; gap:12px; padding:9px 0; border-top:1px solid #dcebea; }
      .audience-drawer small { display:block; margin-top:10px; color:#56728a; font-weight:500; }
      .audience-drawer button { width:100%; margin-top:12px; padding:9px; border:0; border-radius:10px; background:#e6fffb; color:#0f766e; cursor:pointer; font-weight:800; }
      .audience-drawer[data-edge="left"] { left:54px; right:auto; }
      @keyframes pd-hub-pulse { 50% { transform:translateY(-50%) scale(1.1); box-shadow:0 8px 28px rgba(13,148,136,.48); } }
      @media (prefers-reduced-motion: reduce) {
        .reaction { display:none; }
        .audience-hub { animation:none !important; transition:none; }
      }
    </style>
    <div class="events"></div>
    <button class="audience-hub" type="button" aria-label="Open audience inbox" hidden>
      <span class="icon">✋</span><span class="count">0</span>
    </button>
    <section class="audience-drawer" aria-label="Audience inbox" hidden>
      <h2>Audience inbox</h2><ul></ul>
      <small>Review questions on the private PulseDeck Remote.</small>
      <button class="clear" type="button">Mark all reviewed</button>
    </section>`;
  document.documentElement.append(host);
  const hub = shadow.querySelector('.audience-hub');
  hub.addEventListener('click', () => {
    audienceHubOpen = !audienceHubOpen;
    renderAudienceHub(false);
  });
  shadow.querySelector('.clear').addEventListener('click', () => {
    ambientSignalCounts.clear();
    ambientQuestionCount = 0;
    audienceHubOpen = false;
    renderAudienceHub(false);
  });
  return host;
}

function renderAudienceHub(unread = true) {
  const shadow = prepareAmbientLayer().shadowRoot;
  const hub = shadow.querySelector('.audience-hub');
  const drawer = shadow.querySelector('.audience-drawer');
  const signalTotal = [...ambientSignalCounts.values()].reduce((total, count) => total + count, 0);
  const total = signalTotal + ambientQuestionCount;
  const panelPosition = document.getElementById(OVERLAY_ID)?.dataset.position ?? 'bottom-right';
  const edge = panelPosition.endsWith('right') ? 'left' : 'right';
  hub.dataset.edge = edge;
  drawer.dataset.edge = edge;
  hub.hidden = total === 0;
  hub.querySelector('.count').textContent = String(total);
  if (unread) {
    hub.dataset.unread = 'false';
    void hub.offsetWidth;
    hub.dataset.unread = 'true';
  } else {
    hub.dataset.unread = 'false';
  }
  hub.setAttribute('aria-label', `Audience inbox, ${total} ${total === 1 ? 'item' : 'items'}`);
  const list = drawer.querySelector('ul');
  list.replaceChildren();
  for (const [kind, count] of ambientSignalCounts) {
    const [emoji, label] = SIGNALS[kind];
    const item = document.createElement('li');
    const name = document.createElement('span');
    const value = document.createElement('strong');
    name.textContent = `${emoji} ${label}`;
    value.textContent = String(count);
    item.append(name, value);
    list.append(item);
  }
  if (ambientQuestionCount > 0) {
    const item = document.createElement('li');
    const name = document.createElement('span');
    const value = document.createElement('strong');
    name.textContent = '❓ New questions';
    value.textContent = String(ambientQuestionCount);
    item.append(name, value);
    list.append(item);
  }
  drawer.hidden = total === 0 || !audienceHubOpen;
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
  renderAudienceHub(true);
  const lifetime = kind === 'hand' ? 60000 : 30000;
  setTimeout(() => {
    const remaining = Math.max(0, (ambientSignalCounts.get(kind) ?? 0) - 1);
    if (remaining === 0) ambientSignalCounts.delete(kind);
    else ambientSignalCounts.set(kind, remaining);
    renderAudienceHub(false);
  }, lifetime);
}

function renderAmbientQuestion(payload = {}) {
  if (payload.action && payload.action !== 'submitted') return;
  ambientQuestionCount += 1;
  renderAudienceHub(true);
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

const PANEL_POSITIONS = ['top-right', 'bottom-right', 'bottom-left', 'top-left'];

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function currentGammaCard() {
  const cardId = candidateCardId ?? activeCardId();
  if (!cardId) return null;
  return [...document.querySelectorAll('[data-card-id]')]
    .find((card) => !card.closest('.preview-card-wrapper') &&
      normalizeCardId(card.getAttribute('data-card-id')) === cardId) ?? null;
}

function meaningfulContentRects(card) {
  if (!card) return [];
  const rects = [];
  const viewportArea = window.innerWidth * window.innerHeight;
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  while (walker.nextNode() && rects.length < 240) {
    const range = document.createRange();
    range.selectNodeContents(walker.currentNode);
    for (const rect of range.getClientRects()) {
      if (rect.width > 5 && rect.height > 5) rects.push(rect);
    }
  }
  for (const media of card.querySelectorAll('img,svg,canvas,video,iframe,table')) {
    const rect = media.getBoundingClientRect();
    if (rect.width > 12 && rect.height > 12 && rect.width * rect.height < viewportArea * 0.8) rects.push(rect);
  }
  return rects;
}

function overlapArea(first, second) {
  const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
  const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
  return width * height;
}

function placementCandidates(mode, size = 'normal') {
  const margin = 18;
  const compact = mode === 'compact';
  const widthFactor = compact
    ? size === 'small' ? 0.22 : size === 'large' ? 0.34 : 0.27
    : size === 'small' ? 0.26 : size === 'large' ? 0.4 : 0.32;
  const width = compact
    ? clamp(window.innerWidth * widthFactor, size === 'small' ? 280 : 300, size === 'large' ? 520 : 440)
    : clamp(window.innerWidth * widthFactor, size === 'small' ? 300 : 340, size === 'large' ? 660 : 540);
  const height = compact
    ? clamp(window.innerHeight * (size === 'small' ? 0.32 : 0.38), size === 'small' ? 210 : 240, 360)
    : clamp(window.innerHeight * 0.54, 360, 560);
  const positions = {
    'top-right': { left: window.innerWidth - width - margin, top: margin },
    'bottom-right': { left: window.innerWidth - width - margin, top: window.innerHeight - height - margin },
    'bottom-left': { left: margin, top: window.innerHeight - height - margin },
    'top-left': { left: margin, top: margin },
  };
  return PANEL_POSITIONS.map((name) => ({
    name,
    left: positions[name].left,
    top: positions[name].top,
    right: positions[name].left + width,
    bottom: positions[name].top + height,
    width,
    height,
  }));
}

function scorePlacement(candidate, contentRects) {
  const overlap = contentRects.reduce((total, rect) => total + overlapArea(candidate, rect), 0);
  return overlap / Math.max(1, candidate.width * candidate.height);
}

function placePulseDeckOverlay(host, mode = host.dataset.mode ?? 'side') {
  if (!host || mode === 'focus' || window.innerWidth <= 900) return;
  const contentRects = meaningfulContentRects(currentGammaCard());
  const candidates = placementCandidates(mode, host.dataset.size);
  const best = candidates.reduce((winner, candidate) =>
    scorePlacement(candidate, contentRects) < scorePlacement(winner, contentRects) ? candidate : winner,
  );
  host.dataset.position = best.name;
  host.dataset.adaptive = 'true';
}

function revealPulseDeckOverlay() {
  const host = document.getElementById(OVERLAY_ID);
  if (!host || !pendingOverlay) return;
  host.dataset.mode = pendingOverlay.displayMode ?? 'side';
  host.dataset.minimized = 'false';
  host.shadowRoot.querySelector('.minimize').textContent = '−';
  placePulseDeckOverlay(host, host.dataset.mode);
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
        :host([data-visible="false"]) { transition: none !important; }
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
        :host([data-adaptive="true"][data-mode="side"]) {
          --pd-width: clamp(340px, 32vw, 540px); --pd-height: min(54vh, 560px); min-height: 360px !important;
        }
        :host([data-adaptive="true"][data-size="small"][data-mode="side"]) { --pd-width:clamp(300px,26vw,430px); }
        :host([data-adaptive="true"][data-size="large"][data-mode="side"]) { --pd-width:clamp(380px,40vw,660px); }
        :host([data-position="top-right"]) { top:18px !important; right:18px !important; bottom:auto !important; left:auto !important; }
        :host([data-position="bottom-right"]) { top:auto !important; right:18px !important; bottom:18px !important; left:auto !important; }
        :host([data-position="bottom-left"]) { top:auto !important; right:auto !important; bottom:18px !important; left:18px !important; }
        :host([data-position="top-left"]) { top:18px !important; right:auto !important; bottom:auto !important; left:18px !important; }
        :host([data-minimized="true"]) {
          --pd-top: 76px; --pd-width: 280px; --pd-height: 38px;
          top:76px !important; right:20px !important; bottom:auto !important; left:auto !important;
          min-height: 38px !important;
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
            top:auto !important; right:3vw !important; bottom:12px !important; left:auto !important;
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
            <button class="dock" type="button" title="Move panel" aria-label="Move panel">↔</button>
            <button class="size" type="button" title="Change panel size" aria-label="Change panel size">◲</button>
            <button class="minimize" type="button" title="Minimize panel" aria-label="Minimize panel">−</button>
          </div>
        </div>
        <iframe title="PulseDeck live interaction" allow="clipboard-read; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>`;
    document.documentElement.append(host);
    host.dataset.size = sessionStorage.getItem('pulsedeckGammaSize') ?? 'normal';
    host.dataset.minimized = 'false';
    shadow.querySelector('.dock').addEventListener('click', () => {
      const current = PANEL_POSITIONS.indexOf(host.dataset.position);
      host.dataset.position = PANEL_POSITIONS[(current + 1) % PANEL_POSITIONS.length];
      host.dataset.adaptive = 'true';
    });
    shadow.querySelector('.size').addEventListener('click', () => {
      host.dataset.size = host.dataset.size === 'normal' ? 'small' : host.dataset.size === 'small' ? 'large' : 'normal';
      sessionStorage.setItem('pulsedeckGammaSize', host.dataset.size);
      placePulseDeckOverlay(host);
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

window.addEventListener('resize', () => {
  const host = document.getElementById(OVERLAY_ID);
  if (host?.dataset.visible === 'true' && host.dataset.adaptive === 'true') placePulseDeckOverlay(host);
});

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
