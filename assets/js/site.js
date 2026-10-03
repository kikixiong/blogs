(function () {
  'use strict';

  var root = document.documentElement;
  var button = document.querySelector('[data-theme-toggle]');
  if (!button) return;

  function updateButton() {
    var dark = root.dataset.theme === 'dark';
    button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    button.querySelector('[data-theme-icon]').textContent = dark ? '☀' : '☾';
  }

  button.addEventListener('click', function () {
    var nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = nextTheme;
    try { localStorage.setItem('ox-theme', nextTheme); } catch (error) { /* Storage may be disabled. */ }
    updateButton();
  });

  updateButton();
})();
