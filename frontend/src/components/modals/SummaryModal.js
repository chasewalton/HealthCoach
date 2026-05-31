import state from '../../state.js';
import { generateSummary } from '../../api/chat.js';
import { submitFeedback } from '../../api/feedback.js';
import { formatMessage, escapeHtml } from '../../utils/format.js';
import { showToast } from '../Toast.js';
import { openModal, closeModal, closeModalOnOverlay } from './modalHelpers.js';
import { t, dateLocale } from '../../i18n.js';

const MODAL_ID = 'modal-summary';

const SUMMARY_SHARE_KEYS = ['provider', 'self', 'caretaker', 'other'];

function summaryModeLabel() {
  return state.chatMode === 'review' ? t('summary.modeReview') : t('summary.modePrep');
}

function formatSummaryTs() {
  return new Date().toLocaleString(dateLocale(), { dateStyle: 'medium', timeStyle: 'short' });
}

export function render() {
  return `
  <div class="modal-overlay" id="${MODAL_ID}">
    <div class="modal">
      <div class="modal-drag"></div>
      <div class="modal-header">
        <div class="modal-title">${escapeHtml(t('summary.title'))}</div>
        <button class="modal-close" data-close="${MODAL_ID}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div id="summary-content"></div>
      <div class="summary-actions">
        <button class="btn-outline" id="summary-email-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          ${escapeHtml(t('summary.btnEmail'))}
        </button>
        <button class="btn-outline" id="summary-dl-txt-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          ${escapeHtml(t('summary.btnDownloadTxt'))}
        </button>
        <button class="btn-outline" id="summary-dl-json-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          ${escapeHtml(t('summary.btnDownloadJson'))}
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
  const modeLabel = summaryModeLabel();

  content.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:32px 16px;color:var(--neutral-500);">
      <div class="typing-indicator" style="display:inline-flex;">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
      <div style="font-size:calc(14px * var(--type-scale));">${escapeHtml(t('summary.generating'))}</div>
    </div>
  `;
  openModal(MODAL_ID);

  const history = state.messages.map(m => ({ role: m.role, content: m.content }));

  try {
    const data = await generateSummary(history, state.chatMode);
    if (!data.summary) {
      content.innerHTML = `<p style="color:var(--coral-500);padding:16px;">${escapeHtml(t('summary.errorGenerate'))}</p>`;
      return;
    }
    state.lastSummary = data.summary;
    const ts = formatSummaryTs();
    content.innerHTML = `
      <div style="font-size:calc(12px * var(--type-scale));color:var(--neutral-400);margin-bottom:20px;">
        ${escapeHtml(t('summary.generatedMeta', { ts, mode: modeLabel }))}
      </div>
      <div style="font-size:calc(15px * var(--type-scale));line-height:1.7;color:var(--color-text);">
        ${formatMessage(data.summary)}
      </div>
      <div style="background:var(--teal-50);border-radius:var(--radius-md);padding:12px 16px;margin-top:20px;font-size:calc(13px * var(--type-scale));color:var(--teal-700);line-height:1.5;">
        ${escapeHtml(t('summary.callout'))}
      </div>
      <div class="summary-section summary-share-intent" id="summary-share-intent">
        <div class="summary-section-title">${escapeHtml(t('summary.shareSectionTitle'))}</div>
        <p class="summary-share-intent-desc">${escapeHtml(t('summary.shareSectionDesc'))}</p>
        <div class="summary-share-intent-rows">
          <div class="summary-share-intent-row">
            <label class="summary-share-intent-label">
              <input type="checkbox" id="summary-share-provider" class="summary-share-checkbox" />
              <span>${escapeHtml(t('summary.shareProvider'))}</span>
            </label>
            <div class="summary-share-field-wrap" id="summary-share-provider-wrap" hidden>
              <label class="sr-only" for="summary-share-provider-input">${escapeHtml(t('summary.srProviderContact'))}</label>
              <input type="text" id="summary-share-provider-input" class="summary-share-input" placeholder="${escapeHtml(t('summary.phProviderContact'))}" autocomplete="off" />
            </div>
          </div>
          <div class="summary-share-intent-row">
            <label class="summary-share-intent-label">
              <input type="checkbox" id="summary-share-self" class="summary-share-checkbox" />
              <span>${escapeHtml(t('summary.shareSelf'))}</span>
            </label>
            <div class="summary-share-field-wrap" id="summary-share-self-wrap" hidden>
              <label class="sr-only" for="summary-share-self-input">${escapeHtml(t('summary.srSelfContact'))}</label>
              <input type="text" id="summary-share-self-input" class="summary-share-input" placeholder="${escapeHtml(t('summary.phSelfContact'))}" autocomplete="email" />
            </div>
          </div>
          <div class="summary-share-intent-row">
            <label class="summary-share-intent-label">
              <input type="checkbox" id="summary-share-caretaker" class="summary-share-checkbox" />
              <span>${escapeHtml(t('summary.shareCaretaker'))}</span>
            </label>
            <div class="summary-share-field-wrap" id="summary-share-caretaker-wrap" hidden>
              <label class="sr-only" for="summary-share-caretaker-input">${escapeHtml(t('summary.srCaretakerContact'))}</label>
              <input type="text" id="summary-share-caretaker-input" class="summary-share-input" placeholder="${escapeHtml(t('summary.phCaretakerContact'))}" autocomplete="off" />
            </div>
          </div>
          <div class="summary-share-intent-row">
            <label class="summary-share-intent-label">
              <input type="checkbox" id="summary-share-other" class="summary-share-checkbox" />
              <span>${escapeHtml(t('summary.shareOther'))}</span>
            </label>
            <div class="summary-share-field-wrap" id="summary-share-other-wrap" hidden>
              <label class="sr-only" for="summary-share-other-input">${escapeHtml(t('summary.srOtherContact'))}</label>
              <input type="text" id="summary-share-other-input" class="summary-share-input" placeholder="${escapeHtml(t('summary.phOtherContact'))}" autocomplete="off" />
            </div>
          </div>
        </div>
        <button type="button" class="btn-outline summary-share-submit" id="summary-share-submit">${escapeHtml(t('summary.saveChoices'))}</button>
        <p class="summary-share-saved" id="summary-share-saved" hidden>${escapeHtml(t('summary.savedThanks'))}</p>
      </div>
    `;
    initSummaryShareForm(content);
  } catch (_) {
    content.innerHTML = `<p style="color:var(--coral-500);padding:16px;">${escapeHtml(t('summary.errorServer'))}</p>`;
  }
}

function emailSummary() {
  const subject = encodeURIComponent(t('summary.emailSubject'));
  const body = encodeURIComponent(t('summary.emailBody'));
  window.open(`mailto:?subject=${subject}&body=${body}`);
}

function downloadSummary(format) {
  const ts = new Date().toISOString().slice(0, 10);
  const modeLabel = summaryModeLabel();
  if (format === 'txt') {
    const summaryText = state.lastSummary || t('summary.downloadEmpty');
    const content = `${t('summary.downloadTxtHeader')}\n${'='.repeat(40)}\n${t('summary.downloadGenerated')} ${formatSummaryTs()}\n${t('summary.downloadMode')} ${modeLabel}\n\n${summaryText}`;
    downloadFile(`healthcoach-summary-${ts}.txt`, content, 'text/plain');
  } else {
    const data = { generated: new Date().toISOString(), mode: state.chatMode, summary: state.lastSummary || null, messages: state.messages };
    downloadFile(`healthcoach-summary-${ts}.json`, JSON.stringify(data, null, 2), 'application/json');
  }
  showToast(t('summary.downloaded'));
}

function downloadFile(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
}

function initSummaryShareForm(root) {
  const intent = root.querySelector('#summary-share-intent');
  if (!intent) return;

  SUMMARY_SHARE_KEYS.forEach((key) => {
    const cb = intent.querySelector(`#summary-share-${key}`);
    const wrap = intent.querySelector(`#summary-share-${key}-wrap`);
    const input = intent.querySelector(`#summary-share-${key}-input`);
    if (!cb || !wrap || !input) return;
    const sync = () => {
      wrap.hidden = !cb.checked;
      if (!cb.checked) input.value = '';
    };
    cb.addEventListener('change', sync);
    sync();
  });

  const btn = intent.querySelector('#summary-share-submit');
  const saved = intent.querySelector('#summary-share-saved');
  if (btn) {
    btn.addEventListener('click', () => {
      void handleSummaryShareSubmit(intent, btn, saved);
    });
  }
}

function readSummaryShareRecipients(intentEl) {
  const out = {};
  SUMMARY_SHARE_KEYS.forEach((key) => {
    const cb = intentEl.querySelector(`#summary-share-${key}`);
    const input = intentEl.querySelector(`#summary-share-${key}-input`);
    out[key] = {
      selected: !!(cb && cb.checked),
      contact: input ? input.value.trim() : '',
    };
  });
  return out;
}

async function handleSummaryShareSubmit(intentEl, submitBtn, savedEl) {
  if (intentEl.dataset.submitted === 'true') return;

  const summaryShareIntent = readSummaryShareRecipients(intentEl);
  const rows = Object.values(summaryShareIntent);
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].selected && !rows[i].contact) {
      showToast(t('summary.shareNeedEach'));
      return;
    }
  }

  submitBtn.disabled = true;
  try {
    await submitFeedback({
      type: 'summary_share_intent',
      sessionId: state.currentSessionId || state.landingSessionId || null,
      chatMode: state.chatMode || null,
      summaryShareIntent,
    });
    intentEl.dataset.submitted = 'true';
    if (savedEl) savedEl.hidden = false;
    showToast(t('summary.shareThanks'));
  } catch (_) {
    showToast(t('summary.shareError'));
    submitBtn.disabled = false;
  }
}
