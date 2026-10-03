// ════════════════════════════════════════════════════════
// sim/problems-panel.js — El panell ⚠ Problemes del simulador
//
// Mostra el que ha trobat el revisor de codi (lint/lint.js): com a molt
// 10 entrades, primer els errors, amb la línia, el text i la pista en
// català (avisos repetits agrupats: «i 4 més com aquest»). Clicar una
// entrada porta el cursor a la línia del problema (onSelect).
//
// Accessibilitat: cada entrada és un <button>; només la línia d'estat
// curta («2 errors, 1 avís») és aria-live, mai la llista sencera.
// Tot el text que ve del codi de l'alumne es posa amb textContent.
//
// API pública:
//   createProblemsPanel(container, { onSelect, showTitle }) → { update(problems) }
//   problems: com els retorna lintStatic (ordenats)
//   showTitle: false si el títol ja surt en una pestanya
// ════════════════════════════════════════════════════════

import { summarize } from '../lint/lint.js';
import { t } from '../i18n/ca.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * «2 errors, 1 avís» o «Cap problema».
 *
 * @param {{ error: number, warning: number, info: number }} counts
 */
function statusText({ error, warning, info }) {
  const parts = [];
  if (error) parts.push(error === 1 ? t('sim.problems.error', { n: error }) : t('sim.problems.errors', { n: error }));
  if (warning) parts.push(warning === 1 ? t('sim.problems.warning', { n: warning }) : t('sim.problems.warnings', { n: warning }));
  if (info) parts.push(info === 1 ? t('sim.problems.info', { n: info }) : t('sim.problems.infos', { n: info }));
  return parts.length ? parts.join(', ') : t('sim.problems.none');
}

const SEVERITY_LABEL = {
  error: () => t('sim.problems.severity.error'),
  warning: () => t('sim.problems.severity.warning'),
  info: () => t('sim.problems.severity.info'),
};

/**
 * @param {HTMLElement} container
 * @param {{ onSelect: (problem: Object) => void, showTitle?: boolean }} options
 */
export function createProblemsPanel(container, { onSelect, showTitle = true }) {
  const root = el('section', 'sim-problems');
  root.setAttribute('aria-label', t('sim.problems.label'));
  const header = el('div', 'sim-problems__header');
  const status = el('span', 'sim-problems__status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  if (showTitle) header.append(el('span', 'sim-problems__title', t('sim.problems')));
  header.append(status);
  const list = el('ol', 'sim-problems__list');
  root.append(header, list);
  container.append(root);

  function renderEntry(problem, more) {
    const item = el('li', `sim-problem sim-problem--${problem.severity}`);
    const goto = el('button', 'sim-problem__goto');
    goto.type = 'button';
    goto.title = t('sim.problems.goto', { line: problem.line });
    goto.append(
      el('span', 'sim-problem__where', t('sim.problems.where', {
        severity: SEVERITY_LABEL[problem.severity](), file: problem.file, line: problem.line,
      })),
      el('span', 'sim-problem__text', problem.text),
    );
    goto.addEventListener('click', () => onSelect(problem));
    // La pista, i al final (petit) quants més n'hi ha com aquest i l'id de la regla
    const hint = el('p', 'sim-problem__hint', '💡 ' + problem.hint + ' ');
    const details = el('span', 'sim-problem__details');
    if (more) details.append(t('sim.problems.more', { n: more }), ' · ');
    details.append(el('code', 'sim-problem__rule', problem.rule));
    hint.append(details);
    item.append(goto, hint);
    return item;
  }

  return {
    /** @param {Array<Object>} problems */
    update(problems) {
      const { entries, counts, hidden } = summarize(problems);
      const text = statusText(counts);
      if (status.textContent !== text) status.textContent = text;   // només s'anuncia si canvia
      root.classList.toggle('sim-problems--clean', problems.length === 0);
      list.textContent = '';
      for (const { problem, more } of entries) list.append(renderEntry(problem, more));
      if (hidden) list.append(el('li', 'sim-problems__hidden', t('sim.problems.hidden', { n: hidden })));
    },
  };
}
