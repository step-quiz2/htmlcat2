// ════════════════════════════════════════════════════════
// sim/checks-panel.js — El panell ✓ Comprovacions del simulador
//
// Mostra el resultat de prémer «✓ Comprova»: TOTES les comprovacions de
// l'exercici amb ✓ o ✗, cadascuna amb el seu requisit en català (no
// només la primera que falla). Si l'alumne canvia el codi després de
// comprovar, avisa que el resultat ja no és vàlid.
//
// Només la línia d'estat és aria-live; tot el text amb textContent.
//
// API pública:
//   createChecksPanel(container) → { idle(done), running(), show(results), stale() }
//   done: l'alumne ja havia superat l'exercici
//   results: com els retorna runChecks (checks/checks.js)
// ════════════════════════════════════════════════════════

import { t } from '../i18n/ca.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** @param {HTMLElement} container */
export function createChecksPanel(container) {
  const status = el('p', 'sim-checks__status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const note = el('p', 'sim-checks__note', t('sim.checks.stale'));
  note.hidden = true;
  const list = el('ol', 'sim-checks__list');
  container.append(status, note, list);

  function setStatus(text, kind = '') {
    status.textContent = text;
    status.className = 'sim-checks__status' + (kind ? ` sim-checks__status--${kind}` : '');
  }

  function renderResult({ check, passed, detail }) {
    const item = el('li', `sim-check sim-check--${passed ? 'pass' : 'fail'}`);
    const icon = el('span', 'sim-check__icon', passed ? '✓' : '✗');
    icon.setAttribute('aria-hidden', 'true');
    item.append(icon, el('span', 'visually-hidden', passed ? t('sim.checks.pass') : t('sim.checks.fail')));
    const text = el('span', 'sim-check__text', check.msg);
    if (detail && !passed) text.append(el('span', 'sim-check__detail', ' ' + detail));
    item.append(text);
    return item;
  }

  return {
    /** @param {boolean} done */
    idle(done) {
      setStatus(done ? t('sim.checks.done.before') : t('sim.checks.idle'), done ? 'pass' : '');
    },
    running() {
      note.hidden = true;
      setStatus(t('sim.checks.running'));
    },
    /** @param {Array<Object>} results */
    show(results) {
      const total = results.length;
      const passed = results.filter((r) => r.passed).length;
      if (passed === total) setStatus(t('sim.checks.success', { total }), 'pass');
      else setStatus(t('sim.checks.summary', { passed, total }), 'fail');
      list.textContent = '';
      for (const result of results) list.append(renderResult(result));
    },
    stale() {
      if (list.childElementCount) note.hidden = false;
    },
  };
}
