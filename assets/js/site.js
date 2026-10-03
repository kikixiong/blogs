(function () {
  'use strict';

  var root = document.documentElement;
  var themeButton = document.querySelector('[data-theme-toggle]');
  if (themeButton) {
    function updateThemeButton() {
      var dark = root.dataset.theme === 'dark';
      themeButton.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      themeButton.querySelector('[data-theme-icon]').textContent = dark ? '☀' : '☾';
    }

    themeButton.addEventListener('click', function () {
      var nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = nextTheme;
      try { localStorage.setItem('ox-theme', nextTheme); } catch (error) { /* Storage may be disabled. */ }
      updateThemeButton();
    });
    updateThemeButton();
  }

  var sidebar = document.querySelector('[data-outline-sidebar]');
  var toggle = document.querySelector('[data-outline-toggle]');
  var items = Array.prototype.slice.call(document.querySelectorAll('[data-outline-item]'));
  var path = document.querySelector('[data-reading-path]');
  var title = document.querySelector('[data-reading-title]');
  if (!sidebar || !toggle || !items.length || !path || !title) return;

  function selectItem(item, updateHash, moveFocus) {
    if (!item) return;
    items.forEach(function (candidate) {
      candidate.setAttribute('aria-pressed', String(candidate === item));
    });
    item.closest('.topic-tree__group').open = true;
    item.closest('.topic-tree__topic').open = true;

    var separator = document.createElement('span');
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = '/';
    path.replaceChildren(
      document.createTextNode(item.dataset.outlineTopic + ' '),
      separator,
      document.createTextNode(' ' + item.dataset.outlineGroup)
    );
    title.textContent = item.textContent.trim();

    if (updateHash) history.pushState(null, '', '#' + item.dataset.outlineKey);
    if (moveFocus && window.matchMedia('(max-width: 760px)').matches) {
      sidebar.dataset.open = 'false';
      toggle.setAttribute('aria-expanded', 'false');
      title.focus();
    }
  }

  toggle.addEventListener('click', function () {
    var isOpen = sidebar.dataset.open === 'true';
    sidebar.dataset.open = String(!isOpen);
    toggle.setAttribute('aria-expanded', String(!isOpen));
  });

  items.forEach(function (item) {
    item.addEventListener('click', function () { selectItem(item, true, true); });
  });

  function selectFromHash() {
    var key = '';
    try { key = decodeURIComponent(window.location.hash.slice(1)); } catch (error) { /* Ignore malformed hashes. */ }
    var match = items.find(function (item) { return item.dataset.outlineKey === key; });
    selectItem(match || items[0], false, false);
  }

  window.addEventListener('hashchange', selectFromHash);
  window.addEventListener('popstate', selectFromHash);
  selectFromHash();
})();
