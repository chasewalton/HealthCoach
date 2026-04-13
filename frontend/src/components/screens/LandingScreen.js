import state from '../../state.js';
import { listSessions, deleteSessionById, saveSession as apiSaveSession } from '../../api/sessions.js';
import { sendChatMessage } from '../../api/chat.js';
import { showToast } from '../Toast.js';
import { isEmergency } from '../../utils/emergency.js';
import { formatMessage, escapeHtml } from '../../utils/format.js';
import { getUserInitials, scrollLandingChatBottom } from '../../utils/dom.js';
import {
  initLandingAmbient3d,
  setLandingAmbientMode,
  syncLandingAmbientTransition,
  disposeLandingAmbient3d,
} from '../../three/landingAmbient.js';

/** Shown as the first assistant message on the dashboard chat. */
export const LANDING_CHAT_GREETING =
  "Hi, I'm HealthCoach. I'm here to help you with your health information.";

/** Replace host in production if you route support email elsewhere. */
const SUPPORT_MAILTO =
  'mailto:support@healthcoach.app?subject=HealthCoach%20support%20request';

let onOpenNoteModal = null;
let onOpenProfile = null;
let onOpenAdminLogin = null;
let onSignOut = null;
let onLoadSession = null;
let onOpenHomeLanding = null;
let onOpenLandingShare = null;
let onEndChat = null;
let landingInputWired = false;
let landingQuickWired = false;
let newConvoWired = false;
let fontToggleWired = false;

const FONT_SIZES = ['font-xs', 'font-sm', 'font-md', 'font-lg', 'font-xl', 'font-xxl'];
const FONT_SIZE_KEY = 'healthcoach-chat-font-size';

export const LANDING_QUICK_PAST =
  'Review my last visits';

/** Legacy first user message in saved sessions */
const LANDING_QUICK_PAST_LEGACY = 'Review my past visits';
export const LANDING_QUICK_UPCOMING =
  'Prepare for my next visit';
export const LANDING_QUICK_OTHER = 'Ask something else';

export const OTHER_SUB_OPTIONS = [
  { id: 'other-labwork', label: 'Lab Results', message: 'I have questions about understanding my lab work.' },
  { id: 'other-radiology', label: 'Radiology', message: 'I have questions about my radiology or imaging results.' },
  { id: 'other-vocab', label: 'Words or phrases I don\u2019t understand', message: 'There are words or phrases from my visit that I don\u2019t understand.' },
  { id: 'other-custom', label: 'Ask my Own Question' },
];

function syncLandingPrepareButton() {
  const btn = document.getElementById('landing-prepare-btn');
  const labelEl = document.getElementById('landing-prepare-btn-label');
  if (!btn) return;
  const showReview = state.landingPrepareNextAction === 'review';
  const label = showReview ? LANDING_QUICK_PAST : LANDING_QUICK_UPCOMING;
  if (labelEl) labelEl.textContent = label;
  btn.setAttribute('title', label);
  btn.setAttribute('aria-label', label);
}

function applyLandingPrepareToggleFromMessage(text) {
  if (text === LANDING_QUICK_UPCOMING) {
    state.landingPrepareNextAction = 'review';
  } else if (text === LANDING_QUICK_PAST || text === LANDING_QUICK_PAST_LEGACY) {
    state.landingPrepareNextAction = 'prepare';
  }
  syncLandingPrepareButton();
}

function inferLandingPrepareNextFromMessages(messages) {
  const firstUser = (messages || []).find((m) => m.role === 'user');
  const first = firstUser?.content?.trim();
  if (first === LANDING_QUICK_UPCOMING) {
    state.landingPrepareNextAction = 'review';
  } else if (first === LANDING_QUICK_PAST || first === LANDING_QUICK_PAST_LEGACY) {
    state.landingPrepareNextAction = 'prepare';
  } else {
    state.landingPrepareNextAction = 'prepare';
  }
}

export function setCallbacks(cbs) {
  onOpenNoteModal = cbs.onOpenNoteModal;
  onOpenProfile = cbs.onOpenProfile;
  onOpenAdminLogin = cbs.onOpenAdminLogin;
  onSignOut = cbs.onSignOut;
  onLoadSession = cbs.onLoadSession;
  onOpenHomeLanding = cbs.onOpenHomeLanding || null;
  onOpenLandingShare = cbs.onOpenLandingShare || null;
  onEndChat = cbs.onEndChat || null;
}

export function render() {
  return `
  <div id="screen-landing" class="screen">
    <div class="top-bar">
      <div class="top-bar-logo" id="landing-brand-hit" role="button" tabindex="0" aria-label="HealthCoach home">
        Health<span>Coach</span>
      </div>
      <div class="top-bar-actions">
        <div class="landing-menu" id="landing-menu">
          <button
            type="button"
            class="landing-menu-trigger"
            id="landing-menu-btn"
            aria-expanded="false"
            aria-haspopup="true"
            aria-controls="landing-menu-panel"
            title="Menu"
          >
            <span class="landing-menu-avatar" id="landing-avatar" aria-hidden="true">HC</span>
            <span class="landing-menu-burger" aria-hidden="true">
              <span></span><span></span><span></span>
            </span>
          </button>
          <div class="landing-menu-panel" id="landing-menu-panel" role="menu" hidden>
            <button type="button" class="landing-menu-item" role="menuitem" data-action="open-profile">
              <span class="landing-menu-item-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              <span class="landing-menu-item-text">
                <span class="landing-menu-item-label">Profile</span>
              </span>
            </button>
            <button type="button" class="landing-menu-item landing-menu-item--note" id="landing-note-chip" role="menuitem" data-action="open-note">
              <span class="landing-menu-item-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="12" y1="17" x2="8" y2="17"/></svg>
              </span>
              <span class="landing-menu-item-text">
                <span class="landing-menu-item-label">Demo Conversation</span>
              </span>
            </button>
            <button type="button" class="landing-menu-item" role="menuitem" data-action="support">
              <span class="landing-menu-item-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </span>
              <span class="landing-menu-item-text">
                <span class="landing-menu-item-label">Support</span>
              </span>
            </button>
            <button type="button" class="landing-menu-item" role="menuitem" data-action="open-admin">
              <span class="landing-menu-item-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </span>
              <span class="landing-menu-item-text">
                <span class="landing-menu-item-label">Admin Access</span>
              </span>
            </button>
            <button type="button" class="landing-menu-item" role="menuitem" data-action="about">
              <span class="landing-menu-item-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              </span>
              <span class="landing-menu-item-text">
                <span class="landing-menu-item-label">About</span>
              </span>
            </button>
            <button type="button" class="landing-menu-item landing-menu-item--signout" role="menuitem" data-action="sign-out">
              <span class="landing-menu-item-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </span>
              <span class="landing-menu-item-text">
                <span class="landing-menu-item-label">Sign Out</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="landing-body">
      <aside class="landing-sidebar" aria-label="Conversations">
        <div class="landing-sidebar-header">
          <button type="button" class="landing-new-convo-btn" id="landing-new-convo-btn" title="Start a new chat">
            <span class="landing-new-convo-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </span>
            <span>New conversation</span>
          </button>
          <h2 class="landing-sidebar-title">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px;opacity:0.6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Chat History
          </h2>
          <div class="sidebar-search-wrap">
            <svg class="sidebar-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="sidebar-search-input" id="sidebar-search-input" placeholder="Search conversations..." autocomplete="off" />
          </div>
        </div>
        <div class="landing-sidebar-scroll">
          <div class="recent-list recent-list--sidebar" id="recent-list"></div>
        </div>
      </aside>

      <main class="landing-main landing-main--intro" id="landing-main">
        <canvas class="landing-main-3d" id="landing-main-3d" aria-hidden="true"></canvas>
        <div class="landing-main-stack" id="landing-main-stack">
          <div class="landing-hero-region">
            <div class="landing-font-toggle" id="landing-font-toggle" role="group" aria-label="Change chat text size">
              <button type="button" class="font-toggle-btn font-toggle-sm" id="font-toggle-sm" title="Smaller text" aria-label="Smaller text">A</button>
              <button type="button" class="font-toggle-btn font-toggle-lg" id="font-toggle-lg" title="Larger text" aria-label="Larger text">A</button>
            </div>
            <div class="landing-hero landing-hero--compact">
              <div class="greeting-line"><span id="greeting-text">Welcome back</span></div>
              <p class="landing-intro-lead" id="landing-intro-lead">${LANDING_CHAT_GREETING}</p>
              <h1 class="hero-heading">How can I <em>help</em> you today?</h1>
              <div class="landing-quick-actions" id="landing-quick-actions" role="group" aria-label="Quick conversation starters">
                <button type="button" class="landing-quick-btn" id="landing-quick-past">${LANDING_QUICK_PAST}</button>
                <button type="button" class="landing-quick-btn" id="landing-quick-upcoming">${LANDING_QUICK_UPCOMING}</button>
                <button type="button" class="landing-quick-btn" id="landing-quick-other">${LANDING_QUICK_OTHER}</button>
              </div>
              <div class="landing-sub-options" id="landing-sub-options" role="group" aria-labelledby="landing-sub-prompt" hidden>
                <button type="button" class="landing-sub-back" id="landing-sub-back" aria-label="Back to main options">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Back
                </button>
                <p class="landing-sub-prompt" id="landing-sub-prompt">What would you like to ask about?</p>
                <div class="landing-sub-options-grid">
                  ${OTHER_SUB_OPTIONS.map(o => `<button type="button" class="landing-sub-btn" data-sub-id="${o.id}">${o.label}</button>`).join('')}
                </div>
              </div>
            </div>
          </div>

          <div class="landing-chat" id="landing-chat">
            <div class="landing-chat-body-wrap">
              <div class="landing-chat-messages" id="landing-chat-body"></div>
              <button type="button" class="landing-prepare-btn" id="landing-prepare-btn" title="Prepare for my next visit" aria-label="Prepare for my next visit">
                <span id="landing-prepare-btn-label">Prepare for my next visit</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M10 14l2 2 4-4"/></svg>
              </button>
              <button type="button" class="landing-share-btn" id="landing-share-btn" title="Share conversation" aria-label="Share conversation">
                Share
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </button>
            </div>
            <div class="landing-chat-input-area">
              <div class="landing-chat-input-row">
                <div class="landing-chat-input-wrap">
                  <textarea
                    class="landing-chat-textarea"
                    id="landing-chat-input"
                    placeholder="Ask your question here..."
                    rows="1"
                  ></textarea>
                  <button type="button" class="landing-send-btn" id="landing-send-btn" disabled title="Send">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </div>
                <button type="button" class="landing-end-chat-btn" id="landing-end-chat-btn" title="End chat">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                  End
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>`;
}

function wireLandingMenu() {
  const wrap = document.getElementById('landing-menu');
  const btn = document.getElementById('landing-menu-btn');
  const panel = document.getElementById('landing-menu-panel');
  if (!wrap || !btn || !panel) return;

  function closeMenu() {
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    wrap.classList.remove('is-open');
  }

  function openMenu() {
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    wrap.classList.add('is-open');
  }

  function toggleMenu(e) {
    e.stopPropagation();
    if (panel.hidden) openMenu();
    else closeMenu();
  }

  btn.addEventListener('click', toggleMenu);

  panel.addEventListener('click', (e) => {
    const item = e.target.closest('[data-action]');
    if (!item) return;
    const action = item.dataset.action;
    if (action === 'open-profile' && onOpenProfile) onOpenProfile();
    if (action === 'open-note' && onOpenNoteModal) onOpenNoteModal();
    if (action === 'support') {
      window.location.href = SUPPORT_MAILTO;
    }
    if (action === 'open-admin' && onOpenAdminLogin) onOpenAdminLogin();
    if (action === 'about' && onOpenHomeLanding) onOpenHomeLanding();
    if (action === 'sign-out' && onSignOut) onSignOut();
    closeMenu();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#landing-menu')) closeMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
}

function wireLandingChatInput() {
  if (landingInputWired) return;
  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  if (!input || !sendBtn) return;
  landingInputWired = true;

  sendBtn.addEventListener('click', sendLandingMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendLandingMessage();
    }
  });
  input.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    sendBtn.disabled = !this.value.trim() || state.landingIsTyping;
  });
}

function updateLandingLayout() {
  const main = document.getElementById('landing-main');
  if (!main) return;
  const started = state.landingConversationStarted;
  main.classList.toggle('landing-main--intro', !started);
  main.classList.toggle('landing-main--chat-active', started);
  setLandingAmbientMode(started ? 'chat' : 'intro');
}

function beginLandingConversation() {
  if (state.landingConversationStarted) return;
  state.landingConversationStarted = true;
  updateLandingLayout();
}

export function initLandingChat() {
  wireLandingChatInput();
  if (!state.landingMessages.length) {
    state.landingConversationStarted = false;
  } else {
    state.landingConversationStarted = true;
  }
  renderLandingChatMessages();
  updateLandingLayout();
  syncLandingPrepareButton();
}

export function resetLandingChat() {
  state.landingMessages = [];
  state.landingSessionId = null;
  state.landingConversationStarted = false;
  state.landingPrepareNextAction = 'prepare';
  hideSubOptions();
  renderLandingChatMessages();
  updateLandingLayout();
  syncLandingPrepareButton();
}

export function loadDashboardSession(s) {
  state.landingMessages = (s.messages || []).map(m => ({ role: m.role, content: m.content }));
  state.landingSessionId = s.id;
  state.landingConversationStarted = state.landingMessages.length > 0;
  inferLandingPrepareNextFromMessages(state.landingMessages);
  syncLandingAmbientTransition(state.landingConversationStarted ? 1 : 0);
  renderLandingChatMessages();
  updateLandingLayout();
  syncLandingPrepareButton();
}

export function renderLandingChatMessages() {
  const body = document.getElementById('landing-chat-body');
  if (!body) return;

  body.innerHTML = state.landingMessages
    .map((m, idx) => {
      if (m.role === 'assistant') {
        return `
<div class="msg-row assistant">
  <div class="msg-avatar">HC</div>
  <div class="msg-bubble">${formatMessage(m.content)}</div>
</div>`;
      }
      return `
<div class="msg-row user">
  <div class="msg-bubble-wrap">
    <div class="msg-bubble">${escapeHtml(m.content)}</div>
    <button type="button" class="msg-edit-btn" data-msg-idx="${idx}" title="Edit message" aria-label="Edit message">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </button>
  </div>
  <div class="msg-avatar">${getUserInitials()}</div>
</div>`;
    })
    .join('');

  body.querySelectorAll('.msg-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.msgIdx, 10);
      beginEditMessage(idx);
    });
  });

  scrollLandingChatBottom();
  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  if (sendBtn) sendBtn.disabled = !input?.value.trim() || state.landingIsTyping;
}

function removeLandingTyping() {
  const row = document.getElementById('landing-typing-row');
  if (row) row.remove();
}

function showLandingTyping() {
  const body = document.getElementById('landing-chat-body');
  if (!body) return;
  removeLandingTyping();
  const row = document.createElement('div');
  row.className = 'msg-row assistant';
  row.id = 'landing-typing-row';
  row.innerHTML = `
    <div class="msg-avatar">HC</div>
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  body.appendChild(row);
  scrollLandingChatBottom();
}

async function saveLandingSession() {
  if (!state.landingMessages.length) return;
  if (!state.landingSessionId) {
    state.landingSessionId = crypto.randomUUID();
  }
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  try {
    await apiSaveSession(
      state.landingSessionId,
      'dashboard',
      date,
      state.landingMessages.map((m) => ({ role: m.role, content: m.content }))
    );
  } catch (_) {}
  await renderRecentList();
}

function beginEditMessage(idx) {
  if (state.landingIsTyping) return;
  const msg = state.landingMessages[idx];
  if (!msg || msg.role !== 'user') return;

  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  if (!input) return;

  state.landingMessages = state.landingMessages.slice(0, idx);
  renderLandingChatMessages();

  input.value = msg.content;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  if (sendBtn) sendBtn.disabled = false;
  input.focus();
}

async function sendLandingMessage() {
  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  if (!input || !sendBtn) return;
  const text = input.value.trim();
  if (!text || state.landingIsTyping) return;

  beginLandingConversation();

  if (isEmergency(text, 'dashboard')) {
    state.landingMessages.push({
      role: 'assistant',
      content:
        "**If you are experiencing a medical emergency right now, please call 911 or go to your nearest emergency room immediately.** If you're safe and were just mentioning something from a visit, no worries -- say so and we can continue.",
    });
    input.value = '';
    input.style.height = 'auto';
    renderLandingChatMessages();
    await saveLandingSession();
    return;
  }

  applyLandingPrepareToggleFromMessage(text);

  state.landingMessages.push({ role: 'user', content: text });
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  state.landingIsTyping = true;
  renderLandingChatMessages();

  const history = state.landingMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

  showLandingTyping();

  try {
    const data = await sendChatMessage({
      message: text,
      history,
      mode: 'dashboard',
      path: 'guided',
      record: state.patientRecord || {},
    });
    removeLandingTyping();
    state.landingMessages.push({ role: 'assistant', content: data.reply });
    renderLandingChatMessages();
    await saveLandingSession();
  } catch (err) {
    removeLandingTyping();
    state.landingMessages.push({
      role: 'assistant',
      content: err.message || 'Unable to reach the server. Please try again.',
    });
    renderLandingChatMessages();
  } finally {
    state.landingIsTyping = false;
    sendBtn.disabled = !input.value.trim();
  }
}

function sendLandingQuick(text) {
  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  if (!input || !sendBtn || state.landingIsTyping) return;
  input.value = text;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  sendBtn.disabled = !text.trim();
  sendLandingMessage();
}

function showSubOptions() {
  const main = document.getElementById('landing-quick-actions');
  const sub = document.getElementById('landing-sub-options');
  if (!main || !sub) return;
  main.hidden = true;
  sub.hidden = false;
}

function hideSubOptions() {
  const main = document.getElementById('landing-quick-actions');
  const sub = document.getElementById('landing-sub-options');
  if (!main || !sub) return;
  sub.hidden = true;
  main.hidden = false;
}

function wireLandingQuickActions() {
  if (landingQuickWired) return;
  const past = document.getElementById('landing-quick-past');
  const upcoming = document.getElementById('landing-quick-upcoming');
  const other = document.getElementById('landing-quick-other');
  const backBtn = document.getElementById('landing-sub-back');
  const subPanel = document.getElementById('landing-sub-options');
  if (!past || !upcoming || !other) return;
  landingQuickWired = true;
  past.addEventListener('click', () => sendLandingQuick(LANDING_QUICK_PAST));
  upcoming.addEventListener('click', () => sendLandingQuick(LANDING_QUICK_UPCOMING));
  other.addEventListener('click', () => showSubOptions());

  if (backBtn) backBtn.addEventListener('click', () => hideSubOptions());

  if (subPanel) {
    subPanel.querySelectorAll('.landing-sub-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const opt = OTHER_SUB_OPTIONS.find(o => o.id === btn.dataset.subId);
        if (!opt) return;
        hideSubOptions();
        if (opt.message) {
          sendLandingQuick(opt.message);
        } else {
          document.getElementById('landing-chat-input')?.focus();
        }
      });
    });
  }
}

function deriveSessionTitle(s) {
  const msgs = s.messages || [];
  const firstUser = msgs.find(m => m.role === 'user');
  if (!firstUser?.content) {
    if (s.mode === 'review') return 'Visit Review';
    if (s.mode === 'prepare') return 'Visit Prep';
    if (s.mode === 'combined') return 'Review & Prep';
    return 'Chat';
  }
  const t = String(firstUser.content).replace(/\s+/g, ' ').trim();
  if (t.length <= 50) return t;
  const cut = t.lastIndexOf(' ', 50);
  return t.slice(0, cut > 20 ? cut : 50) + '…';
}

export async function startNewConversation() {
  if (state.landingIsTyping) {
    showToast('Please wait for the current reply to finish.');
    return;
  }
  state.currentSessionId = null;
  resetLandingChat();
  const input = document.getElementById('landing-chat-input');
  const sendBtn = document.getElementById('landing-send-btn');
  if (input) {
    input.value = '';
    input.style.height = 'auto';
  }
  if (sendBtn) sendBtn.disabled = true;
  await renderRecentList();
  showToast('New conversation started');
  input?.focus();
}

function wireNewConversation() {
  if (newConvoWired) return;
  const btn = document.getElementById('landing-new-convo-btn');
  if (!btn) return;
  newConvoWired = true;
  btn.addEventListener('click', () => startNewConversation());
}

function applyFontSize(size) {
  const body = document.getElementById('landing-chat-body');
  if (!body) return;
  FONT_SIZES.forEach(c => body.classList.remove(c));
  body.classList.add(size);
  try { localStorage.setItem(FONT_SIZE_KEY, size); } catch (_) {}

  const idx = FONT_SIZES.indexOf(size);
  const mdIdx = FONT_SIZES.indexOf('font-md');
  const smBtn = document.getElementById('font-toggle-sm');
  const lgBtn = document.getElementById('font-toggle-lg');
  if (smBtn) smBtn.classList.toggle('active', idx < mdIdx);
  if (lgBtn) lgBtn.classList.toggle('active', idx > mdIdx);
}

function wireFontToggle() {
  if (fontToggleWired) return;
  const smBtn = document.getElementById('font-toggle-sm');
  const lgBtn = document.getElementById('font-toggle-lg');
  if (!smBtn || !lgBtn) return;
  fontToggleWired = true;

  const saved = localStorage.getItem(FONT_SIZE_KEY) || 'font-md';
  applyFontSize(FONT_SIZES.includes(saved) ? saved : 'font-md');

  smBtn.addEventListener('click', () => {
    const body = document.getElementById('landing-chat-body');
    if (!body) return;
    const idx = FONT_SIZES.findIndex(c => body.classList.contains(c));
    if (idx > 0) applyFontSize(FONT_SIZES[idx - 1]);
  });

  lgBtn.addEventListener('click', () => {
    const body = document.getElementById('landing-chat-body');
    if (!body) return;
    const idx = FONT_SIZES.findIndex(c => body.classList.contains(c));
    if (idx < FONT_SIZES.length - 1) applyFontSize(FONT_SIZES[idx + 1]);
  });
}

function wireLandingBrandNav() {
  const el = document.getElementById('landing-brand-hit');
  if (!el) return;
  el.addEventListener('click', () => startNewConversation());
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startNewConversation();
    }
  });
}

function wireLandingShareBtn() {
  const btn = document.getElementById('landing-share-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (onOpenLandingShare) onOpenLandingShare();
  });
}

function wireLandingPrepareBtn() {
  const btn = document.getElementById('landing-prepare-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (state.landingPrepareNextAction === 'review') {
      sendLandingQuick(LANDING_QUICK_PAST);
    } else {
      sendLandingQuick(LANDING_QUICK_UPCOMING);
    }
  });
}

function wireSidebarSearch() {
  const input = document.getElementById('sidebar-search-input');
  if (!input) return;
  input.addEventListener('input', () => renderFilteredList());
}

function wireEndChatBtn() {
  const btn = document.getElementById('landing-end-chat-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (onEndChat) onEndChat();
  });
}

export function init() {
  wireLandingMenu();
  wireLandingChatInput();
  wireLandingQuickActions();
  wireNewConversation();
  wireLandingBrandNav();
  wireFontToggle();
  wireLandingShareBtn();
  wireLandingPrepareBtn();
  wireSidebarSearch();
  wireEndChatBtn();
}

export function updatePersonalization() {
  const name = state.profile.name || state.user?.displayName || '';
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const greeting = name ? `${timeGreeting}, ${name}` : timeGreeting;
  document.getElementById('greeting-text').textContent = greeting;
  if (name) {
    document.getElementById('landing-avatar').textContent =
      name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
}

function getSearchQuery() {
  const input = document.getElementById('sidebar-search-input');
  return (input?.value || '').trim().toLowerCase();
}

function sessionMatchesQuery(s, query) {
  if (!query) return true;
  const title = deriveSessionTitle(s).toLowerCase();
  if (title.includes(query)) return true;
  const msgs = s.messages || [];
  return msgs.some(m => m.content && m.content.toLowerCase().includes(query));
}

function renderFilteredList() {
  const list = document.getElementById('recent-list');
  if (!list) return;
  const query = getSearchQuery();
  const filtered = state.sessions.filter(s => sessionMatchesQuery(s, query));

  if (!state.sessions.length) {
    list.innerHTML = `<div class="recent-empty">No conversations yet. Say hello below.</div>`;
    return;
  }
  if (!filtered.length) {
    list.innerHTML = `<div class="recent-empty">No conversations match your search.</div>`;
    return;
  }

  list.innerHTML = filtered.slice(0, 20).map(s => {
    const title = deriveSessionTitle(s);
    const isActive =
      (s.mode === 'dashboard' && s.id === state.landingSessionId) ||
      (s.mode !== 'dashboard' && s.id === state.currentSessionId);
    const activeClass = isActive ? ' recent-item--active' : '';
    const ariaCurrent = isActive ? ' aria-current="true"' : '';
    return `
    <div class="recent-item${activeClass}" data-session-id="${s.id}"${ariaCurrent}>
      <div class="recent-item-body">
        <div class="recent-item-title">${escapeHtml(title)}</div>
        <div class="recent-item-date">${s.date} · ${s.messages.length} messages</div>
      </div>
      <button class="session-delete-btn" title="Delete" data-delete-session="${s.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button>
    </div>`;
  }).join('');

  list.querySelectorAll('.recent-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.session-delete-btn')) return;
      if (onLoadSession) onLoadSession(item.dataset.sessionId);
    });
  });
  list.querySelectorAll('[data-delete-session]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSession(btn.dataset.deleteSession);
    });
  });
}

export async function renderRecentList() {
  try {
    const data = await listSessions();
    state.sessions = data.sessions || [];
  } catch (_) {}

  renderFilteredList();
}

export function updateNoteCard() {
  const chip = document.getElementById('landing-note-chip');
  if (!chip) return;
  if (state.patientRecordIsDefault) {
    chip.classList.remove('custom-active');
  } else {
    chip.classList.add('custom-active');
  }
}

async function deleteSession(id) {
  if (!confirm('Delete this conversation? This cannot be undone.')) return;
  try {
    await deleteSessionById(id);
  } catch (_) {}
  state.sessions = state.sessions.filter(s => s.id !== id);
  if (id === state.landingSessionId) {
    state.landingSessionId = null;
    resetLandingChat();
  }
  if (id === state.currentSessionId) {
    state.currentSessionId = null;
  }
  await renderRecentList();
  showToast('Conversation deleted');
}
