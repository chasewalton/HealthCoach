import { VERSION, CHANGELOG } from '../../versionInfo.js';
import { openModal, closeModal, closeModalOnOverlay } from './modalHelpers.js';

const MODAL_ID = 'modal-version-changelog';

const ADMIN_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

let onOpenAdminLogin = null;

export function setCallbacks(cbs) {
  onOpenAdminLogin = cbs.onOpenAdminLogin;
}

function buildChangelogHtml() {
  return CHANGELOG.map((entry) => {
    const dateLine = entry.date
      ? `<div class="version-changelog-date">${entry.date}</div>`
      : '';
    const items = entry.changes.map((c) => `<li>${c}</li>`).join('');
    return `
      <article class="version-changelog-block" aria-labelledby="changelog-${entry.version.replace(/\./g, '-')}">
        <h3 class="version-changelog-version" id="changelog-${entry.version.replace(/\./g, '-')}">${entry.version}</h3>
        ${dateLine}
        <ul class="version-changelog-list">${items}</ul>
      </article>`;
  }).join('');
}

export function render() {
  return `
  <div class="modal-overlay" id="${MODAL_ID}">
    <div class="modal modal--version-changelog">
      <div class="modal-drag"></div>
      <div class="modal-header version-changelog-header">
        <div class="modal-header-text">
          <div class="modal-title">Release notes</div>
          <p class="modal-subtitle version-changelog-subtitle">You are on <strong>${VERSION}</strong></p>
        </div>
        <div class="version-changelog-header-end">
          <button type="button" class="btn-outline version-changelog-admin-btn" id="version-changelog-admin-btn" title="Admin Access">
            ${ADMIN_ICON_SVG}
            <span>Admin Access</span>
          </button>
          <button type="button" class="modal-close" data-close="${MODAL_ID}" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="version-changelog-body" id="version-changelog-body"></div>
    </div>
  </div>`;
}

export function init() {
  const overlay = document.getElementById(MODAL_ID);
  if (!overlay) return;
  overlay.addEventListener('click', (e) => closeModalOnOverlay(e, MODAL_ID));
  overlay.querySelector(`[data-close="${MODAL_ID}"]`).addEventListener('click', () => closeModal(MODAL_ID));

  document.getElementById('version-changelog-admin-btn').addEventListener('click', () => {
    closeModal(MODAL_ID);
    if (onOpenAdminLogin) onOpenAdminLogin();
  });

  const body = document.getElementById('version-changelog-body');
  if (body) body.innerHTML = buildChangelogHtml();
}

export function open() {
  openModal(MODAL_ID);
}
