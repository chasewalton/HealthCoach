import state from '../../state.js';
import { submitFeedback } from '../../api/feedback.js';
import { escapeHtml } from '../../utils/format.js';
import { openModal, closeModal } from './modalHelpers.js';
import { showToast } from '../Toast.js';
import { t } from '../../i18n.js';

const MODAL_ID = 'modal-pair';

let onComplete = null;

const SCALE_KEYS = ['pair.scale1', 'pair.scale2', 'pair.scale3', 'pair.scale4', 'pair.scale5'];

/**
 * PAIR (Patient AI Rating Tool) items. Each item is a required 1–5 Likert.
 * Some items carry an explanatory note and/or an OPTIONAL free-text comment that
 * is revealed when the rating signals a concern (e.g. low "respectful" score, or
 * any non-zero "harmful" score). `sectionBefore` renders a divider above the item.
 */
const PAIR_ITEMS = [
  { id: 1, key: 'pair.item1' },
  { id: 2, key: 'pair.item2' },
  { id: 3, key: 'pair.item3' },
  { id: 4, key: 'pair.item4', comment: { id: '4a', key: 'pair.item4a', showWhen: (v) => v <= 2 } },
  { id: 5, key: 'pair.item5' },
  { id: 6, key: 'pair.item6', comment: { id: '6a', key: 'pair.item6a', showWhen: (v) => v <= 2 } },
  {
    id: 7,
    key: 'pair.item7',
    note: 'pair.note7',
    comment: { id: '7a', key: 'pair.item7a', showWhen: (v) => v <= 2 },
  },
  {
    id: 8,
    key: 'pair.item8',
    note: 'pair.note8',
    comment: { id: '8a', key: 'pair.item8a', showWhen: (v) => v >= 2 },
  },
  { id: 9, key: 'pair.item9' },
  { id: 10, key: 'pair.item10' },
  { id: 11, key: 'pair.item11' },
  { id: 12, key: 'pair.item12' },
  { id: 13, key: 'pair.item13' },
  { id: 14, key: 'pair.item14', sectionBefore: 'pair.sectionTool' },
  { id: 15, key: 'pair.item15' },
  { id: 16, key: 'pair.item16' },
  { id: 17, key: 'pair.item17' },
];

const COMMENT_ITEMS = PAIR_ITEMS.filter((it) => it.comment);

export function setCallbacks(cbs) {
  onComplete = cbs.onComplete || null;
}

function likertRowHtml(item) {
  const legend = escapeHtml(t(item.key));
  const note = item.note ? `<p class="pair-item-note">${escapeHtml(t(item.note))}</p>` : '';
  const name = `pair-item-${item.id}`;
  const opts = [1, 2, 3, 4, 5]
    .map((n) => {
      const labelText = escapeHtml(t(SCALE_KEYS[n - 1]));
      const aria = escapeHtml(t('pair.scalePointAria', { n: String(n), label: t(SCALE_KEYS[n - 1]) }));
      return `<label class="study-feedback-likert-opt">
        <input type="radio" name="${name}" value="${n}" aria-label="${aria}" />
        <span class="study-feedback-likert-num" aria-hidden="true">${n}</span>
        <span class="study-feedback-likert-label" aria-hidden="true">${labelText}</span>
      </label>`;
    })
    .join('');

  const comment = item.comment
    ? `<div class="pair-comment" id="pair-comment-wrap-${item.comment.id}" hidden>
        <label class="pair-comment-label" for="pair-comment-${item.comment.id}">${escapeHtml(
          t(item.comment.key)
        )}</label>
        <textarea
          class="pair-comment-input"
          id="pair-comment-${item.comment.id}"
          data-comment-id="${item.comment.id}"
          rows="2"
          maxlength="2000"
          placeholder="${escapeHtml(t('pair.commentPlaceholder'))}"
        ></textarea>
      </div>`
    : '';

  const sectionBefore = item.sectionBefore
    ? `<p class="pair-section-divider">${escapeHtml(t(item.sectionBefore))}</p>`
    : '';

  return `${sectionBefore}
    <fieldset class="study-feedback-fieldset pair-item" data-item-id="${item.id}">
      <legend class="study-feedback-legend pair-item-legend"><span class="pair-item-num">${item.id}.</span> ${legend}</legend>
      ${note}
      <div class="study-feedback-likert">${opts}</div>
      ${comment}
    </fieldset>`;
}

export function render() {
  const itemsHtml = PAIR_ITEMS.map(likertRowHtml).join('');
  return `
  <div class="modal-overlay" id="${MODAL_ID}">
    <div class="modal modal--pair" role="dialog" aria-modal="true" aria-labelledby="pair-title">
      <div class="modal-drag"></div>
      <div class="modal-header">
        <div class="modal-title" id="pair-title">${escapeHtml(t('pair.title'))}</div>
        <button type="button" class="modal-close" data-close="${MODAL_ID}" aria-label="${escapeHtml(t('pair.closeAria'))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="pair-scroll" id="pair-scroll">
        <p class="pair-lead">${escapeHtml(t('pair.lead'))}</p>
        <p class="study-feedback-desc">${escapeHtml(t('pair.intro'))}</p>
        <p class="study-feedback-desc pair-instructions">${escapeHtml(t('pair.instructions'))}</p>
        ${itemsHtml}
      </div>
      <div class="pair-footer">
        <p class="pair-required-hint" id="pair-required-hint">${escapeHtml(t('pair.requiredHint'))}</p>
        <button type="button" class="study-feedback-submit pair-submit" id="pair-submit" disabled>${escapeHtml(t('pair.submit'))}</button>
      </div>
    </div>
  </div>`;
}

function readLikert(id) {
  const el = document.querySelector(`#${MODAL_ID} input[name="pair-item-${id}"]:checked`);
  if (!el) return null;
  const v = parseInt(el.value, 10);
  return Number.isFinite(v) && v >= 1 && v <= 5 ? v : null;
}

function allAnswered() {
  return PAIR_ITEMS.every((it) => readLikert(it.id) != null);
}

function updateSubmitEnabled() {
  const btn = document.getElementById('pair-submit');
  const hint = document.getElementById('pair-required-hint');
  if (!btn) return;
  const ok = allAnswered();
  btn.disabled = !ok;
  if (hint) hint.style.visibility = ok ? 'hidden' : 'visible';
}

function syncConditionalComment(item) {
  if (!item.comment) return;
  const wrap = document.getElementById(`pair-comment-wrap-${item.comment.id}`);
  if (!wrap) return;
  const v = readLikert(item.id);
  const show = v != null && item.comment.showWhen(v);
  wrap.hidden = !show;
}

export function init() {
  const overlay = document.getElementById(MODAL_ID);
  if (!overlay) return;

  // Intentionally NOT closing on overlay click: PAIR is required and long, so an
  // accidental backdrop tap should not discard answers. The X returns to chat.
  overlay.querySelectorAll(`[data-close="${MODAL_ID}"]`).forEach((btn) => {
    btn.addEventListener('click', handleClose);
  });

  overlay.querySelectorAll('input[type="radio"][name^="pair-item-"]').forEach((input) => {
    input.addEventListener('change', () => {
      const id = parseInt(input.name.replace('pair-item-', ''), 10);
      const item = PAIR_ITEMS.find((it) => it.id === id);
      if (item) syncConditionalComment(item);
      updateSubmitEnabled();
    });
  });

  document.getElementById('pair-submit').addEventListener('click', handleSubmit);
}

export function open() {
  const overlay = document.getElementById(MODAL_ID);
  if (!overlay) return;
  overlay.querySelectorAll('input[type="radio"][name^="pair-item-"]').forEach((r) => {
    r.checked = false;
  });
  overlay.querySelectorAll('.pair-comment-input').forEach((el) => {
    el.value = '';
  });
  COMMENT_ITEMS.forEach((item) => {
    const wrap = document.getElementById(`pair-comment-wrap-${item.comment.id}`);
    if (wrap) wrap.hidden = true;
  });
  updateSubmitEnabled();
  const scroll = document.getElementById('pair-scroll');
  if (scroll) scroll.scrollTop = 0;
  openModal(MODAL_ID);
}

async function handleSubmit() {
  if (!allAnswered()) return;

  const items = {};
  PAIR_ITEMS.forEach((it) => {
    items[`item${it.id}`] = readLikert(it.id);
  });

  const comments = {};
  COMMENT_ITEMS.forEach((item) => {
    const wrap = document.getElementById(`pair-comment-wrap-${item.comment.id}`);
    const el = document.getElementById(`pair-comment-${item.comment.id}`);
    const visible = wrap && !wrap.hidden;
    comments[`item${item.comment.id}`] = visible && el ? el.value.trim().slice(0, 2000) : '';
  });

  const btn = document.getElementById('pair-submit');
  if (btn) btn.disabled = true;

  try {
    await submitFeedback({
      type: 'pair',
      items,
      comments,
      sessionId: state.landingSessionId || null,
    });
    showToast(t('pair.toastSubmitted'));
    closeModal(MODAL_ID);
    if (onComplete) onComplete();
  } catch {
    showToast(t('pair.toastSubmitError'));
    if (btn) btn.disabled = false;
  }
}

function handleClose() {
  closeModal(MODAL_ID);
}
