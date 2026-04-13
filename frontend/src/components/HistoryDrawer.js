import state from '../state.js';
import { deleteSessionById } from '../api/sessions.js';
import { showToast } from './Toast.js';

function deriveSessionTitle(s) {
  const msgs = s.messages || [];
  const firstUser = msgs.find(m => m.role === 'user');
  if (!firstUser?.content) {
    if (s.mode === 'review') return 'Last Visit Review';
    if (s.mode === 'prepare') return 'Next Visit Prep';
    return 'Chat';
  }
  const t = String(firstUser.content).replace(/\s+/g, ' ').trim();
  if (t.length <= 50) return t;
  const cut = t.lastIndexOf(' ', 50);
  return t.slice(0, cut > 20 ? cut : 50) + '\u2026';
}

let onLoadSession = null;
let onSessionDeleted = null;

export function setCallbacks(cbs) {
  onLoadSession = cbs.onLoadSession;
  onSessionDeleted = cbs.onSessionDeleted;
}

export function render() {
  return `
  <div class="drawer-overlay" id="drawer-history">
    <div class="drawer">
      <div class="drawer-header">
        <div class="drawer-title">Chat History</div>
        <button class="icon-btn" id="drawer-close-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="drawer-body" id="drawer-body"></div>
    </div>
  </div>`;
}

export function init() {
  document.getElementById('drawer-close-btn').addEventListener('click', close);
  document.getElementById('drawer-history').addEventListener('click', (e) => {
    if (e.target === document.getElementById('drawer-history')) close();
  });
}

export function open() {
  renderItems();
  document.getElementById('drawer-history').classList.add('open');
}

export function close() {
  document.getElementById('drawer-history').classList.remove('open');
}

export function renderItems() {
  const body = document.getElementById('drawer-body');
  if (!state.sessions.length) {
    body.innerHTML = `<div style="padding:24px 8px;text-align:center;color:var(--neutral-400);font-size:calc(14px * var(--type-scale));">No conversations yet.</div>`;
    return;
  }
  body.innerHTML = state.sessions.slice().reverse().map(s => `
    <div class="drawer-item" data-session-id="${s.id}">
      <div class="drawer-item-title">${deriveSessionTitle(s)}</div>
      <div class="drawer-item-meta">${s.date} - ${s.messages.length} messages</div>
      <button class="session-delete-btn" title="Delete" data-delete-session="${s.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button>
    </div>
  `).join('');

  body.querySelectorAll('.drawer-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.session-delete-btn')) return;
      close();
      if (onLoadSession) onLoadSession(item.dataset.sessionId);
    });
  });
  body.querySelectorAll('[data-delete-session]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSession(btn.dataset.deleteSession);
    });
  });
}

async function deleteSession(id) {
  if (!confirm('Delete this conversation? This cannot be undone.')) return;
  try {
    await deleteSessionById(id);
  } catch (_) {}
  state.sessions = state.sessions.filter(s => s.id !== id);
  renderItems();
  if (onSessionDeleted) onSessionDeleted(id);
  showToast('Conversation deleted');
}
