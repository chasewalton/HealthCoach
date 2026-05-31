import state from '../../state.js';
import { showToast } from '../Toast.js';
import { openModal, closeModal, closeModalOnOverlay } from './modalHelpers.js';
import { downloadAsTxt, downloadAsPdf, downloadAsDocx, getPlainTextPreview } from '../../utils/exportChat.js';
import { t } from '../../i18n.js';
import { escapeHtml } from '../../utils/format.js';

const MODAL_ID = 'modal-landing-share';

const FORMAT_IDS = ['pdf', 'txt', 'docx'];
const METHOD_IDS = ['email', 'sms'];
const RECIPIENT_IDS = ['provider', 'caretaker', 'family', 'other'];

function formatLabel(id) {
  if (id === 'pdf') return t('landingShare.fmtPdf');
  if (id === 'txt') return t('landingShare.fmtText');
  return t('landingShare.fmtWord');
}

function methodLabel(id) {
  return id === 'email' ? t('landingShare.methodEmail') : t('landingShare.methodSms');
}

function recipientLabel(id) {
  if (id === 'provider') return t('landingShare.recipProvider');
  if (id === 'caretaker') return t('landingShare.recipCaretaker');
  if (id === 'family') return t('landingShare.recipFamily');
  return t('landingShare.recipOther');
}

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
        <div class="modal-title">${escapeHtml(t('landingShare.title'))}</div>
        <button class="modal-close" data-close="${MODAL_ID}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="ls-section">
        <div class="ls-section-label">${escapeHtml(t('landingShare.format'))}</div>
        <div class="ls-btn-group" id="ls-format-group">
          ${FORMAT_IDS.map(f => `
            <button type="button" class="ls-toggle-btn${f === selectedFormat ? ' active' : ''}" data-format="${f}">
              <span class="ls-toggle-icon">${svgForFormat(f)}</span>
              ${escapeHtml(formatLabel(f))}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="ls-section">
        <div class="ls-section-label">${escapeHtml(t('landingShare.sendVia'))}</div>
        <div class="ls-btn-group" id="ls-method-group">
          ${METHOD_IDS.map(m => `
            <button type="button" class="ls-toggle-btn${m === selectedMethod ? ' active' : ''}" data-method="${m}">
              <span class="ls-toggle-icon">${svgForMethod(m)}</span>
              ${escapeHtml(methodLabel(m))}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="ls-section">
        <div class="ls-section-label">${escapeHtml(t('landingShare.recipient'))}</div>
        <div class="ls-chip-group" id="ls-recipient-group">
          ${RECIPIENT_IDS.map(r => `
            <button type="button" class="ls-chip${r === selectedRecipient ? ' active' : ''}" data-recipient="${r}">${escapeHtml(recipientLabel(r))}</button>
          `).join('')}
        </div>
      </div>

      <div class="ls-section">
        <div class="ls-section-label" id="ls-contact-label">${escapeHtml(t('landingShare.email'))}</div>
        <input type="text" class="ls-contact-input" id="ls-contact-input" placeholder="${escapeHtml(t('landingShare.phEmail'))}" autocomplete="off" />
      </div>

      <button type="button" class="ls-submit-btn" id="ls-submit-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        ${escapeHtml(t('landingShare.share'))}
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
    label.textContent = t('landingShare.email');
    input.placeholder = t('landingShare.phEmail');
    input.type = 'email';
  } else {
    label.textContent = t('landingShare.phone');
    input.placeholder = t('landingShare.phPhone');
    input.type = 'tel';
  }
}

function getRecipientLabel() {
  return recipientLabel(selectedRecipient);
}

async function handleSubmit() {
  const contact = document.getElementById('ls-contact-input').value.trim();
  if (!contact) {
    showToast(selectedMethod === 'email' ? t('landingShare.toastEmail') : t('landingShare.toastPhone'));
    document.getElementById('ls-contact-input').focus();
    return;
  }

  const messages = state.landingMessages;
  if (!messages.length) {
    showToast(t('landingShare.toastNone'));
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
  const subject = encodeURIComponent(t('landingShare.emailSubject'));

  if (selectedMethod === 'email') {
    const body = encodeURIComponent(
      t('landingShare.emailBodyIntro', { format: selectedFormat.toUpperCase() }) + preview.slice(0, 1500)
    );
    window.open(`mailto:${encodeURIComponent(contact)}?subject=${subject}&body=${body}`, '_self');
  } else {
    const smsBody = encodeURIComponent(
      t('landingShare.smsBodyIntro') + preview.slice(0, 600)
    );
    window.open(`sms:${encodeURIComponent(contact)}?body=${smsBody}`, '_self');
  }

  showToast(t('landingShare.toastDownloaded'));
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
