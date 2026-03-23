import state from '../../state.js';
import { uploadRecord, resetRecord } from '../../api/record.js';
import { showToast } from '../Toast.js';
import { openModal, closeModal, closeModalOnOverlay } from './modalHelpers.js';

const MODAL_ID = 'modal-note';

let _awaitingNoteConfirm = false;
let onNoteUpdated = null;
let onProceedFromNote = null;

export function setCallbacks(cbs) {
  onNoteUpdated = cbs.onNoteUpdated;
  onProceedFromNote = cbs.onProceedFromNote;
}

export function setAwaitingConfirm(val) {
  _awaitingNoteConfirm = val;
}

export function render() {
  return `
  <div class="modal-overlay" id="${MODAL_ID}">
    <div class="modal">
      <div class="modal-drag"></div>

      <div id="note-view-mode">
        <div class="modal-header">
          <div class="modal-title">Visit Note</div>
          <button class="modal-close" data-close="${MODAL_ID}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="note-modal-badge" id="note-modal-badge">
          <div class="note-modal-badge-dot"></div>
          <span id="note-modal-badge-label">Demo Note</span>
        </div>
        <div class="note-modal-preview" id="note-modal-preview-content"></div>
        <button class="note-modal-edit-btn" id="note-enter-replace-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Replace with your own note
        </button>
        <button class="note-reset-btn" id="note-reset-btn-view" style="display:none">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
          Reset to Demo Note
        </button>
      </div>

      <div id="note-replace-mode" style="display:none">
        <div class="modal-header">
          <div class="modal-title">Replace Note</div>
          <button class="modal-close" data-close="${MODAL_ID}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <p style="font-size:13px;color:var(--neutral-500);margin-bottom:12px;line-height:1.55">Paste your SOAP note below -- it will replace what HealthCoach uses for this session.</p>
        <textarea class="note-textarea" id="note-textarea" placeholder="Paste your visit notes here..." maxlength="10000"></textarea>
        <div class="note-char-count"><span id="note-char-count">0</span> / 10,000</div>
        <div class="note-modal-actions">
          <button class="btn-primary" style="flex:2;margin-top:0" id="note-confirm-save-btn">Save Note</button>
          <button class="btn-outline" style="flex:1;margin-top:0" id="note-exit-replace-btn">Back</button>
        </div>
      </div>

      <div id="note-confirm-mode" style="display:none">
        <div class="modal-header">
          <div class="modal-title">Replace Note</div>
          <button class="modal-close" data-close="${MODAL_ID}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="note-confirm-row">
          <span class="note-confirm-msg">This will replace your current visit note. Are you sure?</span>
          <button class="note-confirm-no" id="note-cancel-confirm-btn">Go back</button>
          <button class="note-confirm-yes" id="note-submit-btn">Confirm</button>
        </div>
      </div>
    </div>
  </div>`;
}

export function init() {
  const overlay = document.getElementById(MODAL_ID);
  overlay.querySelectorAll(`[data-close="${MODAL_ID}"]`).forEach(btn => {
    btn.addEventListener('click', () => close());
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.getElementById('note-enter-replace-btn').addEventListener('click', enterReplaceMode);
  document.getElementById('note-reset-btn-view').addEventListener('click', useDefaultNote);
  document.getElementById('note-confirm-save-btn').addEventListener('click', confirmNoteSave);
  document.getElementById('note-exit-replace-btn').addEventListener('click', exitReplaceMode);
  document.getElementById('note-cancel-confirm-btn').addEventListener('click', cancelConfirm);
  document.getElementById('note-submit-btn').addEventListener('click', submitNote);
  document.getElementById('note-textarea').addEventListener('input', updateCharCount);
}

export function open() {
  const badge = document.getElementById('note-modal-badge');
  const badgeLabel = document.getElementById('note-modal-badge-label');
  if (state.patientRecordIsDefault) {
    badge.classList.remove('custom-active');
    badgeLabel.textContent = 'Demo Note';
  } else {
    badge.classList.add('custom-active');
    badgeLabel.textContent = 'Your Note';
  }

  const preview = document.getElementById('note-modal-preview-content');
  if (state.patientRecord) {
    const rec = state.patientRecord;
    preview.textContent = typeof rec === 'string' ? rec : (rec.text || JSON.stringify(rec, null, 2));
  } else {
    preview.textContent = '(No note loaded)';
  }

  document.getElementById('note-reset-btn-view').style.display =
    state.patientRecordIsDefault ? 'none' : 'flex';

  document.getElementById('note-view-mode').style.display = 'block';
  document.getElementById('note-replace-mode').style.display = 'none';
  document.getElementById('note-confirm-mode').style.display = 'none';
  openModal(MODAL_ID);
}

export function openInReplaceMode() {
  document.getElementById('note-view-mode').style.display = 'none';
  document.getElementById('note-replace-mode').style.display = 'block';
  document.getElementById('note-confirm-mode').style.display = 'none';
  document.getElementById('note-textarea').value = '';
  document.getElementById('note-char-count').textContent = '0';
  openModal(MODAL_ID);
}

function close() {
  closeModal(MODAL_ID);
  if (_awaitingNoteConfirm) {
    _awaitingNoteConfirm = false;
    if (onProceedFromNote) onProceedFromNote();
  }
}

function enterReplaceMode() {
  document.getElementById('note-textarea').value = '';
  document.getElementById('note-char-count').textContent = '0';
  document.getElementById('note-view-mode').style.display = 'none';
  document.getElementById('note-replace-mode').style.display = 'block';
  document.getElementById('note-confirm-mode').style.display = 'none';
}

function exitReplaceMode() {
  document.getElementById('note-view-mode').style.display = 'block';
  document.getElementById('note-replace-mode').style.display = 'none';
}

function confirmNoteSave() {
  if (!document.getElementById('note-textarea').value.trim()) {
    showToast('Please paste a note first.');
    return;
  }
  document.getElementById('note-replace-mode').style.display = 'none';
  document.getElementById('note-confirm-mode').style.display = 'block';
}

function cancelConfirm() {
  document.getElementById('note-replace-mode').style.display = 'block';
  document.getElementById('note-confirm-mode').style.display = 'none';
}

function updateCharCount() {
  const len = document.getElementById('note-textarea').value.length;
  document.getElementById('note-char-count').textContent = len;
}

async function submitNote() {
  const text = document.getElementById('note-textarea').value.trim();
  if (!text) { showToast('Please paste a note first.'); return; }
  try {
    await uploadRecord(text);
    state.patientRecord = { type: 'plaintext', text };
    state.patientRecordIsDefault = false;
    if (onNoteUpdated) onNoteUpdated();
    const wasAwaiting = _awaitingNoteConfirm;
    _awaitingNoteConfirm = false;
    closeModal(MODAL_ID);
    showToast('Note saved');
    if (wasAwaiting && onProceedFromNote) onProceedFromNote();
  } catch (_) {
    showToast('Could not save note. Please try again.');
  }
}

async function useDefaultNote() {
  if (!confirm('Reset to the demo note? Your custom note will be removed.')) return;
  try {
    const data = await resetRecord();
    state.patientRecord = data.content;
    state.patientRecordIsDefault = data.isDefault;
  } catch (_) {}
  if (onNoteUpdated) onNoteUpdated();
  closeModal(MODAL_ID);
  showToast('Using demo note');
}
