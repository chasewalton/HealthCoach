import { VERSION } from '../versionInfo.js';
import { open as openVersionChangelog } from './modals/VersionChangelogModal.js';

export function render() {
  return `<button type="button" class="version-badge" id="version-badge-btn" aria-label="Open release notes (${VERSION})">${VERSION}</button>`;
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
