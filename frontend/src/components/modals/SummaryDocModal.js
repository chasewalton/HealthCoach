import { formatMessage, escapeHtml } from '../../utils/format.js';
import { openModal, closeModal, closeModalOnOverlay } from './modalHelpers.js';
import { t } from '../../i18n.js';

const MODAL_ID = 'modal-summary-doc';

export function render() {
  return `
  <div class="modal-overlay" id="${MODAL_ID}">
    <div class="modal modal--summary-doc">
      <div class="modal-drag"></div>
      <div class="modal-header">
        <div class="modal-title" id="summary-doc-title">${escapeHtml(t('landing.handoff.docModalTitle'))}</div>
        <button class="modal-close" data-close="${MODAL_ID}" aria-label="${escapeHtml(t('landing.handoff.docModalTitle'))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <p class="summary-doc-intro" id="summary-doc-intro">${escapeHtml(t('landing.handoff.docModalIntro'))}</p>
      <div class="summary-doc-body" id="summary-doc-body"></div>
    </div>
  </div>`;
}

export function init() {
  const overlay = document.getElementById(MODAL_ID);
  if (!overlay) return;
  overlay.addEventListener('click', (e) => closeModalOnOverlay(e, MODAL_ID));
  overlay.querySelector(`[data-close="${MODAL_ID}"]`).addEventListener('click', () => closeModal(MODAL_ID));
}

export function open(summaryText) {
  const body = document.getElementById('summary-doc-body');
  const title = document.getElementById('summary-doc-title');
  const intro = document.getElementById('summary-doc-intro');
  if (title) title.textContent = t('landing.handoff.docModalTitle');
  if (intro) intro.textContent = t('landing.handoff.docModalIntro');
  if (body) {
    const text = typeof summaryText === 'string' ? summaryText.trim() : '';
    body.innerHTML = text ? formatMessage(text) : `<p class="summary-doc-empty">${escapeHtml(t('summary.downloadEmpty'))}</p>`;
  }
  openModal(MODAL_ID);
}
