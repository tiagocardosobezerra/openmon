'use strict';

// The top bar shared by every page: the brand, the main places with an icon
// and a label, "More" for the rest, Settings, and your Openmon at the corner
// as "you are here", next to the brand. <body data-page="dex"> marks the
// current page.
(function () {
  const { t: tr } = window.OpenmonI18n;
  const page = document.body.dataset.page;
  // Copy text: through the desktop shell when there is one, else the
  // browser's clipboard. Always a promise that says whether it worked.
  window.openmonCopy = (text) => {
    const desk = window.openmonSettings;
    const via = desk && desk.copyText ? desk.copyText(text) : navigator.clipboard.writeText(text).then(() => true);
    return Promise.resolve(via).then(Boolean).catch(() => false);
  };
  // A copy button: copies, says so (or says it failed), then goes back to
  // its own label.
  window.openmonCopyInto = (button, text, done) => {
    const label = button.textContent;
    return window.openmonCopy(text).then((ok) => {
      button.textContent = ok ? done : tr('copy.failed');
      setTimeout(() => (button.textContent = label), 1800);
      return ok;
    });
  };
  // A short line at the bottom of the page about what a click did.
  let noteTimer = 0;
  window.openmonNote = (text, ok = true) => {
    let n = document.getElementById('page-note');
    if (!n) {
      n = document.createElement('p');
      n.id = 'page-note';
      n.setAttribute('role', 'status');
      document.body.append(n);
    }
    n.textContent = text;
    n.className = `page-note${ok ? '' : ' bad'}`;
    n.hidden = false;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => (n.hidden = true), 2600);
  };
  // Which of the designer's optional files exist (public/icons, props, badges).
  window.OpenmonSlots = fetch('/art/index.json')
    .then((r) => r.json())
    .then((j) => new Set(j.slots || []))
    .catch(() => new Set());
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  // Drawn here until the designer's public/icons/nav-<id>.svg exists.
  const ICONS = {
    powers: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
    dex: '<path d="M4 5.5h5.5A2.5 2.5 0 0 1 12 8v11.5a2 2 0 0 0-2-2H4z"/><path d="M20 5.5h-5.5A2.5 2.5 0 0 0 12 8v11.5a2 2 0 0 1 2-2h6z"/>',
    party: '<circle cx="8.5" cy="9.5" r="3"/><circle cx="16" cy="9.5" r="3"/><path d="M3 19.5c.4-3 2.7-5 5.5-5s5.1 2 5.5 5M12.5 15c.9-.4 2.1-.6 3.5-.5 2.8.2 4.6 2 5 5"/>',
    bag: '<path d="M7 8.5h10a2 2 0 0 1 2 2v9H5v-9a2 2 0 0 1 2-2z"/><path d="M9 8.5V6.5a3 3 0 0 1 6 0v2M9 13.5h6"/>',
    card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><circle cx="8.5" cy="11" r="2"/><path d="M6 15.5c.6-1.2 1.5-1.8 2.5-1.8s1.9.6 2.5 1.8M14 10h4M14 13.5h3"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.6"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    more: '<circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  };
  function icon(id) {
    const span = document.createElement('span');
    span.className = 'nav-ic';
    span.innerHTML = svg(ICONS[id]);
    // The designer's icon replaces the drawn one when it is there.
    window.OpenmonSlots.then((slots) => {
      if (!slots.has(`icons/nav-${id}.svg`)) return;
      const img = new Image();
      img.alt = '';
      img.onload = () => span.replaceChildren(img);
      img.src = `/icons/nav-${id}.svg`;
    });
    return span;
  }
  function link(id, href, label, { iconOnly = false } = {}) {
    const a = document.createElement('a');
    a.href = href;
    a.dataset.id = id;
    a.append(icon(id));
    const text = document.createElement('span');
    text.className = 'nav-label';
    text.textContent = label;
    a.append(text);
    if (iconOnly) {
      a.classList.add('icon-only');
      a.title = label;
      a.setAttribute('aria-label', label);
    }
    if (id === page) a.setAttribute('aria-current', 'page');
    return a;
  }

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
  nav.setAttribute('aria-label', 'Openmon');
  for (const [id, href, label] of [
    ['powers', '/powers.html', tr('act.powers')],
    ['dex', '/dex.html', 'Opendex'],
    ['party', '/party.html', tr('act.party')],
    ['bag', '/bag.html', tr('act.bag')],
  ]) nav.append(link(id, href, label));

  // "More": the trainer card and the help, in a small menu.
  const more = document.createElement('details');
  more.className = 'nav-more';
  const sum = document.createElement('summary');
  sum.append(icon('more'));
  const moreLabel = document.createElement('span');
  moreLabel.className = 'nav-label';
  moreLabel.textContent = tr('nav.more');
  sum.append(moreLabel);
  const menu = document.createElement('div');
  menu.className = 'nav-menu';
  menu.append(link('card', '/card.html', tr('nav.card')), link('help', '/help.html', tr('nav.help')));
  more.append(sum, menu);
  if (page === 'card' || page === 'help') sum.setAttribute('aria-current', 'page');
  // Every small menu on a page (this "More", a member's "⋯") is a popover:
  // one open at a time, closed by a click anywhere else or by Esc.
  const MENUS = 'details.nav-more, details.more';
  const closeMenus = (keep = null) => {
    for (const d of document.querySelectorAll(`${MENUS}[open]`)) if (d !== keep) d.open = false;
  };
  document.addEventListener('pointerdown', (e) => closeMenus(e.target.closest && e.target.closest(MENUS)));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Back to the button that opened it, so the keyboard is not lost.
    const open = document.querySelector(`${MENUS}[open]`);
    closeMenus();
    if (open) open.querySelector('summary').focus();
  });
  document.addEventListener('toggle', (e) => e.target.matches && e.target.matches(MENUS) && e.target.open && closeMenus(e.target), true);
  // A menu item that was used closes its menu.
  document.addEventListener('click', (e) => {
    const menu = e.target.closest && e.target.closest(MENUS);
    if (menu && e.target.closest('button, a') && !e.target.closest('summary, [data-keep-open]')) menu.open = false;
  });
  window.addEventListener('blur', () => closeMenus());
  nav.append(more, link('settings', '/settings.html', tr('card.settings')));

  // Your Openmon: "you are here".
  const me = document.createElement('a');
  me.className = 'nav-me';
  me.href = '/dex.html';
  me.hidden = true;
  const meImg = document.createElement('img');
  meImg.alt = '';
  me.append(meImg);
  fetch('/api/state')
    .then((r) => r.json())
    .then((s) => {
      const p = s && !s.demo && s.pet;
      if (!p || !p.formKey) return;
      meImg.onload = () => (me.hidden = false);
      meImg.onerror = () => {
        if (p.shiny && !meImg.dataset.plain) {
          meImg.dataset.plain = '1';
          meImg.src = `/art/${encodeURIComponent(p.formKey)}.svg`;
        }
      };
      meImg.src = `/art/${encodeURIComponent(p.formKey)}${p.shiny && p.stage !== 'egg' ? '.shiny' : ''}.svg`;
      me.title = `${p.name} · ${tr('nav.me')}`;
      me.setAttribute('aria-label', `${p.name} · ${tr('nav.me')}`);
      if (p.lineage) me.classList.add(`t-${p.lineage}`);
    })
    .catch(() => {});

  // On the left, next to the brand: its space is kept while the image
  // loads, so the places on the right never move.
  bar.append(brand, me, nav);
  const here = nav.querySelector('[aria-current="page"][href]');
  if (here) document.title = `${here.title || here.textContent} · Openmon`;
  document.body.prepend(bar);
})();
