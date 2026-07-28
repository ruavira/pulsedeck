// Gamma updates the URL hash to #card-{id} as the active card changes. We also
// derive the most-visible <section id> as a fallback for editor/presenter builds
// where the hash update arrives a frame late.

let lastNavigation = '';
let scheduled = false;
const OVERLAY_ID = 'pulsedeck-gamma-live-overlay';

function hidePulseDeckOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
}

function showPulseDeckOverlay(embedUrl, title) {
  if (!embedUrl) return;
  let host = document.getElementById(OVERLAY_ID);
  if (!host) {
    host = document.createElement('aside');
    host.id = OVERLAY_ID;
    host.setAttribute('aria-label', 'PulseDeck live interaction');
    host.style.cssText = [
      'all:initial',
      'position:fixed',
      'z-index:2147483646',
      'top:76px',
      'right:20px',
      'width:clamp(360px,45vw,720px)',
      'height:min(66vh,650px)',
      'min-height:420px',
      'display:block',
      'filter:drop-shadow(0 18px 36px rgba(15,23,42,.24))',
    ].join(';');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light; }
        .shell {
          box-sizing: border-box;
          width: 100%; height: 100%; overflow: hidden;
          border: 1px solid rgba(15,118,110,.28); border-radius: 20px;
          background: rgba(255,255,255,.98);
        }
        .label {
          box-sizing: border-box; height: 34px; padding: 8px 14px 6px;
          overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
          color: #0f766e; background: #f0fdfa;
          font: 700 12px/20px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: .04em; text-transform: uppercase;
        }
        iframe { display: block; width: 100%; height: calc(100% - 34px); border: 0; background: transparent; }
        @media (max-width: 900px) {
          :host { top: auto !important; right: 3vw !important; bottom: 12px; width: 94vw !important; height: 52vh !important; min-height: 320px !important; }
        }
      </style>
      <div class="shell">
        <div class="label"></div>
        <iframe title="PulseDeck live interaction" allow="clipboard-read; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>`;
    document.documentElement.append(host);
  }
  const label = host.shadowRoot.querySelector('.label');
  const iframe = host.shadowRoot.querySelector('iframe');
  label.textContent = `Live interaction · ${title ?? 'PulseDeck'}`;
  if (iframe.src !== embedUrl) iframe.src = embedUrl;
}

function renderPulseDeckSync(result) {
  if (result?.ok && result.showEmbed) {
    showPulseDeckOverlay(result.embedUrl, result.target?.title);
  } else {
    hidePulseDeckOverlay();
  }
}

function visibleCardId() {
  const hash = window.location.hash.match(/^#card-([a-z0-9_-]+)$/i)?.[1];
  if (hash) return hash;

  let best = null;
  let bestScore = 0;
  for (const section of document.querySelectorAll('section[id]')) {
    const rect = section.getBoundingClientRect();
    const width = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    const height = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    const score = width * height;
    if (score > bestScore) {
      bestScore = score;
      best = section.id;
    }
  }
  return best;
}

async function reportNavigation() {
  scheduled = false;
  if (document.visibilityState !== 'visible') return;
  const cardId = visibleCardId();
  if (!cardId) return;
  const url = new URL(window.location.href);
  url.hash = `card-${cardId}`;
  const next = url.toString();
  if (next === lastNavigation) return;
  lastNavigation = next;
  try {
    renderPulseDeckSync(
      await chrome.runtime.sendMessage({ type: 'GAMMA_NAVIGATED', gammaUrl: next }),
    );
  } catch {
    hidePulseDeckOverlay();
  }
}

function scheduleReport() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(reportNavigation);
}

window.addEventListener('hashchange', scheduleReport, true);
window.addEventListener('popstate', scheduleReport, true);
window.addEventListener('scroll', scheduleReport, true);
window.addEventListener('focus', scheduleReport, true);
document.addEventListener('visibilitychange', scheduleReport, true);
setInterval(scheduleReport, 750);
scheduleReport();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'HIDE_PULSEDECK_OVERLAY') {
    hidePulseDeckOverlay();
    sendResponse({ ok: true });
    return;
  }
  if (message?.type === 'GET_GAMMA_LOCATION') {
    lastNavigation = '';
    scheduleReport();
    const cardId = visibleCardId();
    const url = new URL(window.location.href);
    if (cardId) url.hash = `card-${cardId}`;
    sendResponse({ gammaUrl: url.toString() });
  }
});
