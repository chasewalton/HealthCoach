import state from '../../state.js';
import { getProfile, updateProfile } from '../../api/profile.js';
import { ApiError } from '../../api/client.js';
import { showToast } from '../Toast.js';
import { openModal, closeModal } from './modalHelpers.js';

const MODAL_ID = 'modal-profile';

export function render() {
  return `
  <div class="modal-overlay" id="${MODAL_ID}">
    <div class="modal" style="max-width:400px">
      <div class="modal-drag"></div>
      <div class="modal-header">
        <div class="modal-title">Profile</div>
        <button class="modal-close" data-close="${MODAL_ID}" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="profile-section">
        <div class="profile-section-title">Your details</div>
        <div class="profile-grid single">
          <div class="form-group">
            <label class="form-label" for="profile-name-input">Display name</label>
            <input class="form-input" id="profile-name-input" type="text" autocomplete="name" maxlength="120" />
          </div>
          <div class="form-group">
            <label class="form-label" for="profile-language-select">Language</label>
            <select class="form-input" id="profile-language-select">
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>
        </div>
      </div>
      <div id="profile-error" class="auth-error" style="margin-bottom:12px;display:none"></div>
      <button type="button" class="btn-primary" id="profile-save-btn">Save</button>
    </div>
  </div>`;
}

function setError(msg) {
  const el = document.getElementById('profile-error');
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.style.display = 'block';
  } else {
    el.textContent = '';
    el.style.display = 'none';
  }
}

async function loadIntoForm() {
  try {
    const data = await getProfile();
    if (data.user) {
      state.user = { ...state.user, ...data.user };
    }
    if (data.profile) {
      state.profile = { ...state.profile, ...data.profile };
    }
  } catch (_) {
    /* use state only */
  }
  const nameIn = document.getElementById('profile-name-input');
  const langSel = document.getElementById('profile-language-select');
  if (!nameIn || !langSel) return;
  const name = state.profile.name || state.user?.displayName || '';
  const lang = state.profile.language === 'es' ? 'es' : 'en';
  nameIn.value = name;
  langSel.value = lang;
}

export function init() {
  const overlay = document.getElementById(MODAL_ID);
  overlay.querySelectorAll(`[data-close="${MODAL_ID}"]`).forEach(btn => {
    btn.addEventListener('click', () => close());
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) close();
  });
  document.getElementById('profile-save-btn').addEventListener('click', save);
}

async function save() {
  setError('');
  const nameIn = document.getElementById('profile-name-input');
  const langSel = document.getElementById('profile-language-select');
  const name = (nameIn?.value || '').trim();
  const language = langSel?.value === 'es' ? 'es' : 'en';
  try {
    const data = await updateProfile({ name, language });
    if (data.user) {
      state.user = { ...state.user, ...data.user };
    } else if (state.user && name) {
      state.user = { ...state.user, displayName: name };
    }
    if (data.profile) {
      state.profile = { ...state.profile, ...data.profile };
    } else {
      state.profile = { ...state.profile, name, language };
    }
    showToast('Profile saved');
    close();
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : 'Could not save profile. Try again.';
    setError(msg);
  }
}

function close() {
  setError('');
  closeModal(MODAL_ID);
}

export async function open() {
  await loadIntoForm();
  openModal(MODAL_ID);
}
