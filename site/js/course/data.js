// ════════════════════════════════════════════════════════
// course/data.js — Les dades del curs: capítols i reptes (mòdul pur)
//
// Font única de veritat de l'estructura del curs: el menú de capítols,
// els enllaços «anterior / següent» i la portada es calculen d'aquí.
// Només hi ha les pàgines que existeixen (un test comprova que dades i
// fitxers de site/curs/ coincideixen): la feina a mitges va en branques,
// no amagada aquí.
//
// API pública:
//   CAPITOLS, REPTES, PARTS
//   courseSequence()          → pàgines en l'ordre del curs (cada repte
//                               just després del seu capítol afterChapter)
//   findPage(pagina, num)     → entrada de la seqüència o null
//   neighbours(pagina, num)   → { prev, next } (null als extrems)
//
// Capítol: { num, titol, arxiu, goalId, part }
// Repte:   { num, titol, arxiu, goalId, afterChapter, dificultat }
// Entrada de la seqüència: { pagina: 'capitol'|'repte', num, titol,
//                            arxiu, goalId, chapter }
//   chapter: capítol fins al qual s'ha ensenyat tot (el revisor de codi
//   només aplica aquestes regles)
// ════════════════════════════════════════════════════════

export const PARTS = {
  HTML: 'Part A · HTML',
  CSS: 'Part B · CSS',
};

export const CAPITOLS = [
  { num: 1, titol: 'Hola, HTML!', arxiu: 'capitol-1.html', goalId: 'cap-1-ex', part: 'HTML' },
  { num: 2, titol: 'Text amb significat', arxiu: 'capitol-2.html', goalId: 'cap-2-ex', part: 'HTML' },
  { num: 3, titol: 'Llistes', arxiu: 'capitol-3.html', goalId: 'cap-3-ex', part: 'HTML' },
  { num: 4, titol: 'Enllaços', arxiu: 'capitol-4.html', goalId: 'cap-4-ex', part: 'HTML' },
  { num: 5, titol: 'Imatges', arxiu: 'capitol-5.html', goalId: 'cap-5-ex', part: 'HTML' },
  { num: 6, titol: 'Estructura de la pàgina', arxiu: 'capitol-6.html', goalId: 'cap-6-ex', part: 'HTML' },
  { num: 7, titol: 'Taules', arxiu: 'capitol-7.html', goalId: 'cap-7-ex', part: 'HTML' },
  { num: 8, titol: 'Formularis', arxiu: 'capitol-8.html', goalId: 'cap-8-ex', part: 'HTML' },
  { num: 9, titol: 'Hola, CSS!', arxiu: 'capitol-9.html', goalId: 'cap-9-ex', part: 'CSS' },
  { num: 10, titol: 'Selectors i cascada', arxiu: 'capitol-10.html', goalId: 'cap-10-ex', part: 'CSS' },
];

export const REPTES = [];

/** @returns {Array<Object>} */
export function courseSequence() {
  const sequence = [];
  for (const capitol of CAPITOLS) {
    sequence.push({ pagina: 'capitol', ...capitol, chapter: capitol.num });
    for (const repte of REPTES.filter((r) => r.afterChapter === capitol.num)) {
      sequence.push({ pagina: 'repte', ...repte, chapter: repte.afterChapter });
    }
  }
  return sequence;
}

/**
 * @param {string} pagina 'capitol' | 'repte'
 * @param {number} num
 */
export function findPage(pagina, num) {
  return courseSequence().find((page) => page.pagina === pagina && page.num === num) || null;
}

/**
 * @param {string} pagina
 * @param {number} num
 * @returns {{ prev: Object|null, next: Object|null }}
 */
export function neighbours(pagina, num) {
  const sequence = courseSequence();
  const index = sequence.findIndex((page) => page.pagina === pagina && page.num === num);
  if (index === -1) return { prev: null, next: null };
  return { prev: sequence[index - 1] || null, next: sequence[index + 1] || null };
}
