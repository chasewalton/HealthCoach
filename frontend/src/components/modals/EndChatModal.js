import state from '../../state.js';
import { generateSummary } from '../../api/chat.js';
import { showToast } from '../Toast.js';
import { openModal, closeModal, closeModalOnOverlay } from './modalHelpers.js';

const MODAL_ID = 'modal-end-chat';

let onConfirmEnd = null;
let onOpenShare = null;

export function setCallbacks(cbs) {
  onConfirmEnd = cbs.onConfirmEnd;
  onOpenShare = cbs.onOpenShare;
}

export function render() {
  return `
  <div class="modal-overlay" id="${MODAL_ID}">
    <div class="modal modal--end-chat">
      <div class="modal-drag"></div>
      <div class="modal-header">
        <div class="modal-title">End Conversation</div>
        <button class="modal-close" data-close="${MODAL_ID}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="ec-section">
        <div class="ec-section-label">Conversation Summary</div>
        <div id="ec-summary-status" class="ec-summary-status"></div>
        <textarea class="ec-summary-textarea" id="ec-summary-textarea" placeholder="Your conversation summary will appear here..." rows="6"></textarea>
        <button type="button" class="ec-regenerate-btn" id="ec-regenerate-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Regenerate
        </button>
      </div>

      <div class="ec-actions">
        <button type="button" class="ec-share-btn" id="ec-share-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          Share
        </button>
        <button type="button" class="ec-cancel-btn" id="ec-cancel-btn">Continue chatting</button>
        <button type="button" class="ec-confirm-btn" id="ec-confirm-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          End Conversation
        </button>
      </div>
    </div>
  </div>`;
}

async function loadSummary() {
  const textarea = document.getElementById('ec-summary-textarea');
  const status = document.getElementById('ec-summary-status');
  const regenBtn = document.getElementById('ec-regenerate-btn');
  if (!textarea || !status) return;

  textarea.value = '';
  textarea.disabled = true;
  regenBtn.disabled = true;
  status.textContent = 'Generating summary...';
  status.className = 'ec-summary-status ec-summary-status--loading';

  const history = state.landingMessages.map(m => ({ role: m.role, content: m.content }));

  try {
    const data = await generateSummary(history, 'dashboard');
    if (!data.summary) {
      status.textContent = 'Could not generate summary. You can write your own below.';
      status.className = 'ec-summary-status ec-summary-status--error';
    } else {
      textarea.value = data.summary;
      status.textContent = 'You can edit this summary before sharing or ending.';
      status.className = 'ec-summary-status';
    }
  } catch (_) {
    status.textContent = 'Unable to reach the server. You can write your own summary below.';
    status.className = 'ec-summary-status ec-summary-status--error';
  } finally {
    textarea.disabled = false;
    regenBtn.disabled = false;
  }
}

export function init() {
  const overlay = document.getElementById(MODAL_ID);
  overlay.addEventListener('click', (e) => closeModalOnOverlay(e, MODAL_ID));
  overlay.querySelector(`[data-close="${MODAL_ID}"]`).addEventListener('click', () => closeModal(MODAL_ID));

  document.getElementById('ec-cancel-btn').addEventListener('click', () => closeModal(MODAL_ID));

  document.getElementById('ec-regenerate-btn').addEventListener('click', () => loadSummary());

  document.getElementById('ec-share-btn').addEventListener('click', () => {
    closeModal(MODAL_ID);
    if (onOpenShare) onOpenShare();
  });

  document.getElementById('ec-confirm-btn').addEventListener('click', () => {
    const summary = document.getElementById('ec-summary-textarea').value.trim();
    state.landingLastSummary = summary || null;
    closeModal(MODAL_ID);
    if (onConfirmEnd) onConfirmEnd();
  });
}

export function open() {
  openModal(MODAL_ID);
  loadSummary();
}
