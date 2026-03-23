import { authenticateAdmin, saveAdminPrompts } from '../../api/admin.js';
import { ApiError } from '../../api/client.js';
import { showToast } from '../Toast.js';
import { openModal, closeModal, closeModalOnOverlay } from './modalHelpers.js';

const LOGIN_ID = 'modal-admin-login';
const EDITOR_ID = 'modal-admin';

let _adminPassword = '';
let _adminPrompts = {};
let _adminCurrentKey = 'review_guided';

/** Maps backend keys to human-readable context (see `get_system_prompt` / `/api/summary`). */
const PROMPT_META = {
  review_guided: {
    title: 'SOAP review — guided walkthrough',
    lead:
      'System prompt for the structured <strong>Last Visit Review</strong> conversation (SOAP sections, one topic at a time).',
    steps: [
      'Patient is in the full-screen <strong>Last Visit Review</strong> chat (not the landing dashboard).',
      'After the SOAP note step, they choose <strong>Yes, I\'m ready</strong>, then <strong>Walk me through it (guided)</strong>.',
      'Backend: <code>POST /api/chat</code> with <code>mode: "review"</code> and <code>path: "guided"</code>.',
    ],
    placeholders:
      '<code>{literacy}</code>, <code>{language}</code>, <code>{record}</code> (provider notes JSON). Injected when the message is sent.',
  },
  review_specific: {
    title: 'SOAP review — one specific question',
    lead: 'System prompt when the patient wants a single focused answer instead of the full guided tour.',
    steps: [
      'Same <strong>Last Visit Review</strong> flow, but they choose <strong>I have a specific question</strong> after <strong>I\'m ready</strong>.',
      'Backend: <code>POST /api/chat</code> with <code>mode: "review"</code> and <code>path: "specific"</code>.',
    ],
    placeholders:
      '<code>{literacy}</code>, <code>{language}</code>, <code>{record}</code>. Injected at send time.',
  },
  prepare_guided: {
    title: 'Next visit prep — guided walkthrough',
    lead: 'System prompt for the structured <strong>Next Visit Preparation</strong> topics (prep sections in order).',
    steps: [
      'Patient is in the <strong>Next Visit Preparation</strong> chat.',
      'They choose <strong>Yes, I\'m ready</strong>, then <strong>Walk me through it (guided)</strong>.',
      'Backend: <code>POST /api/chat</code> with <code>mode: "prepare"</code> and <code>path: "guided"</code>.',
    ],
    placeholders:
      '<code>{literacy}</code> and <code>{language}</code> only (no <code>{record}</code> in prepare prompts).',
  },
  prepare_specific: {
    title: 'Next visit prep — one specific question',
    lead: 'Focused prep help when the patient picks a single question instead of the guided path.',
    steps: [
      '<strong>Next Visit Preparation</strong> chat: after <strong>I\'m ready</strong>, they choose <strong>I have a specific question</strong>.',
      'Backend: <code>POST /api/chat</code> with <code>mode: "prepare"</code> and <code>path: "specific"</code>.',
    ],
    placeholders: '<code>{literacy}</code> and <code>{language}</code> only.',
  },
  summary_review: {
    title: 'Visit summary — after a review conversation',
    lead: 'System prompt for the <strong>Generate Summary</strong> action when the active chat is a visit review.',
    steps: [
      'User taps <strong>Generate Summary</strong> (or opens the summary flow) while <code>state.chatMode</code> is review.',
      'Backend: <code>POST /api/summary</code> with <code>mode: "review"</code>; the transcript is appended by the server.',
    ],
    placeholders:
      '<code>{literacy}</code> and <code>{language}</code>. Conversation text is added by the API, not in this template.',
  },
  summary_prepare: {
    title: 'Visit summary — after a prep conversation',
    lead: 'Same summary feature, but when the active chat is appointment preparation.',
    steps: [
      'User runs summary from <strong>Next Visit Preparation</strong> (prep mode).',
      'Backend: <code>POST /api/summary</code> with <code>mode: "prepare"</code>.',
    ],
    placeholders:
      '<code>{literacy}</code> and <code>{language}</code>. Transcript appended by the server.',
  },
  combined_guided: {
    title: 'Combined review + prep — guided walkthrough',
    lead: 'System prompt for the <strong>combined flow</strong> that first reviews the last visit then prepares for the next one.',
    steps: [
      'Patient enters the combined flow from the landing page.',
      'Backend: <code>POST /api/chat</code> with <code>mode: "combined"</code> and <code>path: "guided"</code>.',
    ],
    placeholders:
      '<code>{literacy}</code>, <code>{language}</code>, <code>{record}</code> (provider notes JSON).',
  },
  summary_combined: {
    title: 'Visit summary — after a combined conversation',
    lead: 'Summary for the combined review + prep flow.',
    steps: [
      'User taps <strong>Finish &amp; Create Summary</strong> while in combined mode.',
      'Backend: <code>POST /api/summary</code> with <code>mode: "combined"</code>.',
    ],
    placeholders:
      '<code>{literacy}</code> and <code>{language}</code>. Transcript appended by the server.',
  },
};

export function render() {
  return `
  <div class="modal-overlay" id="${LOGIN_ID}">
    <div class="modal" style="max-width:360px">
      <div class="modal-drag"></div>
      <div class="modal-header">
        <div class="modal-title">Admin Access</div>
        <button class="modal-close" data-close="${LOGIN_ID}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="form-group" style="margin-bottom:14px">
        <label class="form-label">Password</label>
        <input class="form-input" id="admin-password-input" type="password" placeholder="Enter admin password" />
      </div>
      <div id="admin-login-error" class="auth-error" style="margin-bottom:12px"></div>
      <button class="btn-primary" id="admin-login-btn">Enter</button>
    </div>
  </div>

  <div class="modal-overlay" id="${EDITOR_ID}">
    <div class="modal modal--admin-editor">
      <div class="modal-drag"></div>
      <div class="modal-header">
        <div class="modal-header-text">
          <div class="modal-title">Prompt editor</div>
          <p class="modal-subtitle admin-prompt-intro">
            Each option matches a backend key: chat prompts use <code>mode</code> + <code>path</code> on <code>/api/chat</code>; summaries use <code>/api/summary</code>. The landing-page dashboard uses a separate default prompt in code (<code>DASHBOARD_PROMPT</code>), not listed here.
          </p>
        </div>
        <button class="modal-close" data-close="${EDITOR_ID}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <label class="form-label" for="admin-prompt-select">Which system prompt</label>
      <select class="admin-prompt-select" id="admin-prompt-select" aria-describedby="admin-prompt-context">
        <optgroup label="Live chat — Last Visit Review">
          <option value="review_guided">Guided walkthrough (visit review, paced)</option>
          <option value="review_specific">One specific question (focused answer)</option>
        </optgroup>
        <optgroup label="Live chat — Next Visit Preparation">
          <option value="prepare_guided">Guided walkthrough (prep topics)</option>
          <option value="prepare_specific">One specific question (focused prep)</option>
        </optgroup>
        <optgroup label="Live chat — Combined Review + Prep">
          <option value="combined_guided">Guided walkthrough (review then prep)</option>
        </optgroup>
        <optgroup label="Generated summary (not live chat)">
          <option value="summary_review">After a review-mode conversation</option>
          <option value="summary_prepare">After a prep-mode conversation</option>
          <option value="summary_combined">After a combined conversation</option>
        </optgroup>
      </select>

      <div class="admin-prompt-context" id="admin-prompt-context" aria-live="polite"></div>

      <label class="form-label admin-prompt-textarea-label" for="admin-prompt-textarea">Prompt text</label>
      <textarea class="admin-prompt-area" id="admin-prompt-textarea" spellcheck="false" rows="18"></textarea>

      <div class="admin-hint" id="admin-hint-text"></div>
      <div class="admin-actions">
        <button class="btn-primary" style="flex:2;margin-top:0" id="admin-save-btn">Save changes</button>
        <button class="btn-outline" style="flex:1;margin-top:0" id="admin-reset-btn">Reset to default</button>
      </div>
    </div>
  </div>`;
}

export function init() {
  const loginOverlay = document.getElementById(LOGIN_ID);
  loginOverlay.addEventListener('click', (e) => closeModalOnOverlay(e, LOGIN_ID));
  loginOverlay.querySelector(`[data-close="${LOGIN_ID}"]`).addEventListener('click', () => closeModal(LOGIN_ID));

  const editorOverlay = document.getElementById(EDITOR_ID);
  editorOverlay.addEventListener('click', (e) => closeModalOnOverlay(e, EDITOR_ID));
  editorOverlay.querySelector(`[data-close="${EDITOR_ID}"]`).addEventListener('click', () => closeModal(EDITOR_ID));

  document.getElementById('admin-login-btn').addEventListener('click', checkPassword);
  document.getElementById('admin-password-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkPassword();
  });

  document.getElementById('admin-prompt-select').addEventListener('change', (e) => {
    switchPrompt(e.target.value);
  });
  document.getElementById('admin-save-btn').addEventListener('click', savePrompt);
  document.getElementById('admin-reset-btn').addEventListener('click', resetPrompt);
}

export function openLogin() {
  document.getElementById('admin-password-input').value = '';
  document.getElementById('admin-login-error').textContent = '';
  document.getElementById('admin-login-error').classList.remove('visible');
  openModal(LOGIN_ID);
  setTimeout(() => document.getElementById('admin-password-input').focus(), 100);
}

async function checkPassword() {
  const pw = document.getElementById('admin-password-input').value;
  const errEl = document.getElementById('admin-login-error');
  errEl.classList.remove('visible');
  try {
    const data = await authenticateAdmin(pw);
    _adminPassword = pw;
    _adminPrompts = data.prompts;
    closeModal(LOGIN_ID);
    openEditor();
  } catch (err) {
    errEl.textContent = (err instanceof ApiError) ? err.message : 'Could not connect to server.';
    errEl.classList.add('visible');
  }
}

function setContextHtml(key) {
  const container = document.getElementById('admin-prompt-context');
  if (!container) return;
  const meta = PROMPT_META[key];
  if (!meta) return;
  const steps = meta.steps.map((s) => `<li>${s}</li>`).join('');
  container.innerHTML = `
    <div class="admin-prompt-context-title">${meta.title}</div>
    <p class="admin-prompt-context-lead">${meta.lead}</p>
    <p class="admin-prompt-context-label">When this prompt is used</p>
    <ul class="admin-prompt-context-list">${steps}</ul>
  `;
}

function updateHint(key) {
  const meta = PROMPT_META[key];
  const hintEl = document.getElementById('admin-hint-text');
  hintEl.innerHTML = meta
    ? `<span class="admin-hint-label">Placeholders</span> ${meta.placeholders}`
    : '';
}

function openEditor() {
  _adminCurrentKey = 'review_guided';
  const sel = document.getElementById('admin-prompt-select');
  sel.value = _adminCurrentKey;
  setContextHtml(_adminCurrentKey);
  updateHint(_adminCurrentKey);
  document.getElementById('admin-prompt-textarea').value = _adminPrompts[_adminCurrentKey] || '';
  openModal(EDITOR_ID);
}

function switchPrompt(key) {
  _adminPrompts[_adminCurrentKey] = document.getElementById('admin-prompt-textarea').value;
  _adminCurrentKey = key;
  document.getElementById('admin-prompt-textarea').value = _adminPrompts[key] || '';
  setContextHtml(key);
  updateHint(key);
}

async function savePrompt() {
  _adminPrompts[_adminCurrentKey] = document.getElementById('admin-prompt-textarea').value;
  try {
    await saveAdminPrompts(_adminPassword, _adminPrompts);
    showToast('Prompts saved');
  } catch (_) {
    showToast('Could not save -- check connection.');
  }
}

async function resetPrompt() {
  const label = PROMPT_META[_adminCurrentKey]?.title || _adminCurrentKey;
  if (!confirm(`Reset "${label}" to the built-in default? This cannot be undone.`)) return;
  _adminPrompts[_adminCurrentKey] = '';
  try {
    await saveAdminPrompts(_adminPassword, { [_adminCurrentKey]: '' });
    const data = await authenticateAdmin(_adminPassword);
    _adminPrompts = data.prompts;
    document.getElementById('admin-prompt-textarea').value = _adminPrompts[_adminCurrentKey] || '';
    showToast('Reset to default');
  } catch (_) {
    showToast('Could not reset -- check connection.');
  }
}
