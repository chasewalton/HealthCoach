import { login, loginAnonymously, register } from '../../api/auth.js';
import { t } from '../../i18n.js';
import { escapeHtml } from '../../utils/format.js';

let onOpenHomeLanding = null;

export function setCallbacks(cbs) {
  onOpenHomeLanding = cbs.onOpenHomeLanding || null;
}

export function render() {
  return `
  <div id="screen-auth" class="screen active">
    <div class="auth-blob"></div>
    <div class="auth-blob"></div>
    <div class="auth-card">
      <div class="auth-logo" id="auth-brand-hit" role="button" tabindex="0" aria-label="${escapeHtml(t('app.ariaHome'))}">
        <div class="auth-logo-name">${escapeHtml(t('app.brandHealth'))}<span>${escapeHtml(t('app.brandCoach'))}</span></div>
      </div>
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="signin">${escapeHtml(t('auth.signIn'))}</button>
        <button class="auth-tab" data-tab="register">${escapeHtml(t('auth.register'))}</button>
      </div>
      <form class="auth-form" id="auth-form">
        <div id="auth-error" class="auth-error">${escapeHtml(t('auth.errorDefault'))}</div>
        <div id="field-register-extra" class="hidden">
          <div class="form-group">
            <label class="form-label" for="inp-register-username">${escapeHtml(t('auth.username'))}</label>
            <input class="form-input" id="inp-register-username" type="text" placeholder="${escapeHtml(t('auth.placeholderUsername'))}" autocomplete="username" />
          </div>
          <div class="form-group">
            <label class="form-label" for="inp-displayname">${escapeHtml(t('auth.yourName'))}</label>
            <input class="form-input" id="inp-displayname" type="text" placeholder="${escapeHtml(t('auth.placeholderDisplayName'))}" autocomplete="name" />
          </div>
          <div class="form-group">
            <label class="form-label" for="inp-language">${escapeHtml(t('auth.preferredLanguage'))}</label>
            <select class="form-input" id="inp-language">
              <option value="en">${escapeHtml(t('auth.langEnglish'))}</option>
              <option value="es">${escapeHtml(t('auth.langSpanish'))}</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="inp-email">${escapeHtml(t('auth.email'))}</label>
          <input class="form-input" id="inp-email" type="email" placeholder="${escapeHtml(t('auth.placeholderEmail'))}" autocomplete="email" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="inp-password">${escapeHtml(t('auth.password'))}</label>
          <input class="form-input" id="inp-password" type="password" placeholder="${escapeHtml(t('auth.placeholderPassword'))}" autocomplete="current-password" required />
        </div>
        <button type="submit" class="btn-primary" id="auth-btn">${escapeHtml(t('auth.signIn'))}</button>
      </form>
      <div class="auth-divider"><span>${escapeHtml(t('auth.or'))}</span></div>
      <button type="button" class="btn-guest" id="auth-guest-btn">${escapeHtml(t('auth.continueGuest'))}</button>
    </div>
  </div>`;
}

export function init() {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
  });
  document.getElementById('auth-form').addEventListener('submit', handleAuth);
  document.getElementById('auth-guest-btn').addEventListener('click', handleGuestLogin);
  const brand = document.getElementById('auth-brand-hit');
  if (brand) {
    brand.addEventListener('click', () => {
      if (onOpenHomeLanding) onOpenHomeLanding();
    });
    brand.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (onOpenHomeLanding) onOpenHomeLanding();
      }
    });
  }
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(el =>
    el.classList.toggle('active', el.dataset.tab === tab)
  );
  const registerExtra = document.getElementById('field-register-extra');
  const btn = document.getElementById('auth-btn');
  if (tab === 'register') {
    registerExtra.classList.remove('hidden');
    btn.textContent = t('auth.createAccount');
  } else {
    registerExtra.classList.add('hidden');
    btn.textContent = t('auth.signIn');
  }
  document.getElementById('auth-error').classList.remove('visible');
}

async function handleGuestLogin() {
  const btn = document.getElementById('auth-guest-btn');
  const errEl = document.getElementById('auth-error');
  btn.disabled = true;
  btn.textContent = t('auth.pleaseWait');
  errEl.classList.remove('visible');

  try {
    await loginAnonymously();
  } catch (err) {
    errEl.textContent = err?.message || t('auth.errorGuest');
    errEl.classList.add('visible');
  } finally {
    btn.disabled = false;
    btn.textContent = t('auth.continueGuest');
  }
}

async function handleAuth(e) {
  e.preventDefault();
  const mode = document.querySelector('.auth-tab.active')?.dataset.tab || 'signin';
  const email = document.getElementById('inp-email').value.trim().toLowerCase();
  const password = document.getElementById('inp-password').value;
  const errEl = document.getElementById('auth-error');
  const btn = document.getElementById('auth-btn');

  btn.disabled = true;
  btn.textContent = t('auth.pleaseWait');
  errEl.classList.remove('visible');

  try {
    if (mode === 'register') {
      const username = document.getElementById('inp-register-username').value.trim().toLowerCase();
      if (!username) throw new Error(t('auth.errorUsername'));
      if (!email) throw new Error(t('auth.errorEmail'));
      const displayName = document.getElementById('inp-displayname').value.trim() || username;
      const language = document.getElementById('inp-language').value;
      await register(email, password, displayName, language, username);
    } else {
      if (!email) throw new Error(t('auth.errorEmail'));
      await login(email, password);
    }
  } catch (err) {
    errEl.textContent = err?.message || t('auth.errorConnect');
    errEl.classList.add('visible');
    document.getElementById('inp-password').value = '';
  } finally {
    btn.disabled = false;
    btn.textContent = mode === 'register' ? t('auth.createAccount') : t('auth.signIn');
  }
}
