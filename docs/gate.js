(function() {
  var HASH = 'ca3aa228a751cc844e6c8232d0cf45552afecd910ef1769b44b67bccc2f88ff0';
  var KEY = 'hc_cuj_authed';

  if (sessionStorage.getItem(KEY) === '1') return;

  async function sha256(text) {
    var data = new TextEncoder().encode(text);
    var buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  document.documentElement.style.display = 'none';

  var overlay = document.createElement('div');
  overlay.id = 'pw-gate';
  overlay.innerHTML =
    '<div style="position:fixed;inset:0;z-index:99999;background:#FAFAF9;display:flex;align-items:center;justify-content:center;font-family:\'Plus Jakarta Sans\',-apple-system,BlinkMacSystemFont,sans-serif">' +
      '<div style="text-align:center;max-width:360px;width:100%;padding:2rem">' +
        '<div style="font-family:Lora,Georgia,serif;font-size:1.5rem;font-weight:700;color:#0A6259;margin-bottom:0.25rem">HealthCoach CUJ</div>' +
        '<p style="font-size:0.82rem;color:#78716C;margin-bottom:1.5rem">Enter the password to continue</p>' +
        '<input id="pw-input" type="password" placeholder="Password" autofocus ' +
          'style="width:100%;padding:0.7rem 1rem;font-size:0.95rem;border:1.5px solid #E7E5E4;border-radius:10px;outline:none;font-family:inherit;background:#fff;transition:border-color 0.2s">' +
        '<button id="pw-btn" style="width:100%;margin-top:0.75rem;padding:0.7rem 1rem;font-size:0.88rem;font-weight:600;font-family:inherit;border:none;border-radius:10px;background:#0E9F8C;color:#fff;cursor:pointer;transition:background 0.2s">Continue</button>' +
        '<p id="pw-err" style="font-size:0.78rem;color:#EF6347;margin-top:0.75rem;min-height:1.2em"></p>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  document.documentElement.style.display = '';

  var input = document.getElementById('pw-input');
  var btn = document.getElementById('pw-btn');
  var err = document.getElementById('pw-err');

  async function check() {
    var val = input.value.trim();
    if (!val) { err.textContent = 'Please enter a password.'; input.focus(); return; }
    var h = await sha256(val);
    if (h === HASH) {
      sessionStorage.setItem(KEY, '1');
      overlay.remove();
    } else {
      err.textContent = 'Incorrect password.';
      input.value = '';
      input.focus();
    }
  }

  btn.addEventListener('click', check);
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter') check(); });
  input.addEventListener('focus', function() { input.style.borderColor = '#0E9F8C'; });
  input.addEventListener('blur', function() { input.style.borderColor = '#E7E5E4'; });
  btn.addEventListener('mouseenter', function() { btn.style.background = '#0A7A6E'; });
  btn.addEventListener('mouseleave', function() { btn.style.background = '#0E9F8C'; });
})();
