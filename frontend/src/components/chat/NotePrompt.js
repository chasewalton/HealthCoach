import state from '../../state.js';
import { resetRecord } from '../../api/record.js';
import { escapeHtml } from '../../utils/format.js';
import { scrollBottom } from '../../utils/dom.js';
import { showToast } from '../Toast.js';

let onProceed = null;
let onOpenNoteReplace = null;
let _awaitingNoteConfirm = false;

export function setCallbacks(cbs) {
  onProceed = cbs.onProceed;
  onOpenNoteReplace = cbs.onOpenNoteReplace;
}

export function isAwaitingConfirm() {
  return _awaitingNoteConfirm;
}

export function show() {
  const rec = state.patientRecord;
  const isDefault = state.patientRecordIsDefault;

  let noteText = '';
  if (rec) {
    noteText = typeof rec === 'string' ? rec : (rec.text || JSON.stringify(rec, null, 2));
  }

  const preview = noteText.slice(0, 380);
  const hasMore = noteText.length > 380;

  const cardHtml = `
    <div class="chat-note-card">
      <div class="chat-note-card-header">
        <div class="chat-note-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="12" y1="17" x2="8" y2="17"/></svg>
        </div>
        <div class="chat-note-card-info">
          <div class="chat-note-card-title">${isDefault ? 'Demo Visit Note' : 'Your Visit Note'}</div>
          <div class="chat-note-card-meta">${isDefault ? 'BIDMC - Feb 14, 2025' : 'Uploaded by you'}</div>
        </div>
      </div>
      <div class="chat-note-card-body" id="note-card-preview-body">${escapeHtml(preview)}</div>
      ${hasMore ? `<button class="chat-note-card-toggle" id="note-card-toggle">Show full note</button>` : ''}
    </div>`;

  const chips = isDefault
    ? ["Looks good, let's start", "Upload my own note"]
    : ["Looks good, let's start", "Upload a different note", "Reset to demo note"];

  const body = document.getElementById('chat-body');
  const row = document.createElement('div');
  row.className = 'msg-row assistant';
  row.id = 'note-prompt-row';
  row.innerHTML = `
    <div class="msg-avatar">HC</div>
    <div class="msg-bubble">Here's the visit note I'll be using for this review. Does it look right, or would you like to update it?${cardHtml}</div>`;
  body.appendChild(row);

  const toggleBtn = row.querySelector('#note-card-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleExpand);
  }

  const chipRow = document.createElement('div');
  chipRow.className = 'choice-chips';
  chipRow.id = 'note-prompt-chips';
  chipRow.innerHTML = chips.map((c, i) =>
    `<button class="chip" style="animation-delay:${i * 0.08}s">${c}</button>`
  ).join('');
  chipRow.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => selectNoteChip(chip.textContent, chipRow));
  });
  body.appendChild(chipRow);
  scrollBottom();
}

function toggleExpand() {
  const bodyEl = document.getElementById('note-card-preview-body');
  const btn = document.getElementById('note-card-toggle');
  if (!bodyEl || !btn) return;
  bodyEl.classList.toggle('expanded');
  btn.textContent = bodyEl.classList.contains('expanded') ? 'Show less' : 'Show full note';
}

function selectNoteChip(value, chipsEl) {
  if (chipsEl) chipsEl.remove();

  if (value === 'Upload my own note' || value === 'Upload a different note') {
    _awaitingNoteConfirm = true;
    if (onOpenNoteReplace) onOpenNoteReplace();
    return;
  }

  if (value === 'Reset to demo note') {
    _awaitingNoteConfirm = true;
    resetToDefault();
    return;
  }

  if (onProceed) onProceed();
}

async function resetToDefault() {
  try {
    const data = await resetRecord();
    state.patientRecord = data.content;
    state.patientRecordIsDefault = data.isDefault;
  } catch (_) {}
  _awaitingNoteConfirm = false;
  showToast('Using demo note');
  if (onProceed) onProceed();
}

export function confirmAndProceed() {
  _awaitingNoteConfirm = false;
  if (onProceed) onProceed();
}
