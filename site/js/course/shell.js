// ════════════════════════════════════════════════════════
// course/shell.js — L'estructura comuna de les pàgines del curs
//
// Cada pàgina del curs només conté el seu <main> i es presenta amb
//   <body data-pagina="capitol" data-num="1">
// (docs/BLUEPRINT.md §5.1). Aquest mòdul hi afegeix la barra superior, el
// menú de capítols (amb ✓ als superats; plegable al mòbil), els enllaços
// «anterior / següent» i el peu, tot calculat de course/data.js.
// Mai no es fa servir l'adreça de la pàgina per saber on som (A9).
//
// API pública:
//   initCoursePage() → entrada de course/data.js de la pàgina, o null
// ════════════════════════════════════════════════════════

import { PARTS, courseSequence, findPage, neighbours } from './data.js';
import { completedGoals, onProgress } from './progress.js';
import { t } from '../i18n/ca.js';

const SITE = new URL('../../', import.meta.url);
const pageUrl = (page) => new URL('curs/' + page.arxiu, SITE).href;
const pageLabel = (page) => (page.pagina === 'repte'
  ? t('course.repte', { num: page.num })
  : t('course.chapter', { num: page.num }));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(className, href, text) {
  const a = el('a', className, text);
  a.href = href;
  return a;
}

function createBar(menu) {
  const bar = el('header', 'course-bar');
  const logo = link('logo logo--petit', SITE.href, '');
  const img = el('img');
  img.src = new URL('img/logo.svg', SITE).href;
  img.alt = '';
  logo.append(img, 'HTMLCat');

  const toggle = el('button', 'course-bar__menu', t('course.menu'));
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', menu.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('course-menu--open', open);
  });

  bar.append(logo, toggle, link('course-bar__link', new URL('editor/', SITE).href, t('course.editor')));
  return bar;
}

function createMenu(current) {
  const menu = el('nav', 'course-menu');
  menu.id = 'course-menu';
  menu.setAttribute('aria-label', t('course.menu.label'));
  const items = [];
  let part = null;
  let list = null;

  for (const page of courseSequence()) {
    if (page.pagina === 'capitol' && page.part !== part) {
      part = page.part;
      list = el('ol', 'course-menu__list');
      menu.append(el('p', 'course-menu__part', PARTS[part]), list);
    }
    const a = link('course-menu__link', pageUrl(page), '');
    a.append(el('span', 'course-menu__label', pageLabel(page)), el('span', 'course-menu__title', page.titol));
    const done = el('span', 'course-menu__done');
    const tick = el('span', '', '✓');
    tick.setAttribute('aria-hidden', 'true');
    done.append(tick, el('span', 'visually-hidden', t('course.done')));
    a.append(done);
    if (page.pagina === current.pagina && page.num === current.num) a.setAttribute('aria-current', 'page');
    const item = el('li', page.pagina === 'repte' ? 'course-menu__item course-menu__item--repte' : 'course-menu__item');
    item.append(a);
    list.append(item);
    items.push({ page, item });
  }

  function refresh(goals = completedGoals()) {
    for (const { page, item } of items) item.classList.toggle('course-menu__item--done', Boolean(goals[page.goalId]));
  }
  refresh();
  onProgress(refresh);
  return menu;
}

function createNeighbourLinks(current) {
  const { prev, next } = neighbours(current.pagina, current.num);
  const nav = el('nav', 'course-nav');
  nav.setAttribute('aria-label', t('course.nav.label'));
  const prevLink = prev
    ? link('course-nav__prev', pageUrl(prev), t('course.prev', { title: `${pageLabel(prev)}: ${prev.titol}` }))
    : link('course-nav__prev', SITE.href, t('course.prev', { title: t('course.home') }));
  prevLink.rel = 'prev';
  nav.append(prevLink);
  if (next) {
    const nextLink = link('course-nav__next', pageUrl(next), t('course.next', { title: `${pageLabel(next)}: ${next.titol}` }));
    nextLink.rel = 'next';
    nav.append(nextLink);
  }
  return nav;
}

function createFooter() {
  const footer = el('footer', 'peu');
  const p = el('p');
  const strong = el('strong', '', 'David Arso Civil');
  p.append('© 2026 ', strong, ' · INS Miquel Tarradell · ', t('course.footer.content'), ' ',
    link('', 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ca', 'CC BY-NC-SA 4.0'),
    ' · ', t('course.footer.code'), ' ', link('', new URL('LICENSE.txt', SITE).href, t('course.footer.mit')));
  footer.append(p);
  return footer;
}

/** @returns {Object|null} */
export function initCoursePage() {
  const { pagina } = document.body.dataset;
  const current = findPage(pagina, Number(document.body.dataset.num));
  const main = document.querySelector('main');
  if (!current || !main) return null;

  const menu = createMenu(current);
  const layout = el('div', 'course');
  const body = el('div', 'course__body');
  document.body.prepend(layout);
  body.append(menu, main);
  main.append(createNeighbourLinks(current));
  layout.append(createBar(menu), body, createFooter());
  return current;
}
