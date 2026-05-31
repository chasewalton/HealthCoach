import state from '../../state.js';
import { t } from '../../i18n.js';
import { escapeHtml } from '../../utils/format.js';

let onBack = null;
let onSignIn = null;
let onGoDashboard = null;

export function setCallbacks(cbs) {
  onBack = cbs.onBack;
  onSignIn = cbs.onSignIn;
  onGoDashboard = cbs.onGoDashboard;
}

/** Sync CTAs with session (call before showScreen('home')). */
export function refresh() {
  const signIn = document.getElementById('home-cta-signin');
  const dash = document.getElementById('home-cta-dashboard');
  if (!signIn || !dash) return;
  const loggedIn = !!state.user;
  signIn.hidden = loggedIn;
  dash.hidden = !loggedIn;
}

export function render() {
  return `
  <div id="screen-home" class="screen">
    <header class="home-landing-top">
      <button type="button" class="home-landing-back" id="home-landing-back-btn" aria-label="${escapeHtml(t('home.backAria'))}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
        <span>${escapeHtml(t('home.back'))}</span>
      </button>
    </header>

    <main class="home-landing-main">
      <section class="home-landing-hero" aria-labelledby="home-landing-title">
        <p class="home-landing-kicker">${escapeHtml(t('home.kicker'))}</p>
        <h1 id="home-landing-title" class="home-landing-title">
          ${escapeHtml(t('app.brandHealth'))}<span class="home-landing-title-accent">${escapeHtml(t('app.brandCoach'))}</span>
        </h1>
        <p class="home-landing-lead">
          ${escapeHtml(t('home.lead'))}
        </p>
      </section>

      <section class="home-landing-features" aria-labelledby="home-features-heading">
        <h2 id="home-features-heading" class="home-landing-visually-hidden">${escapeHtml(t('home.featuresHeading'))}</h2>
        <ul class="home-landing-feature-list">
          <li class="home-landing-feature">
            <div class="home-landing-feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
            </div>
            <h3 class="home-landing-feature-title">${escapeHtml(t('home.feature1Title'))}</h3>
            <p class="home-landing-feature-text">${escapeHtml(t('home.feature1Text'))}</p>
          </li>
          <li class="home-landing-feature">
            <div class="home-landing-feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <h3 class="home-landing-feature-title">${escapeHtml(t('home.feature2Title'))}</h3>
            <p class="home-landing-feature-text">${escapeHtml(t('home.feature2Text'))}</p>
          </li>
          <li class="home-landing-feature">
            <div class="home-landing-feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 class="home-landing-feature-title">${escapeHtml(t('home.feature3Title'))}</h3>
            <p class="home-landing-feature-text">${escapeHtml(t('home.feature3Text'))}</p>
          </li>
        </ul>
      </section>

      <div class="home-landing-actions">
        <button type="button" class="home-landing-btn home-landing-btn--primary" id="home-cta-signin">${escapeHtml(t('home.signIn'))}</button>
        <button type="button" class="home-landing-btn home-landing-btn--secondary" id="home-cta-dashboard">${escapeHtml(t('home.goDashboard'))}</button>
      </div>

      <p class="home-landing-disclaimer">
        ${escapeHtml(t('home.disclaimer'))}
      </p>
    </main>
  </div>`;
}

export function init() {
  document.getElementById('home-landing-back-btn').addEventListener('click', () => {
    if (onBack) onBack();
  });
  document.getElementById('home-cta-signin').addEventListener('click', () => {
    if (onSignIn) onSignIn();
  });
  document.getElementById('home-cta-dashboard').addEventListener('click', () => {
    if (onGoDashboard) onGoDashboard();
  });
}
