/* © Mr. Si!ent Creator Hub — All Rights Reserved. Protection v1 */
(function () {
  'use strict';

  /* ── Domain Lock ──────────────────────────────────────── */
  var ALLOWED = ['localhost', '127.0.0.1', 'github.io', 'github.com'];
  var host = window.location.hostname;
  var domainOK = ALLOWED.some(function (d) {
    return host === d || host.endsWith('.' + d) || host.endsWith(d);
  });
  if (!domainOK && host !== '') {
    document.documentElement.innerHTML =
      '<div style="position:fixed;inset:0;background:#020510;display:flex;' +
      'align-items:center;justify-content:center;font-family:monospace;' +
      'color:#00dcff;font-size:1.1rem;text-align:center;padding:40px;">' +
      '&#9888;&#65039; This site is protected.<br>Unauthorized domain detected.</div>';
    return;
  }

  /* ── Disable Right Click ──────────────────────────────── */
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
  });

  /* ── Disable Text Selection ───────────────────────────── */
  document.addEventListener('selectstart', function (e) {
    e.preventDefault();
    return false;
  });

  /* ── Disable Keyboard Shortcuts ───────────────────────── */
  document.addEventListener('keydown', function (e) {
    // F12
    if (e.keyCode === 123) { e.preventDefault(); return false; }
    // Ctrl+Shift+I / J / C / K  (DevTools)
    if (e.ctrlKey && e.shiftKey && [73, 74, 67, 75].indexOf(e.keyCode) !== -1) {
      e.preventDefault(); return false;
    }
    // Ctrl+U  (View Source)
    if (e.ctrlKey && e.keyCode === 85) { e.preventDefault(); return false; }
    // Ctrl+S  (Save)
    if (e.ctrlKey && e.keyCode === 83) { e.preventDefault(); return false; }
    // Ctrl+A  (Select All)
    if (e.ctrlKey && e.keyCode === 65) { e.preventDefault(); return false; }
    // Ctrl+P  (Print)
    if (e.ctrlKey && e.keyCode === 80) { e.preventDefault(); return false; }
  });

  /* ── Intercept Copy — paste copyright instead ─────────── */
  document.addEventListener('copy', function (e) {
    if (e.clipboardData) {
      e.clipboardData.setData('text/plain', '© Mr. Si!ent Creator Hub — All Rights Reserved.');
      e.preventDefault();
    }
  });
  document.addEventListener('cut', function (e) { e.preventDefault(); });

  /* ── Disable Drag ─────────────────────────────────────── */
  document.addEventListener('dragstart', function (e) { e.preventDefault(); });

  /* ── DevTools Size Detection ──────────────────────────── */
  var _devOpen = false;
  var _devCheck = setInterval(function () {
    var widthDiff  = window.outerWidth  - window.innerWidth  > 200;
    var heightDiff = window.outerHeight - window.innerHeight > 200;
    if ((widthDiff || heightDiff) && !_devOpen) {
      _devOpen = true;
      document.body.innerHTML =
        '<div style="position:fixed;inset:0;background:#020510;display:flex;' +
        'align-items:center;justify-content:center;z-index:99999;' +
        'font-family:monospace;color:#00dcff;font-size:1.2rem;text-align:center;padding:40px;">' +
        '<div>&#128683; Developer tools detected.<br><br>' +
        '<span style="color:#ff3a8c;font-size:.9rem;">This site is protected by Mr. Si!ent Creator Hub.</span>' +
        '</div></div>';
      clearInterval(_devCheck);
    }
  }, 1000);

  /* ── Debugger Trap ────────────────────────────────────── */
  setInterval(function () {
    (function () {}['constructor']('debugger')());
  }, 150);

  /* ── Anti iframe embedding ────────────────────────────── */
  if (window.self !== window.top) {
    var ref = document.referrer || '';
    var refOK = ALLOWED.some(function (d) { return ref.indexOf(d) !== -1; });
    if (!refOK) {
      try { window.top.location = window.self.location; } catch (e) { window.location = 'about:blank'; }
    }
  }

  /* ── Console Warning ──────────────────────────────────── */
  if (window.console) {
    var _warn = [
      '%c⚠  STOP!',
      'color:#ff3a8c;font-size:48px;font-weight:900;-webkit-text-stroke:2px #00dcff;',
    ];
    console.log.apply(console, _warn);
    console.log('%cThis is a browser feature intended for developers.', 'color:#7a9bbf;font-size:14px;');
    console.log('%cIf someone told you to paste something here, it is a scam.', 'color:#ff3a8c;font-size:13px;font-weight:bold;');
    console.log('%c© Mr. Si!ent Creator Hub — All Rights Reserved.', 'color:#00dcff;font-size:12px;');
    /* Override console to log nothing further */
    var noop = function () {};
    ['log', 'info', 'warn', 'error', 'table', 'dir'].forEach(function (m) {
      try { console[m] = noop; } catch (e) {}
    });
  }

  /* ── Disable Print ────────────────────────────────────── */
  window.addEventListener('beforeprint', function (e) {
    e.preventDefault();
    return false;
  });

})();
