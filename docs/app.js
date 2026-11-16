// The page works without this file: every download is a plain link and every screen is shown.
// With it: the download for the visitor's system leads, the moments become a switcher, and the
// newest release's version and file sizes appear when GitHub answers.
(function () {
  var REPO = 'venu-webdev/bilingual-projector';

  // Lead with the visitor's system: Linux visitors get the Linux button first and filled.
  var ua = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '';
  if (/linux|x11/i.test(ua) && !/android/i.test(navigator.userAgent)) {
    document.querySelectorAll('[data-downloads]').forEach(function (row) {
      var win = row.querySelector('[data-os="windows"]');
      var lin = row.querySelector('[data-os="linux"]');
      if (!win || !lin) return;
      row.insertBefore(lin, win);
      lin.classList.add('btn--main');
      win.classList.remove('btn--main');
    });
  }

  // The moments: a tab list with arrow keys, one screen at a time.
  var list = document.querySelector('[data-tabs]');
  if (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    var show = function (i, focus) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tabs[i].focus();
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { show(i); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (i + 1) % tabs.length;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = tabs.length - 1;
        if (n !== null) { e.preventDefault(); show(n, true); }
      });
    });
    show(0);
  }

  // The newest release: its version number and the size of each download.
  if (!window.fetch) return;
  fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (rel) {
      var mb = function (name) {
        var a = (rel.assets || []).filter(function (x) { return x.name === name; })[0];
        return a ? Math.round(a.size / 1048576) + ' MB' : '';
      };
      var set = function (key, text) {
        document.querySelectorAll('[data-size="' + key + '"]').forEach(function (el) { if (text) el.textContent = el.textContent + ', ' + text; });
      };
      set('win', mb('Bilingual-Projector-Setup-x64.exe'));
      set('appimage', mb('Bilingual-Projector-x86_64.AppImage'));
      var v = document.querySelector('[data-version]');
      if (v && rel.tag_name) v.textContent = 'Version ' + rel.tag_name.replace(/^v/, '') + ', free and open source';
    })
    .catch(function () { /* the links still work without the numbers */ });
})();
