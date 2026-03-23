import state from '../../state.js';
import { showToast } from '../Toast.js';
import { openModal, closeModal, closeModalOnOverlay } from './modalHelpers.js';

const MODAL_ID = 'modal-share';

let onShareWithProvider = null;
let onDeleteSession = null;

export function setCallbacks(cbs) {
  onShareWithProvider = cbs.onShareWithProvider;
  onDeleteSession = cbs.onDeleteSession;
}

export function render() {
  return `
  <div class="modal-overlay" id="${MODAL_ID}">
    <div class="modal" style="max-width:400px">
      <div class="modal-drag"></div>
      <div class="modal-header">
        <div class="modal-title">Share or Manage</div>
        <button class="modal-close" data-close="${MODAL_ID}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <button class="share-option" id="share-provider-btn">
        <div class="share-option-icon teal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="share-option-body">
          <div class="share-option-title">Share with my provider</div>
          <div class="share-option-desc">Generate a summary and download it to bring to your appointment</div>
        </div>
      </button>
      <button class="share-option" id="share-copy-btn">
        <div class="share-option-icon blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </div>
        <div class="share-option-body">
          <div class="share-option-title">Copy conversation</div>
          <div class="share-option-desc">Copy the full conversation text to your clipboard</div>
        </div>
      </button>
      <hr class="share-delete-divider">
      <button class="share-option danger" id="share-delete-btn">
        <div class="share-option-icon coral">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </div>
        <div class="share-option-body">
          <div class="share-option-title">Delete this conversation</div>
          <div class="share-option-desc">Permanently remove this chat from your account</div>
        </div>
      </button>
    </div>
  </div>`;
}

export function init() {
  const overlay = document.getElementById(MODAL_ID);
  overlay.addEventListener('click', (e) => closeModalOnOverlay(e, MODAL_ID));
  overlay.querySelector(`[data-close="${MODAL_ID}"]`).addEventListener('click', () => closeModal(MODAL_ID));
  document.getElementById('share-provider-btn').addEventListener('click', () => {
    closeModal(MODAL_ID);
    if (onShareWithProvider) onShareWithProvider();
  });
  document.getElementById('share-copy-btn').addEventListener('click', copyConversation);
  document.getElementById('share-delete-btn').addEventListener('click', confirmDelete);
}

export function open() {
  openModal(MODAL_ID);
}

function copyConversation() {
  const text = state.messages
    .map(m => `${m.role === 'user' ? 'You' : 'HealthCoach'}: ${m.content}`)
    .join('\n\n');
  navigator.clipboard.writeText(text).then(() => {
    showToast('Conversation copied to clipboard');
  }).catch(() => {
    showToast('Could not copy -- try downloading instead.');
  });
  closeModal(MODAL_ID);
}

function confirmDelete() {
  closeModal(MODAL_ID);
  if (!confirm('Delete this conversation? This cannot be undone.')) return;
  if (onDeleteSession) onDeleteSession();
}
