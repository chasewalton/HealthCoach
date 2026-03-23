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
  "Hi, I'm a HealthCoach. I'm here to talk about your past visits, upcoming appointments, or answer other health-related questions you may have.";

/** Replace host in production if you route support email elsewhere. */
const SUPPORT_MAILTO =
  'mailto:support@healthcoach.app?subject=HealthCoach%20support%20request';

let onOpenNoteModal = null;
let onOpenProfile = null;
let onOpenAdminLogin = null;
let onSignOut = null;
let onLoadSession = null;
let onStartCombinedFlow = null;
let onOpenHomeLanding = null;
let landingInputWired = false;
let landingQuickWired = false;
let newConvoWired = false;

export const LANDING_QUICK_PAST =
  'I have some questions about my past appointments.';
export const LANDING_QUICK_UPCOMING =
  'Help me prepare for my next visit.';
export const LANDING_QUICK_OTHER = 'I have a different question.';

export function setCallbacks(cbs) {
  onOpenNoteModal = cbs.onOpenNoteModal;
  onOpenProfile = cbs.onOpenProfile;
  onOpenAdminLogin = cbs.onOpenAdminLogin;
  onSignOut = cbs.onSignOut;
  onLoadSession = cbs.onLoadSession;
  onStartCombinedFlow = cbs.onStartCombinedFlow || null;
  onOpenHomeLanding = cbs.onOpenHomeLanding || null;
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
        </div>
        <div class="landing-sidebar-scroll">
          <div class="recent-list recent-list--sidebar" id="recent-list"></div>
        </div>
      </aside>

      <main class="landing-main landing-main--intro" id="landing-main">
        <canvas class="landing-main-3d" id="landing-main-3d" aria-hidden="true"></canvas>
        <div class="landing-main-stack" id="landing-main-stack">
          <div class="landing-hero-region">
            <div class="landing-hero landing-hero--compact">
              <div class="greeting-line"><span class="dot"></span><span id="greeting-text">Welcome back</span></div>
              <h1 class="hero-heading">How can we <em>help</em> you today?</h1>
              <p class="landing-intro-lead" id="landing-intro-lead">${LANDING_CHAT_GREETING}</p>
              <div class="landing-quick-actions" role="group" aria-label="Quick conversation starters">
                <button type="button" class="landing-quick-btn" id="landing-quick-past">${LANDING_QUICK_PAST}</button>
                <button type="button" class="landing-quick-btn" id="landing-quick-upcoming">${LANDING_QUICK_UPCOMING}</button>
                <button type="button" class="landing-quick-btn" id="landing-quick-other">${LANDING_QUICK_OTHER}</button>
              </div>
            </div>
          </div>

          <div class="landing-chat" id="landing-chat">
            <div class="landing-chat-messages" id="landing-chat-body"></div>
            <div class="landing-chat-input-area">
              <div class="landing-chat-input-wrap">
                <textarea
                  class="landing-chat-textarea"
                  id="landing-chat-input"
                  placeholder="Message HealthCoach..."
                  rows="1"
                ></textarea>
                <button type="button" class="landing-send-btn" id="landing-send-btn" disabled title="Send">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
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
}

export function resetLandingChat() {
  state.landingMessages = [];
  state.landingSessionId = null;
  state.landingConversationStarted = false;
  renderLandingChatMessages();
  updateLandingLayout();
}

export function loadDashboardSession(s) {
  state.landingMessages = (s.messages || []).map(m => ({ role: m.role, content: m.content }));
  state.landingSessionId = s.id;
  state.landingConversationStarted = state.landingMessages.length > 0;
  syncLandingAmbientTransition(state.landingConversationStarted ? 1 : 0);
  renderLandingChatMessages();
  updateLandingLayout();
}

export function renderLandingChatMessages() {
  const body = document.getElementById('landing-chat-body');
  if (!body) return;

  body.innerHTML = state.landingMessages
    .map((m) => {
      if (m.role === 'assistant') {
        return `
<div class="msg-row assistant">
  <div class="msg-avatar">HC</div>
  <div class="msg-bubble">${formatMessage(m.content)}</div>
</div>`;
      }
      return `
<div class="msg-row user">
  <div class="msg-bubble">${escapeHtml(m.content)}</div>
  <div class="msg-avatar">${getUserInitials()}</div>
</div>`;
    })
    .join('');

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

function wireLandingQuickActions() {
  if (landingQuickWired) return;
  const past = document.getElementById('landing-quick-past');
  const upcoming = document.getElementById('landing-quick-upcoming');
  const other = document.getElementById('landing-quick-other');
  if (!past || !upcoming || !other) return;
  landingQuickWired = true;
  past.addEventListener('click', () => sendLandingQuick(LANDING_QUICK_PAST));
  upcoming.addEventListener('click', () => {
    if (onStartCombinedFlow) onStartCombinedFlow();
  });
  other.addEventListener('click', () => sendLandingQuick(LANDING_QUICK_OTHER));
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

async function startNewConversation() {
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

function wireLandingBrandNav() {
  const el = document.getElementById('landing-brand-hit');
  if (!el) return;
  el.addEventListener('click', () => {
    if (onOpenHomeLanding) onOpenHomeLanding();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onOpenHomeLanding) onOpenHomeLanding();
    }
  });
}

export function init() {
  wireLandingMenu();
  wireLandingChatInput();
  wireLandingQuickActions();
  wireNewConversation();
  wireLandingBrandNav();
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

export async function renderRecentList() {
  try {
    const data = await listSessions();
    state.sessions = data.sessions || [];
  } catch (_) {}

  const list = document.getElementById('recent-list');
  if (!state.sessions.length) {
    list.innerHTML = `<div class="recent-empty">No conversations yet. Say hello below.</div>`;
    return;
  }

  list.innerHTML = state.sessions.slice(0, 20).map(s => {
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
