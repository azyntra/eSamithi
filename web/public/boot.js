// Runs before the bundle: applies the persisted theme and language so there
// is no flash of the wrong mode. Keys are shared with the desktop app.
(function () {
  try {
    var theme = localStorage.getItem('esamithi-theme');
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
    var lang = localStorage.getItem('esamithi-lang');
    document.documentElement.lang = lang === 'si' ? 'si' : 'en';
  } catch (e) { /* storage blocked: defaults apply */ }
})();
