import state from '../state.js';

export function scrollBottom() {
  const body = document.getElementById('chat-body');
  if (body) {
    requestAnimationFrame(() => {
      body.scrollTop = body.scrollHeight;
    });
  }
}

export function scrollLandingChatBottom() {
  const body = document.getElementById('landing-chat-body');
  if (body) {
    requestAnimationFrame(() => {
      body.scrollTop = body.scrollHeight;
    });
  }
}

export function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.disabled = !el.value.trim();
}

export function getUserInitials() {
  const name = state.profile.name || state.user?.displayName || '';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
}
