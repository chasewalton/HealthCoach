import state from '../../state.js';
import { sendChatMessage } from '../../api/chat.js';
import { saveSession as apiSaveSession, deleteSessionById } from '../../api/sessions.js';
import { isEmergency } from '../../utils/emergency.js';
import { formatMessage, escapeHtml } from '../../utils/format.js';
import { scrollBottom, autoResize, getUserInitials } from '../../utils/dom.js';
import { showToast } from '../Toast.js';

const SOAP_SECTIONS = ['What Brought You In', 'What Was Found', 'What It Means', 'Your Plan'];
const PREP_SECTIONS = ['What Matters', '6-Month Health', 'Getting It Right', 'Wrap-Up'];
const COMBINED_SECTIONS = ['Your Last Visit', 'What Matters Most', 'What\'s Changed', 'Wrap-Up'];

let onGoBack = null;
let onOpenSummary = null;
let onOpenShareModal = null;
let onSignOut = null;
let onShowNotePrompt = null;

export function setCallbacks(cbs) {
  onGoBack = cbs.onGoBack;
  onOpenSummary = cbs.onOpenSummary;
  onOpenShareModal = cbs.onOpenShareModal;
  onSignOut = cbs.onSignOut;
  onShowNotePrompt = cbs.onShowNotePrompt;
}

export function render() {
  return `
  <div id="screen-chat" class="screen">
    <div class="chat-header">
      <button class="chat-back-btn" id="chat-back-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="chat-header-info">
        <div class="chat-mode-label" id="chat-mode-label">Review Mode</div>
        <div class="chat-title" id="chat-title">Last Visit Review</div>
      </div>
      <div class="chat-header-actions">
        <button class="icon-btn" id="chat-share-btn" title="Share or delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
        <button class="icon-btn" id="chat-new-btn" title="New chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button type="button" class="icon-btn" id="chat-signout-btn" title="Sign out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </div>

    <div class="chat-progress">
      <div class="chat-progress-fill" id="progress-fill" style="width:0%"></div>
    </div>

    <div class="section-pill-bar" id="section-pills" style="display:none"></div>

    <div class="chat-body" id="chat-body"></div>

    <div class="chat-input-area">
      <div class="chat-input-wrap">
        <textarea class="chat-textarea" id="chat-input" placeholder="Type your message..." rows="1"></textarea>
        <div class="chat-actions">
          <button class="chat-action-btn" id="voice-btn" title="Voice input">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </button>
          <button class="send-btn" id="send-btn" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
      <div class="summarize-bar" id="summarize-bar" style="display:none">
        <button class="summarize-btn" id="summarize-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Finish &amp; Create Summary
        </button>
      </div>
    </div>
  </div>`;
}

export function init() {
  document.getElementById('chat-back-btn').addEventListener('click', async () => {
    await saveCurrentSession();
    if (onGoBack) onGoBack();
  });
  document.getElementById('chat-share-btn').addEventListener('click', () => {
    if (onOpenShareModal) onOpenShareModal();
  });
  document.getElementById('chat-new-btn').addEventListener('click', async () => {
    await saveCurrentSession();
    startChat(state.chatMode);
  });
  document.getElementById('chat-signout-btn').addEventListener('click', () => {
    if (onSignOut) onSignOut();
  });
  document.getElementById('voice-btn').addEventListener('click', () => {
    showToast('Voice input coming soon');
  });
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('chat-input').addEventListener('keydown', handleInputKey);
  document.getElementById('chat-input').addEventListener('input', function () {
    autoResize(this);
  });
  document.getElementById('summarize-btn').addEventListener('click', () => {
    if (onOpenSummary) onOpenSummary();
  });
}

export function startChat(mode) {
  state.chatMode = mode;
  state.chatPath = null;
  state.messages = [];
  state.soapSection = 0;
  state.prepSection = 0;
  state.currentSessionId = null;
  state.lastSummary = null;

  const modeLabel = document.getElementById('chat-mode-label');
  const titleEl = document.getElementById('chat-title');
  const pillBar = document.getElementById('section-pills');
  const summarizeBar = document.getElementById('summarize-bar');

  if (mode === 'review') {
    modeLabel.textContent = 'Visit Review';
    modeLabel.className = 'chat-mode-label review';
    titleEl.textContent = 'Your Last Visit';
    renderSectionPills(SOAP_SECTIONS, 0);
    pillBar.style.display = 'flex';
    summarizeBar.style.display = 'flex';
  } else if (mode === 'combined') {
    modeLabel.textContent = 'Visit Review + Prep';
    modeLabel.className = 'chat-mode-label prepare';
    titleEl.textContent = 'Review & Prepare';
    renderSectionPills(COMBINED_SECTIONS, 0);
    pillBar.style.display = 'flex';
    summarizeBar.style.display = 'flex';
  } else {
    modeLabel.textContent = 'Visit Prep';
    modeLabel.className = 'chat-mode-label prepare';
    titleEl.textContent = 'Prepare for Your Next Visit';
    renderSectionPills(PREP_SECTIONS, 0);
    pillBar.style.display = 'flex';
    summarizeBar.style.display = 'flex';
  }

  document.getElementById('chat-body').innerHTML = '';
  setProgress(0);
  document.getElementById('screen-chat').classList.toggle('mode-prepare', mode === 'prepare' || mode === 'combined');
}

const PRIVACY_NOTE = 'This conversation is private and not shared with your doctor unless you choose to share it. I\'m not a doctor, so always check with your care team about medical decisions.';

export function showInitialPrompt() {
  const mode = state.chatMode;
  setTimeout(() => {
    if (mode === 'review' || mode === 'combined') {
      if (onShowNotePrompt) onShowNotePrompt();
    } else {
      sendOpeningMessage();
    }
  }, 400);
}

export function proceedFromNotePrompt() {
  setTimeout(() => sendOpeningMessage(), 350);
}

function sendOpeningMessage() {
  state.chatPath = 'guided';
  const firstName = state.profile.name ? state.profile.name.split(' ')[0] : '';
  const nameGreet = firstName ? `Hi ${firstName}!` : 'Hi there!';

  let opening;
  if (state.chatMode === 'review') {
    opening = `${nameGreet} I have your visit note loaded and I'm ready whenever you are.\n\nBefore I dive in -- is there anything specific from that visit you've been wondering about, or would you like me to walk through the whole thing together?`;
  } else if (state.chatMode === 'combined') {
    opening = `${nameGreet} I have your visit note loaded. We can go over what happened at your last visit and then help you get ready for the next one.\n\nWhat would be most helpful to start with -- is there something from your last visit that's been on your mind, or would you rather jump straight into preparing for what's ahead?`;
  } else {
    opening = `${nameGreet} I'm here to help you feel prepared and confident for your next appointment.\n\nWhat's the main thing on your mind about this upcoming visit?`;
  }

  addAssistantMessage(`${opening}\n\n${PRIVACY_NOTE}`);
  setProgress(5);
}

function renderSectionPills(sections, activeIdx) {
  const bar = document.getElementById('section-pills');
  bar.innerHTML = sections.map((s, i) => {
    let cls = 'section-pill';
    if (i < activeIdx) cls += ' done';
    if (i === activeIdx) cls += ' active';
    return `<div class="${cls}">${s}</div>`;
  }).join('');
}

function setProgress(pct) {
  document.getElementById('progress-fill').style.width = pct + '%';
}

export function addAssistantMessage(text, chips) {
  const body = document.getElementById('chat-body');
  const msgId = 'msg-' + Date.now();
  const row = document.createElement('div');
  row.className = 'msg-row assistant';
  row.innerHTML = `
    <div class="msg-avatar">HC</div>
    <div class="msg-bubble" id="${msgId}">${formatMessage(text)}</div>
  `;
  body.appendChild(row);

  if (chips && chips.length) {
    const chipRow = document.createElement('div');
    chipRow.className = 'choice-chips';
    chipRow.innerHTML = chips.map((c, i) =>
      `<button class="chip" data-chip="${c.replace(/"/g, '&quot;')}" style="animation-delay:${i * 0.08}s">${c}</button>`
    ).join('');
    chipRow.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => selectChip(chip.dataset.chip, chipRow));
    });
    body.appendChild(chipRow);
  }

  state.messages.push({ role: 'assistant', content: text, chips });
  scrollBottom();
}

export function addUserMessage(text) {
  const body = document.getElementById('chat-body');
  const row = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `
    <div class="msg-bubble">${escapeHtml(text)}</div>
    <div class="msg-avatar">${getUserInitials()}</div>
  `;
  body.appendChild(row);
  state.messages.push({ role: 'user', content: text });
  scrollBottom();
}

function showTyping() {
  const body = document.getElementById('chat-body');
  const row = document.createElement('div');
  row.className = 'msg-row assistant';
  row.id = 'typing-row';
  row.innerHTML = `
    <div class="msg-avatar">HC</div>
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  body.appendChild(row);
  scrollBottom();
}

function removeTyping() {
  const row = document.getElementById('typing-row');
  if (row) row.remove();
}

function selectChip(value, chipsEl) {
  chipsEl.remove();
  addUserMessage(value);
  processUserInput(value);
}

function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || state.isTyping) return;
  input.value = '';
  autoResize(input);
  document.getElementById('send-btn').disabled = true;
  addUserMessage(text);
  processUserInput(text);
}

function handleInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

async function processUserInput(text) {
  if (isEmergency(text, state.chatMode)) {
    addAssistantMessage(
      `**If you are experiencing a medical emergency right now, please call 911 or go to your nearest emergency room immediately.**\n\nIf you're safe and were just mentioning something from your visit, no worries -- let me know and we can continue.`,
      ['I\'m safe -- let\'s continue']
    );
    document.getElementById('send-btn').disabled = false;
    return;
  }

  // Only auto-trigger summary if the patient is explicitly asking for one
  if (/^(create|generate|make|give me).*summary/i.test(text.trim())) {
    if (onOpenSummary) onOpenSummary();
    document.getElementById('send-btn').disabled = false;
    return;
  }

  state.isTyping = true;
  showTyping();

  const history = state.messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));

  try {
    const data = await sendChatMessage({
      message: text,
      history,
      mode: state.chatMode,
      path: state.chatPath || 'guided',
      record: state.patientRecord || {},
    });
    removeTyping();
    addAssistantMessage(data.reply);
    updateProgressHeuristic();
  } catch (err) {
    removeTyping();
    addAssistantMessage(err.message || 'Unable to reach the server. Please check your connection and try again.');
  } finally {
    state.isTyping = false;
    document.getElementById('send-btn').disabled = false;
  }
}

function getSectionsForMode() {
  if (state.chatMode === 'review') return SOAP_SECTIONS;
  if (state.chatMode === 'combined') return COMBINED_SECTIONS;
  return PREP_SECTIONS;
}

function updateProgressHeuristic() {
  const totalTurns = state.messages.length;
  const sections = getSectionsForMode();
  const totalSections = sections.length;

  // Gentle progress: ramps slowly based on total exchanges (user + assistant).
  // A real conversation typically runs 12-20+ turns total.
  // Progress starts slow so patients don't feel rushed.
  const progress = Math.min(5 + Math.round((totalTurns / (totalSections * 5)) * 90), 95);
  setProgress(progress);

  // Section pill activation: advances roughly every 4-5 exchanges, lagging intentionally
  // so the patient never feels the UI is pushing them to "keep up."
  const exchangeCount = Math.floor(totalTurns / 2);
  const activeIdx = Math.min(Math.floor(exchangeCount / 4), totalSections - 1);
  renderSectionPills(sections, activeIdx);
}

export async function saveCurrentSession() {
  if (!state.messages.length) return;
  if (!state.currentSessionId) {
    state.currentSessionId = crypto.randomUUID();
  }
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  try {
    await apiSaveSession(
      state.currentSessionId,
      state.chatMode,
      date,
      state.messages.map(m => ({ role: m.role, content: m.content }))
    );
  } catch (_) {}
}

export async function loadSession(s) {
  if (s.mode === 'dashboard') {
    return;
  }
  state.chatMode = s.mode;
  state.chatPath = 'guided';
  state.messages = s.messages.map(m => ({ role: m.role, content: m.content }));
  state.currentSessionId = s.id;
  document.getElementById('screen-chat').classList.toggle('mode-prepare', s.mode === 'prepare' || s.mode === 'combined');

  const modeLabel = document.getElementById('chat-mode-label');
  const titleEl = document.getElementById('chat-title');
  if (s.mode === 'review') {
    modeLabel.textContent = 'Visit Review';
    modeLabel.className = 'chat-mode-label review';
    titleEl.textContent = 'Your Last Visit';
    renderSectionPills(SOAP_SECTIONS, SOAP_SECTIONS.length - 1);
  } else if (s.mode === 'combined') {
    modeLabel.textContent = 'Visit Review + Prep';
    modeLabel.className = 'chat-mode-label prepare';
    titleEl.textContent = 'Review & Prepare';
    renderSectionPills(COMBINED_SECTIONS, COMBINED_SECTIONS.length - 1);
  } else {
    modeLabel.textContent = 'Visit Prep';
    modeLabel.className = 'chat-mode-label prepare';
    titleEl.textContent = 'Prepare for Your Next Visit';
    renderSectionPills(PREP_SECTIONS, PREP_SECTIONS.length - 1);
  }

  const body = document.getElementById('chat-body');
  body.innerHTML = '';
  s.messages.forEach(m => {
    if (m.role === 'assistant') addAssistantMessage(m.content);
    else addUserMessage(m.content);
  });
  setProgress(100);
  document.getElementById('summarize-bar').style.display = 'flex';
  document.getElementById('section-pills').style.display = 'flex';
}

export async function deleteCurrentSession() {
  const id = state.currentSessionId;
  if (id) {
    try {
      await deleteSessionById(id);
    } catch (_) {}
  }
  state.messages = [];
  state.currentSessionId = null;
  state.lastSummary = null;
}
