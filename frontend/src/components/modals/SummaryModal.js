import state from '../../state.js';
import { generateSummary } from '../../api/chat.js';
import { formatMessage } from '../../utils/format.js';
import { showToast } from '../Toast.js';
import { openModal, closeModal, closeModalOnOverlay } from './modalHelpers.js';

const MODAL_ID = 'modal-summary';

export function render() {
  return `
  <div class="modal-overlay" id="${MODAL_ID}">
    <div class="modal">
      <div class="modal-drag"></div>
      <div class="modal-header">
        <div class="modal-title">Visit Summary</div>
        <button class="modal-close" data-close="${MODAL_ID}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div id="summary-content"></div>
      <div class="summary-actions">
        <button class="btn-outline" id="summary-email-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Email
        </button>
        <button class="btn-outline" id="summary-dl-txt-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download .txt
        </button>
        <button class="btn-outline" id="summary-dl-json-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download .json
        </button>
      </div>
    </div>
  </div>`;
}

export function init() {
  const overlay = document.getElementById(MODAL_ID);
  overlay.addEventListener('click', (e) => closeModalOnOverlay(e, MODAL_ID));
  overlay.querySelector(`[data-close="${MODAL_ID}"]`).addEventListener('click', () => closeModal(MODAL_ID));
  document.getElementById('summary-email-btn').addEventListener('click', emailSummary);
  document.getElementById('summary-dl-txt-btn').addEventListener('click', () => downloadSummary('txt'));
  document.getElementById('summary-dl-json-btn').addEventListener('click', () => downloadSummary('json'));
}

export async function open() {
  const content = document.getElementById('summary-content');
  const modeLabel = state.chatMode === 'review' ? 'Visit Review' : 'Appointment Prep';

  content.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:32px 16px;color:var(--neutral-500);">
      <div class="typing-indicator" style="display:inline-flex;">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
      <div style="font-size:calc(14px * var(--type-scale));">Generating your summary...</div>
    </div>
  `;
  openModal(MODAL_ID);

  const history = state.messages.map(m => ({ role: m.role, content: m.content }));

  try {
    const data = await generateSummary(history, state.chatMode);
    if (!data.summary) {
      content.innerHTML = `<p style="color:var(--coral-500);padding:16px;">Could not generate summary. Please try again.</p>`;
      return;
    }
    state.lastSummary = data.summary;
    content.innerHTML = `
      <div style="font-size:calc(12px * var(--type-scale));color:var(--neutral-400);margin-bottom:20px;">
        Generated ${new Date().toLocaleString()} - ${modeLabel}
      </div>
      <div style="font-size:calc(15px * var(--type-scale));line-height:1.7;color:var(--color-text);">
        ${formatMessage(data.summary)}
      </div>
      <div style="background:var(--teal-50);border-radius:var(--radius-md);padding:12px 16px;margin-top:20px;font-size:calc(13px * var(--type-scale));color:var(--teal-700);line-height:1.5;">
        Bring this summary to your next appointment to help your doctor understand what matters most to you.
      </div>
    `;
  } catch (_) {
    content.innerHTML = `<p style="color:var(--coral-500);padding:16px;">Unable to reach the server. Please try again.</p>`;
  }
}

function emailSummary() {
  const subject = encodeURIComponent('HealthCoach Visit Summary');
  const body = encodeURIComponent('Please find my visit summary attached. Generated via HealthCoach.');
  window.open(`mailto:?subject=${subject}&body=${body}`);
}

function downloadSummary(format) {
  const ts = new Date().toISOString().slice(0, 10);
  const modeLabel = state.chatMode === 'review' ? 'Visit Review' : 'Appointment Prep';
  if (format === 'txt') {
    const summaryText = state.lastSummary || '(No summary generated yet -- click Generate Summary first.)';
    const content = `HealthCoach Summary\n${'='.repeat(40)}\nGenerated: ${new Date().toLocaleString()}\nMode: ${modeLabel}\n\n${summaryText}`;
    downloadFile(`healthcoach-summary-${ts}.txt`, content, 'text/plain');
  } else {
    const data = { generated: new Date().toISOString(), mode: state.chatMode, summary: state.lastSummary || null, messages: state.messages };
    downloadFile(`healthcoach-summary-${ts}.json`, JSON.stringify(data, null, 2), 'application/json');
  }
  showToast('Downloaded!');
}

function downloadFile(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
}
