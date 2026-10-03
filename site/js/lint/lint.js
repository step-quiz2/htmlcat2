// ════════════════════════════════════════════════════════
// lint/lint.js — El revisor de codi: «el navegador perdona,
// HTMLCat t'ho explica» (mòdul pur)
//
// Executa les regles actives sobre els fitxers de l'alumne i retorna
// la llista de problemes amb el text en català. Les regles s'activen
// per capítol (rule.since <= chapter: mai no es critica el que encara
// no s'ha ensenyat) i per mode (les de document sencer, només en mode
// 'document'). L'editor lliure les activa totes.
//
// Fitxers .css: regles de CSS. Fitxers .html: regles d'HTML, i les de
// CSS al contingut de cada <style> (excepte embedded: false).
//
// API pública:
//   RULES                                    totes les regles
//   activeRules({ chapter, mode })           les que s'apliquen
//   lintStatic({ files, mode, chapter, env }) → Problem[] (ordenats)
//   summarize(problems, max?)                → { entries, counts, hidden }
//
// env: { supports(prop, value) } (al navegador, CSS.supports)
// Problem: { file, rule, severity, start, end, line, col, data, text, hint }
//   start/end: posicions al fitxer (com textarea.selectionStart)
// Ordre: errors, avisos i suggeriments; dins de cada grup, per fitxer i línia.
// ════════════════════════════════════════════════════════

import { makeLineIndex } from '../util/text.js';
import { tokenizeHtml } from '../lang/html-tokenizer.js';
import { buildSourceTree } from '../lang/html-model.js';
import { parseCss } from '../lang/css-parser.js';
import { HTML_RULES } from './rules-html.js';
import { CSS_RULES } from './rules-css.js';
import { describe } from './messages.ca.js';

export const RULES = [...HTML_RULES, ...CSS_RULES];

export const SEVERITIES = ['error', 'warning', 'info'];

/**
 * @param {{ chapter?: number, mode?: 'fragment'|'document' }} [options]
 */
export function activeRules({ chapter = Infinity, mode = 'fragment' } = {}) {
  return RULES.filter((rule) => rule.since <= chapter && (!rule.mode || rule.mode === mode));
}

/**
 * @param {{ files: Record<string,string>, mode?: 'fragment'|'document',
 *           chapter?: number, env?: { supports?: Function } }} options
 * @returns {Array<Object>}
 */
export function lintStatic({ files, mode = 'fragment', chapter = Infinity, env = {} }) {
  const rules = activeRules({ chapter, mode });
  const htmlRules = rules.filter((rule) => rule.lang === 'html');
  const cssRules = rules.filter((rule) => rule.lang === 'css');
  const problems = [];

  Object.keys(files).forEach((file, fileIndex) => {
    const src = files[file];
    const at = makeLineIndex(src);
    const reporter = (rule, offset) => (range, data = {}) => {
      const start = range.start + offset;
      const end = Math.max(range.end + offset, start);
      problems.push({
        file, fileIndex, rule: rule.id, severity: rule.severity,
        start, end, ...at(start), data, ...describe(rule.id, data),
      });
    };
    const lintCss = (css, offset, embedded) => {
      const lineOf = makeLineIndex(css);
      const ctx = { src: css, sheet: parseCss(css), supports: env.supports || null, embedded, lineOf: (pos) => lineOf(pos).line };
      for (const rule of cssRules) {
        if (!(embedded && rule.embedded === false)) rule.check(ctx, reporter(rule, offset));
      }
    };

    if (file.endsWith('.css')) {
      lintCss(src, 0, false);
      return;
    }
    const tokens = tokenizeHtml(src);
    const { root, problems: structure } = buildSourceTree(src, tokens);
    const ctx = { src, tokens, root, structure, mode, fileNames: Object.keys(files), lineOf: (pos) => at(pos).line };
    for (const rule of htmlRules) rule.check(ctx, reporter(rule, 0));

    // CSS de dins dels <style> (un text «raw» sempre ve just després de la seva etiqueta)
    tokens.forEach((token, i) => {
      if (token.raw && tokens[i - 1].name === 'style') lintCss(src.slice(token.start, token.end), token.start, true);
    });
  });

  return problems.sort((a, b) =>
    SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
    a.fileIndex - b.fileIndex || a.start - b.start);
}

/**
 * Prepara la llista per al panell ⚠ Problemes: com a molt `max` entrades.
 * Els errors es mostren tots, d'un en un; els avisos i suggeriments
 * repetits (mateixa regla i fitxer) s'agrupen en una sola entrada
 * («i 4 més com aquest»).
 *
 * @param {Array<Object>} problems ordenats (com els retorna lintStatic)
 * @param {number} [max]
 * @returns {{ entries: Array<{ problem: Object, more: number }>,
 *             counts: { error: number, warning: number, info: number },
 *             hidden: number }}
 *   hidden: entrades que no hi caben
 */
export function summarize(problems, max = 10) {
  const counts = { error: 0, warning: 0, info: 0 };
  const entries = [];
  const groups = new Map();
  for (const problem of problems) {
    counts[problem.severity]++;
    const key = `${problem.rule}\n${problem.file}`;
    if (problem.severity !== 'error' && groups.has(key)) {
      groups.get(key).more++;
      continue;
    }
    const entry = { problem, more: 0 };
    groups.set(key, entry);
    entries.push(entry);
  }
  return { entries: entries.slice(0, max), counts, hidden: Math.max(0, entries.length - max) };
}
