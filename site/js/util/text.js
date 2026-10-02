// ════════════════════════════════════════════════════════
// util/text.js — Utilitats de text (mòdul pur)
//
// No toca document, window ni localStorage: es pot provar
// amb Node (tests/unit/text.test.mjs).
//
// API pública:
//   normalizeNewlines(text) — converteix \r\n i \r en \n
//   dedent(text)            — treu la indentació comuna i les
//                             línies buides del principi i del final
//   lineColAt(text, offset) — { line, col } (1-based) d'una posició
//   makeLineIndex(text)     — funció offset → { line, col } ràpida, per
//                             als analitzadors (cerca binària)
// ════════════════════════════════════════════════════════

/**
 * @param {string} text
 * @returns {string}
 */
export function normalizeNewlines(text) {
  return text.replace(/\r\n?/g, '\n');
}

/**
 * Treu la indentació comuna d'un bloc de codi escrit dins d'una pàgina
 * (p. ex. el codi inicial d'un simulador) i les línies buides dels extrems.
 * Només compta espais: les tabulacions no s'admeten al contingut del curs.
 * El resultat acaba sempre amb un salt de línia (o és buit).
 *
 * @param {string} text
 * @returns {string}
 */
export function dedent(text) {
  const lines = normalizeNewlines(text).split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  if (!lines.length) return '';

  const indents = lines
    .filter((line) => line.trim())
    .map((line) => line.match(/^ */)[0].length);
  const cut = Math.min(...indents);
  return lines.map((line) => line.slice(cut)).join('\n') + '\n';
}

/**
 * Línia i columna (començant per 1) d'una posició del text.
 * La posició es compta en unitats UTF-16, com textarea.selectionStart.
 *
 * @param {string} text
 * @param {number} offset
 * @returns {{ line: number, col: number }}
 */
export function lineColAt(text, offset) {
  const before = text.slice(0, Math.max(0, offset));
  const lastNewline = before.lastIndexOf('\n');
  return {
    line: before.split('\n').length,
    col: offset - lastNewline,
  };
}

/**
 * Prepara una funció que tradueix posicions a { line, col } (1-based)
 * sense recórrer el text cada vegada. Per als analitzadors, que en
 * calculen moltes.
 *
 * @param {string} text
 * @returns {(offset: number) => { line: number, col: number }}
 */
export function makeLineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return function at(offset) {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, col: offset - starts[lo] + 1 };
  };
}
