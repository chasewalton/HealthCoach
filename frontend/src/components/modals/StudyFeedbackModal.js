import state from '../../state.js';
import { submitFeedback } from '../../api/feedback.js';
import { formatMessage, escapeHtml } from '../../utils/format.js';
import { openModal, closeModal, closeModalOnOverlay } from './modalHelpers.js';
import { showToast } from '../Toast.js';
import { t } from '../../i18n.js';

const MODAL_ID = 'modal-study-feedback';

let onClose = null;
let noticedErrors = null;

const LIKERT_POINT_KEYS = [
  'study.likertPoint1',
  'study.likertPoint2',
  'study.likertPoint3',
  'study.likertPoint4',
  'study.likertPoint5',
];

function likertFieldHtml(name, legendKey) {
  const legend = escapeHtml(t(legendKey));
  const opts = [1, 2, 3, 4, 5].map((n) => {
    const labelKey = LIKERT_POINT_KEYS[n - 1];
    const labelText = escapeHtml(t(labelKey));
    const aria = escapeHtml(t('study.likertPointAria', { n: String(n), label: t(labelKey) }));
    return `<label class="study-feedback-likert-opt">
      <input type="radio" name="${name}" value="${n}" aria-label="${aria}" />
      <span class="study-feedback-likert-num" aria-hidden="true">${n}</span>
      <span class="study-feedback-likert-label" aria-hidden="true">${labelText}</span>
    </label>`;
  }).join('');
  return `
  <fieldset class="study-feedback-fieldset">
    <legend class="study-feedback-legend">${legend}</legend>
    <div class="study-feedback-likert">
      ${opts}
    </div>
  </fieldset>`;
}

function readLikert(name) {
  const el = document.querySelector(`#${MODAL_ID} input[name="${name}"]:checked`);
  if (!el) return null;
  const v = parseInt(el.value, 10);
  return Number.isFinite(v) && v >= 1 && v <= 5 ? v : null;
}

function updateSubmitEnabled() {
  const btn = document.getElementById('study-feedback-submit');
  if (!btn) return;
  const easy = readLikert('study-likert-easy');
  const useful = readLikert('study-likert-useful');
  const ok = easy != null && useful != null && noticedErrors !== null;
  btn.disabled = !ok;
}

export function setCallbacks(cbs) {
  onClose = cbs.onClose || null;
}

export function render() {
  return `
  <div class="modal-overlay study-feedback-split-overlay" id="${MODAL_ID}">
    <div class="study-feedback-split-wrap" role="dialog" aria-modal="true" aria-labelledby="study-feedback-quick-title study-feedback-summary-title">
      <div class="modal study-feedback-split-panel study-feedback-split-panel--feedback">
        <div class="modal-drag"></div>
        <div class="modal-header">
          <div class="modal-title" id="study-feedback-quick-title">${escapeHtml(t('study.title'))}</div>
          <button type="button" class="modal-close" data-close="${MODAL_ID}" aria-label="${escapeHtml(t('study.closeAria'))}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <p class="study-feedback-desc">${escapeHtml(t('study.intro'))}</p>
        ${likertFieldHtml('study-likert-easy', 'study.qEasy')}
        ${likertFieldHtml('study-likert-useful', 'study.qUseful')}
        <p class="study-feedback-q3" id="study-feedback-q-errors">${escapeHtml(t('study.qErrors'))}</p>
        <div class="study-feedback-options" id="study-feedback-errors-options" role="group" aria-labelledby="study-feedback-q-errors">
          <button type="button" class="study-feedback-btn" data-errors="yes">${escapeHtml(t('study.yes'))}</button>
          <button type="button" class="study-feedback-btn" data-errors="no">${escapeHtml(t('study.no'))}</button>
        </div>
        <div class="study-feedback-details" id="study-feedback-details" style="display:none">
          <label for="study-feedback-text">${escapeHtml(t('study.labelDetail'))}</label>
          <textarea id="study-feedback-text" rows="3" placeholder="${escapeHtml(t('study.placeholderDetail'))}"></textarea>
        </div>
        <button type="button" class="study-feedback-submit" id="study-feedback-submit" disabled>${escapeHtml(t('study.submit'))}</button>
      </div>
      <div class="modal study-feedback-split-panel study-feedback-split-panel--summary">
        <div class="modal-drag" aria-hidden="true"></div>
        <div class="modal-header">
          <div class="modal-title" id="study-feedback-summary-title">${escapeHtml(t('study.summaryTitle'))}</div>
          <button type="button" class="modal-close" data-close="${MODAL_ID}" aria-label="${escapeHtml(t('study.closeAria'))}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="study-feedback-summary-scroll" id="study-feedback-summary-body"></div>
      </div>
    </div>
  </div>`;
}

export function init() {
  const overlay = document.getElementById(MODAL_ID);
  overlay.addEventListener('click', (e) => closeModalOnOverlay(e, MODAL_ID));
  overlay.querySelectorAll(`[data-close="${MODAL_ID}"]`).forEach((btn) => {
    btn.addEventListener('click', handleClose);
  });

  overlay.querySelectorAll('input[type="radio"][name^="study-likert"]').forEach((input) => {
    input.addEventListener('change', updateSubmitEnabled);
  });

  document.getElementById('study-feedback-errors-options').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-errors]');
    if (!btn) return;
    noticedErrors = btn.dataset.errors === 'yes';
    const errBtns = document.querySelectorAll('#study-feedback-errors-options .study-feedback-btn');
    errBtns.forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('study-feedback-details').style.display = noticedErrors ? 'block' : 'none';
    updateSubmitEnabled();
  });

  document.getElementById('study-feedback-submit').addEventListener('click', handleSubmit);
}

export function open() {
  noticedErrors = null;
  const overlay = document.getElementById(MODAL_ID);
  overlay.querySelectorAll('input[type="radio"][name^="study-likert"]').forEach((r) => {
    r.checked = false;
  });
  overlay.querySelectorAll('#study-feedback-errors-options .study-feedback-btn').forEach((b) => b.classList.remove('selected'));
  document.getElementById('study-feedback-details').style.display = 'none';
  document.getElementById('study-feedback-text').value = '';
  updateSubmitEnabled();

  const summaryEl = document.getElementById('study-feedback-summary-body');
  const raw = typeof state.landingFeedbackSummaryMarkdown === 'string' ? state.landingFeedbackSummaryMarkdown.trim() : '';
  if (raw) {
    summaryEl.innerHTML = `<div class="study-feedback-summary-inner">${formatMessage(raw)}</div>`;
  } else {
    summaryEl.innerHTML =
      `<p class="study-feedback-summary-empty">${escapeHtml(t('study.emptySummary'))}</p>`;
  }

  openModal(MODAL_ID);
}

async function handleSubmit() {
  const easy = readLikert('study-likert-easy');
  const useful = readLikert('study-likert-useful');
  if (easy == null || useful == null || noticedErrors === null) return;

  const details = document.getElementById('study-feedback-text').value.trim();
  const payload = {
    type: 'errors',
    summaryEasyToUnderstand: easy,
    summaryUseful: useful,
    noticedErrors: noticedErrors === true,
    details: noticedErrors ? details : '',
    sessionId: state.landingSessionId || null,
  };

  try {
    await submitFeedback(payload);
    showToast(t('study.toastSubmitted'));
    state.landingFeedbackSummaryMarkdown = null;
    closeModal(MODAL_ID);
    if (onClose) onClose();
  } catch {
    showToast(t('study.toastSubmitError'));
  }
}

function handleClose() {
  state.landingFeedbackSummaryMarkdown = null;
  closeModal(MODAL_ID);
  if (onClose) onClose();
}
