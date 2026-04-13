import state from '../../state.js';
import { showToast } from '../Toast.js';
import { openModal, closeModal, closeModalOnOverlay } from './modalHelpers.js';
import { downloadAsTxt, downloadAsPdf, downloadAsDocx, getPlainTextPreview } from '../../utils/exportChat.js';

const MODAL_ID = 'modal-landing-share';

const FORMATS = [
  { id: 'pdf',  label: 'PDF',  icon: 'pdf' },
  { id: 'txt',  label: 'Text', icon: 'txt' },
  { id: 'docx', label: 'Word', icon: 'docx' },
];

const METHODS = [
  { id: 'email', label: 'Email',        icon: 'email' },
  { id: 'sms',   label: 'Text Message', icon: 'sms' },
];

const RECIPIENTS = [
  { id: 'provider',  label: 'Provider' },
  { id: 'caretaker', label: 'Caretaker' },
  { id: 'family',    label: 'Family' },
  { id: 'other',     label: 'Other' },
];

function svgForFormat(type) {
  if (type === 'pdf') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
  if (type === 'txt') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>';
}

function svgForMethod(type) {
  if (type === 'email') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
}

let selectedFormat = 'pdf';
let selectedMethod = 'email';
let selectedRecipient = 'provider';

export function render() {
  return `
  <div class="modal-overlay" id="${MODAL_ID}">
    <div class="modal modal--landing-share">
      <div class="modal-drag"></div>
      <div class="modal-header">
        <div class="modal-title">Share Conversation</div>
        <button class="modal-close" data-close="${MODAL_ID}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="ls-section">
        <div class="ls-section-label">Format</div>
        <div class="ls-btn-group" id="ls-format-group">
          ${FORMATS.map(f => `
            <button type="button" class="ls-toggle-btn${f.id === selectedFormat ? ' active' : ''}" data-format="${f.id}">
              <span class="ls-toggle-icon">${svgForFormat(f.icon)}</span>
              ${f.label}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="ls-section">
        <div class="ls-section-label">Send via</div>
        <div class="ls-btn-group" id="ls-method-group">
          ${METHODS.map(m => `
            <button type="button" class="ls-toggle-btn${m.id === selectedMethod ? ' active' : ''}" data-method="${m.id}">
              <span class="ls-toggle-icon">${svgForMethod(m.icon)}</span>
              ${m.label}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="ls-section">
        <div class="ls-section-label">Recipient</div>
        <div class="ls-chip-group" id="ls-recipient-group">
          ${RECIPIENTS.map(r => `
            <button type="button" class="ls-chip${r.id === selectedRecipient ? ' active' : ''}" data-recipient="${r.id}">${r.label}</button>
          `).join('')}
        </div>
      </div>

      <div class="ls-section">
        <div class="ls-section-label" id="ls-contact-label">Email address</div>
        <input type="text" class="ls-contact-input" id="ls-contact-input" placeholder="recipient@email.com" autocomplete="off" />
      </div>

      <button type="button" class="ls-submit-btn" id="ls-submit-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Share
      </button>
    </div>
  </div>`;
}

function syncUI() {
  const overlay = document.getElementById(MODAL_ID);
  if (!overlay) return;

  overlay.querySelectorAll('#ls-format-group .ls-toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.format === selectedFormat);
  });
  overlay.querySelectorAll('#ls-method-group .ls-toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.method === selectedMethod);
  });
  overlay.querySelectorAll('#ls-recipient-group .ls-chip').forEach(b => {
    b.classList.toggle('active', b.dataset.recipient === selectedRecipient);
  });

  const label = document.getElementById('ls-contact-label');
  const input = document.getElementById('ls-contact-input');
  if (selectedMethod === 'email') {
    label.textContent = 'Email address';
    input.placeholder = 'recipient@email.com';
    input.type = 'email';
  } else {
    label.textContent = 'Phone number';
    input.placeholder = '+1 (555) 000-0000';
    input.type = 'tel';
  }
}

function getRecipientLabel() {
  const r = RECIPIENTS.find(x => x.id === selectedRecipient);
  return r ? r.label : '';
}

async function handleSubmit() {
  const contact = document.getElementById('ls-contact-input').value.trim();
  if (!contact) {
    showToast(selectedMethod === 'email' ? 'Please enter an email address.' : 'Please enter a phone number.');
    document.getElementById('ls-contact-input').focus();
    return;
  }

  const messages = state.landingMessages;
  if (!messages.length) {
    showToast('No conversation to share yet.');
    return;
  }

  const metadata = { recipientLabel: getRecipientLabel() };

  if (selectedFormat === 'txt') {
    downloadAsTxt(messages, metadata);
  } else if (selectedFormat === 'pdf') {
    downloadAsPdf(messages, metadata);
  } else {
    await downloadAsDocx(messages, metadata);
  }

  const preview = getPlainTextPreview(messages);
  const subject = encodeURIComponent('HealthCoach Conversation');

  if (selectedMethod === 'email') {
    const body = encodeURIComponent(
      `Hi,\n\nPlease find the attached HealthCoach conversation (${selectedFormat.toUpperCase()} file downloaded separately).\n\n---\n${preview.slice(0, 1500)}`
    );
    window.open(`mailto:${encodeURIComponent(contact)}?subject=${subject}&body=${body}`, '_self');
  } else {
    const smsBody = encodeURIComponent(
      `HealthCoach Conversation Summary:\n\n${preview.slice(0, 600)}`
    );
    window.open(`sms:${encodeURIComponent(contact)}?body=${smsBody}`, '_self');
  }

  showToast('File downloaded — opening your app to share.');
  closeModal(MODAL_ID);
}

export function init() {
  const overlay = document.getElementById(MODAL_ID);
  overlay.addEventListener('click', (e) => closeModalOnOverlay(e, MODAL_ID));
  overlay.querySelector(`[data-close="${MODAL_ID}"]`).addEventListener('click', () => closeModal(MODAL_ID));

  document.getElementById('ls-format-group').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-format]');
    if (!btn) return;
    selectedFormat = btn.dataset.format;
    syncUI();
  });

  document.getElementById('ls-method-group').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-method]');
    if (!btn) return;
    selectedMethod = btn.dataset.method;
    syncUI();
  });

  document.getElementById('ls-recipient-group').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-recipient]');
    if (!btn) return;
    selectedRecipient = btn.dataset.recipient;
    syncUI();
  });

  document.getElementById('ls-submit-btn').addEventListener('click', handleSubmit);
}

export function open() {
  document.getElementById('ls-contact-input').value = '';
  syncUI();
  openModal(MODAL_ID);
}
