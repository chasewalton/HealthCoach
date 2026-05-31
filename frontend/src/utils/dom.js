import state from '../state.js';
import { t } from '../i18n.js';

export function scrollBottom() {
  const body = document.getElementById('chat-body');
  if (body) {
    requestAnimationFrame(() => {
      body.scrollTop = body.scrollHeight;
    });
  }
}

const LANDING_CHAT_SCROLL_MARGIN_PX = 10;
/** Longer than native `scroll-behavior: smooth` so auto-follow feels deliberate. */
const LANDING_CHAT_SCROLL_DURATION_MS = 1200;

let landingChatScrollAnimToken = 0;

function scrollLandingChatTo(body, top) {
  const maxScroll = Math.max(0, body.scrollHeight - body.clientHeight);
  const target = Math.max(0, Math.min(top, maxScroll));

  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
    landingChatScrollAnimToken += 1;
    body.scrollTop = target;
    return;
  }

  const token = ++landingChatScrollAnimToken;
  const start = body.scrollTop;
  const delta = target - start;
  if (Math.abs(delta) < 0.5) return;

  const duration = LANDING_CHAT_SCROLL_DURATION_MS;
  const t0 = performance.now();

  function easeSmoothstep(u) {
    return u * u * (3 - 2 * u);
  }

  function frame(now) {
    if (token !== landingChatScrollAnimToken) return;
    const elapsed = now - t0;
    const u = Math.min(1, elapsed / duration);
    body.scrollTop = start + delta * easeSmoothstep(u);
    if (u < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

export function scrollLandingChatBottom() {
  const body = document.getElementById('landing-chat-body');
  if (!body) return;

  requestAnimationFrame(() => {
    const margin = LANDING_CHAT_SCROLL_MARGIN_PX;
    const maxScroll = Math.max(0, body.scrollHeight - body.clientHeight);
    const rows = Array.from(body.querySelectorAll('.msg-row.assistant')).filter(
      (el) => el.id !== 'landing-typing-row'
    );
    const lastAssistantRow = rows[rows.length - 1];

    if (!lastAssistantRow) {
      scrollLandingChatTo(body, maxScroll);
      return;
    }

    const viewport = Math.max(0, body.clientHeight - margin);
    const rowHeight = lastAssistantRow.getBoundingClientRect().height;

    if (rowHeight <= viewport) {
      scrollLandingChatTo(body, maxScroll);
      return;
    }

    const bodyRect = body.getBoundingClientRect();
    const rowRect = lastAssistantRow.getBoundingClientRect();
    const rawNext = body.scrollTop + (rowRect.top - bodyRect.top) - margin;
    scrollLandingChatTo(body, Math.min(maxScroll, Math.max(0, rawNext)));
  });
}

export function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.disabled = !el.value.trim();
}

export function getUserInitials() {
  const name = state.profile.name || state.user?.displayName || '';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || t('dom.initialsFallback');
}
