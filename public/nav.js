'use strict';

// The top bar shared by every page: brand on the left, the three places
// (Powers, Opendex, Trainer card) on the right. <body data-page="dex">
// marks the current one.
(function () {
  const { t: tr } = window.OpenmonI18n;
  const page = document.body.dataset.page;
  const bar = document.createElement('header');
  bar.className = 'topbar';
  const brand = document.createElement('a');
  brand.className = 'brand';
  brand.href = '/dex.html';
  const mark = document.createElement('img');
  mark.src = '/brand/icon.svg';
  mark.alt = '';
  brand.append(mark, 'Openmon');
  const nav = document.createElement('nav');
  for (const [id, href, label] of [
    ['powers', '/powers.html', tr('act.powers')],
    ['dex', '/dex.html', 'Opendex'],
    ['bag', '/bag.html', tr('act.bag')],
    ['card', '/card.html', tr('nav.card')],
  ]) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (id === page) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  }
  bar.append(brand, nav);
  document.body.prepend(bar);
})();
