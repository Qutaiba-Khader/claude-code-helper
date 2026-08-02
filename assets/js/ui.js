/* Shared UI helpers used by every page: theme toggle, toast, clipboard.
   Loaded before any page-specific script. */
(function () {
  'use strict';

  // ---- theme -------------------------------------------------------------
  var KEY = 'cch-theme';
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
  if (saved) document.documentElement.setAttribute('data-theme', saved);

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('#theme');
    if (!btn) return;
    var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e2) { /* ignore */ }
  });

  // ---- toast -------------------------------------------------------------
  var toastTimer;
  window.toast = function (msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1900);
  };

  // ---- clipboard ---------------------------------------------------------
  // navigator.clipboard needs a secure context; fall back to a hidden textarea
  // so the page still works over plain http and from file://.
  window.copyText = function (text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; },
                                                      function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  };

  // Any [data-copy-btn] marks itself done for a moment after a successful copy.
  window.flashButton = function (btn, label) {
    if (!btn) return;
    var original = btn.dataset.label || btn.textContent;
    btn.dataset.label = original;
    btn.textContent = label || 'Copied';
    btn.classList.add('is-done');
    setTimeout(function () {
      btn.textContent = btn.dataset.label;
      btn.classList.remove('is-done');
    }, 1400);
  };
})();
