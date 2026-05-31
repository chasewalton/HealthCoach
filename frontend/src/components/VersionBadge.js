import { VERSION } from '../versionInfo.js';
import { open as openVersionChangelog } from './modals/VersionChangelogModal.js';
import { t } from '../i18n.js';
import { escapeHtml } from '../utils/format.js';

export function render() {
  const aria = t('version.ariaRelease', { version: VERSION });
  return `<button type="button" class="version-badge" id="version-badge-btn" aria-label="${escapeHtml(aria)}">${escapeHtml(VERSION)}</button>`;
}

export function init() {
  const btn = document.getElementById('version-badge-btn');
  if (!btn) return;
  btn.addEventListener('click', () => openVersionChangelog());
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openVersionChangelog();
    }
  });
}
