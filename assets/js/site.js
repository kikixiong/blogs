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
  if (!sidebar || !toggle) return;

  toggle.addEventListener('click', function () {
    var isOpen = sidebar.dataset.open === 'true';
    sidebar.dataset.open = String(!isOpen);
    toggle.setAttribute('aria-expanded', String(!isOpen));
  });

  var items = Array.prototype.slice.call(sidebar.querySelectorAll('[data-outline-item]'));
  var path = document.querySelector('[data-reading-path]');
  var title = document.querySelector('[data-reading-title]');
  var readingPane = document.querySelector('[data-reading-pane]');
  var published = document.querySelector('[data-published]');
  if (!items.length || !path || !title || !readingPane || !published) return;

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
    readingPane.hidden = false;
    published.hidden = true;

    if (updateHash) history.pushState(null, '', '#' + item.dataset.outlineKey);
    if (moveFocus) {
      if (window.matchMedia('(max-width: 760px)').matches) {
        sidebar.dataset.open = 'false';
        toggle.setAttribute('aria-expanded', 'false');
      }
      title.focus();
    }
  }

  items.forEach(function (item) {
    item.addEventListener('click', function () { selectItem(item, true, true); });
  });

  function selectFromHash() {
    var key = '';
    try { key = decodeURIComponent(window.location.hash.slice(1)); } catch (error) { /* Ignore malformed hashes. */ }
    var match = items.find(function (item) { return item.dataset.outlineKey === key; });
    if (match) {
      selectItem(match, false, false);
      return;
    }
    var publishedLink = Array.prototype.find.call(sidebar.querySelectorAll('a[data-outline-key]'), function (link) {
      return link.dataset.outlineKey === key;
    });
    if (publishedLink) {
      window.location.replace(publishedLink.href);
      return;
    }
    items.forEach(function (item) { item.setAttribute('aria-pressed', 'false'); });
    readingPane.hidden = true;
    published.hidden = false;
  }

  window.addEventListener('hashchange', selectFromHash);
  window.addEventListener('popstate', selectFromHash);
  selectFromHash();
})();
