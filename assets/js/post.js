(function () {
  'use strict';

  var body = document.querySelector('[data-post-body]');
  var toc = document.querySelector('[data-post-toc]');
  if (!body || !toc) return;

  var headings = Array.prototype.slice.call(body.querySelectorAll('h2, h3'));
  if (!headings.length) return;

  var nav = toc.querySelector('[data-post-toc-nav]');
  var toggle = toc.querySelector('[data-post-toc-toggle]');
  var usedIds = new Set(Array.prototype.map.call(document.querySelectorAll('[id]'), function (node) { return node.id; }));
  var links = [];

  headings.forEach(function (heading, index) {
    var label = heading.textContent.trim();
    if (!label) return;
    if (!heading.id) {
      var base = label.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section-' + (index + 1);
      var id = base;
      var suffix = 2;
      while (usedIds.has(id)) id = base + '-' + suffix++;
      heading.id = id;
      usedIds.add(id);
    }
    var link = document.createElement('a');
    link.href = '#' + encodeURIComponent(heading.id);
    link.textContent = label;
    link.dataset.level = heading.tagName.slice(1);
    nav.appendChild(link);
    links.push({ heading: heading, link: link });
  });

  if (!links.length) return;
  toc.hidden = false;

  var mobile = window.matchMedia('(max-width: 820px)');
  function syncDisclosure() {
    if (mobile.matches) {
      nav.hidden = toggle.getAttribute('aria-expanded') !== 'true';
    } else {
      nav.hidden = false;
      toggle.setAttribute('aria-expanded', 'false');
    }
  }
  toggle.addEventListener('click', function () {
    var expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded));
    nav.hidden = !expanded;
  });
  nav.addEventListener('click', function (event) {
    if (mobile.matches && event.target.closest('a')) {
      toggle.setAttribute('aria-expanded', 'false');
      nav.hidden = true;
    }
  });
  mobile.addEventListener('change', syncDisclosure);
  syncDisclosure();

  var ticking = false;
  function markCurrent() {
    var active = links[0];
    links.forEach(function (entry) {
      if (entry.heading.getBoundingClientRect().top <= 110) active = entry;
      entry.link.removeAttribute('aria-current');
    });
    active.link.setAttribute('aria-current', 'location');
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(markCurrent);
    }
  }, { passive: true });
  markCurrent();
}());
