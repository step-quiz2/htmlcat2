// ════════════════════════════════════════════════════════
// editor/editing.js — Lògica d'edició de l'editor (mòdul pur)
//
// Calcula QUÈ s'ha d'escriure quan l'alumne prem Retorn, Tab o
// Maj+Tab; editor.js ho aplica al <textarea> (amb Ctrl+Z funcionant).
// Separat del DOM perquè es pugui provar amb Node.
//
// Totes les funcions reben el text i la selecció i retornen una edició:
//   { from, to, insert, selStart, selEnd }
// que vol dir: substitueix text[from..to) per `insert` i deixa la
// selecció a [selStart, selEnd) (posicions del text nou).
//
// API pública:
//   INDENT                                  '  ' (2 espais: un nivell)
//   newlineEdit(text, pos, lang)            Retorn amb indentació automàtica
//   indentEdit(text, selStart, selEnd)      Tab
//   dedentEdit(text, selStart, selEnd)      Maj+Tab
// ════════════════════════════════════════════════════════

import { VOID_ELEMENTS } from '../lang/html-spec.js';

export const INDENT = '  ';

const lineStartOf = (text, pos) => text.lastIndexOf('\n', pos - 1) + 1;

function lineEndOf(text, pos) {
  const end = text.indexOf('\n', pos);
  return end === -1 ? text.length : end;
}

// La línia acaba (abans del cursor) amb una etiqueta d'obertura
// d'un element que no és buit ni es tanca a la mateixa línia
function opensHtmlBlock(before) {
  const match = /<([a-zA-Z][\w-]*)(?:\s[^<>]*)?>\s*$/.exec(before);
  if (!match || /\/>\s*$/.test(before)) return false;
  return !VOID_ELEMENTS.has(match[1].toLowerCase());
}

/**
 * Retorn: la línia nova manté la indentació i n'afegeix un nivell després
 * d'una etiqueta d'obertura (HTML) o d'una «{» (CSS). Si el cursor és
 * entre l'obertura i el tancament (<li>|</li>, {|}), el tancament baixa a
 * una línia pròpia.
 *
 * @param {string} text
 * @param {number} pos posició del cursor
 * @param {'html'|'css'} lang
 */
export function newlineEdit(text, pos, lang) {
  const lineStart = lineStartOf(text, pos);
  const before = text.slice(lineStart, pos);
  const after = text.slice(pos, lineEndOf(text, pos));
  const indent = /^ */.exec(before)[0];

  const opens = lang === 'css' ? /\{\s*$/.test(before) : opensHtmlBlock(before);
  if (!opens) {
    const insert = '\n' + indent;
    return { from: pos, to: pos, insert, selStart: pos + insert.length, selEnd: pos + insert.length };
  }

  const inner = '\n' + indent + INDENT;
  const closesRightAfter = lang === 'css' ? /^\s*\}/.test(after) : /^\s*<\//.test(after);
  const insert = closesRightAfter ? inner + '\n' + indent : inner;
  const caret = pos + inner.length;
  return { from: pos, to: pos, insert, selStart: caret, selEnd: caret };
}

/**
 * Tab: sense selecció (o dins d'una línia), espais fins al nivell següent;
 * amb diverses línies seleccionades, un nivell més a totes.
 */
export function indentEdit(text, selStart, selEnd) {
  const multiline = text.slice(selStart, selEnd).includes('\n');
  if (!multiline) {
    const col = selStart - lineStartOf(text, selStart);
    const insert = ' '.repeat(INDENT.length - (col % INDENT.length));
    const caret = selStart + insert.length;
    return { from: selStart, to: selEnd, insert, selStart: caret, selEnd: caret };
  }

  const from = lineStartOf(text, selStart);
  const to = text[selEnd - 1] === '\n' ? selEnd - 1 : lineEndOf(text, selEnd);
  const insert = text.slice(from, to).split('\n')
    .map((line) => (line.trim() ? INDENT + line : line))
    .join('\n');
  return { from, to, insert, selStart: from, selEnd: from + insert.length };
}

/**
 * Maj+Tab: treu un nivell (fins a 2 espais) de la línia del cursor o de
 * totes les línies seleccionades.
 */
export function dedentEdit(text, selStart, selEnd) {
  const from = lineStartOf(text, selStart);
  const to = selEnd > selStart && text[selEnd - 1] === '\n' ? selEnd - 1 : lineEndOf(text, selEnd);
  const lines = text.slice(from, to).split('\n');
  const removedFirst = /^ {0,2}/.exec(lines[0])[0].length;
  const insert = lines.map((line) => line.replace(/^ {1,2}/, '')).join('\n');

  if (selStart === selEnd || !text.slice(selStart, selEnd).includes('\n')) {
    const caretStart = Math.max(from, selStart - removedFirst);
    const caretEnd = Math.max(from, selEnd - removedFirst);
    return { from, to, insert, selStart: caretStart, selEnd: caretEnd };
  }
  return { from, to, insert, selStart: from, selEnd: from + insert.length };
}
