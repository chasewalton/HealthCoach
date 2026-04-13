import { login, loginAnonymously, register } from '../../api/auth.js';

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
      <div class="auth-logo" id="auth-brand-hit" role="button" tabindex="0" aria-label="HealthCoach home">
        <div class="auth-logo-name">Health<span>Coach</span></div>
      </div>
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="signin">Sign In</button>
        <button class="auth-tab" data-tab="register">Register</button>
      </div>
      <form class="auth-form" id="auth-form">
        <div id="auth-error" class="auth-error">Incorrect email or password.</div>
        <div id="field-register-extra" class="hidden">
          <div class="form-group">
            <label class="form-label" for="inp-register-username">Username</label>
            <input class="form-input" id="inp-register-username" type="text" placeholder="your.username" autocomplete="username" />
          </div>
          <div class="form-group">
            <label class="form-label" for="inp-displayname">Your Name</label>
            <input class="form-input" id="inp-displayname" type="text" placeholder="How should we address you?" autocomplete="name" />
          </div>
          <div class="form-group">
            <label class="form-label" for="inp-language">Preferred Language</label>
            <select class="form-input" id="inp-language">
              <option value="en">English</option>
              <option value="es">Spanish</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="inp-email">Email</label>
          <input class="form-input" id="inp-email" type="email" placeholder="you@example.com" autocomplete="email" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="inp-password">Password</label>
          <input class="form-input" id="inp-password" type="password" placeholder="••••••••" autocomplete="current-password" required />
        </div>
        <button type="submit" class="btn-primary" id="auth-btn">Sign In</button>
      </form>
      <div class="auth-divider"><span>or</span></div>
      <button type="button" class="btn-guest" id="auth-guest-btn">Continue as Guest</button>
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
  document.querySelectorAll('.auth-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  const registerExtra = document.getElementById('field-register-extra');
  const btn = document.getElementById('auth-btn');
  if (tab === 'register') {
    registerExtra.classList.remove('hidden');
    btn.textContent = 'Create Account';
  } else {
    registerExtra.classList.add('hidden');
    btn.textContent = 'Sign In';
  }
  document.getElementById('auth-error').classList.remove('visible');
}

async function handleGuestLogin() {
  const btn = document.getElementById('auth-guest-btn');
  const errEl = document.getElementById('auth-error');
  btn.disabled = true;
  btn.textContent = 'Please wait...';
  errEl.classList.remove('visible');

  try {
    await loginAnonymously();
  } catch (err) {
    errEl.textContent = err?.message || 'Could not sign in as guest. Please try again.';
    errEl.classList.add('visible');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Continue as Guest';
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
  btn.textContent = 'Please wait...';
  errEl.classList.remove('visible');

  try {
    if (mode === 'register') {
      const username = document.getElementById('inp-register-username').value.trim().toLowerCase();
      if (!username) throw new Error('Please choose a username.');
      if (!email) throw new Error('Please enter your email address.');
      const displayName = document.getElementById('inp-displayname').value.trim() || username;
      const language = document.getElementById('inp-language').value;
      await register(email, password, displayName, language, username);
    } else {
      if (!email) throw new Error('Please enter your email address.');
      await login(email, password);
    }
  } catch (err) {
    errEl.textContent = err?.message || 'Could not connect to the service. Please try again.';
    errEl.classList.add('visible');
    document.getElementById('inp-password').value = '';
  } finally {
    btn.disabled = false;
    btn.textContent = mode === 'register' ? 'Create Account' : 'Sign In';
  }
}
