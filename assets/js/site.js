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

  var posts = Array.prototype.slice.call(document.querySelectorAll('[data-post]'));
  if (posts.length === 0) return;

  var search = document.querySelector('[data-post-search]');
  var categoryButtons = Array.prototype.slice.call(document.querySelectorAll('[data-category-filter]'));
  var tagButtons = Array.prototype.slice.call(document.querySelectorAll('[data-tag-filter]'));
  var resultCount = document.querySelector('[data-result-count]');
  var noResults = document.querySelector('[data-no-results]');
  var activeCategory = '';
  var activeTag = '';

  function filterPosts() {
    var query = search.value.trim().toLocaleLowerCase();
    var visible = 0;
    posts.forEach(function (post) {
      var matchesSearch = !query || post.dataset.search.indexOf(query) !== -1;
      var matchesCategory = !activeCategory || post.dataset.category === activeCategory;
      var matchesTag = !activeTag || post.dataset.tags.split('|').indexOf(activeTag) !== -1;
      var show = matchesSearch && matchesCategory && matchesTag;
      post.hidden = !show;
      if (show) visible += 1;
    });
    resultCount.textContent = visible;
    noResults.hidden = visible !== 0;
  }

  search.addEventListener('input', filterPosts);

  categoryButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      activeCategory = button.dataset.categoryFilter;
      categoryButtons.forEach(function (candidate) {
        candidate.setAttribute('aria-pressed', String(candidate === button));
      });
      filterPosts();
    });
  });

  tagButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      activeTag = activeTag === button.dataset.tagFilter ? '' : button.dataset.tagFilter;
      tagButtons.forEach(function (candidate) {
        candidate.setAttribute('aria-pressed', String(candidate.dataset.tagFilter === activeTag));
      });
      filterPosts();
    });
  });
})();
