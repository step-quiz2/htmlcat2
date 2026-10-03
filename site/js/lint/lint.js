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
// Les regles de CSS reben també tots els fulls d'estil del simulador i les
// variables (--nom) de tot el CSS.
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

  // L'HTML s'analitza un sol cop: les regles de CSS també necessiten saber
  // quines classes i quins id hi ha a la pàgina
  const parsed = new Map();
  for (const file of Object.keys(files).filter((name) => !name.endsWith('.css'))) {
    const tokens = tokenizeHtml(files[file]);
    parsed.set(file, { tokens, ...buildSourceTree(files[file], tokens) });
  }
  const page = parsed.size ? pageNames([...parsed.values()]) : null;

  // Tot el CSS (fitxers i <style>) s'analitza un sol cop: les variables
  // (--nom) es poden definir en un lloc i fer servir en un altre
  const sheets = new Map();   // fitxer → [{ css, offset, sheet }]
  Object.keys(files).forEach((file) => {
    const sources = file.endsWith('.css') ? [{ css: files[file], offset: 0 }] : styleContents(parsed.get(file).tokens, files[file]);
    sheets.set(file, sources.map((source) => ({ ...source, sheet: parseCss(source.css) })));
  });
  const allSheets = [...sheets.values()].flat().map((source) => source.sheet);
  const variables = customProperties(allSheets);

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
    const lintCss = ({ css, offset, sheet }, embedded) => {
      const lineOf = makeLineIndex(css);
      const ctx = { src: css, sheet, sheets: allSheets, supports: env.supports || null, embedded, page, variables, lineOf: (pos) => lineOf(pos).line };
      for (const rule of cssRules) {
        if (!(embedded && rule.embedded === false)) rule.check(ctx, reporter(rule, offset));
      }
    };

    if (file.endsWith('.css')) {
      lintCss(sheets.get(file)[0], false);
      return;
    }
    const { tokens, root, problems: structure } = parsed.get(file);
    const ctx = { src, tokens, root, structure, mode, fileNames: Object.keys(files), lineOf: (pos) => at(pos).line };
    for (const rule of htmlRules) rule.check(ctx, reporter(rule, 0));
    for (const source of sheets.get(file)) lintCss(source, true);
  });

  return problems.sort((a, b) =>
    SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
    a.fileIndex - b.fileIndex || a.start - b.start);
}

/** El CSS de dins dels <style> (un text «raw» sempre ve just després de la seva etiqueta). */
function styleContents(tokens, src) {
  return tokens.filter((token, i) => token.raw && tokens[i - 1].name === 'style')
    .map((token) => ({ css: src.slice(token.start, token.end), offset: token.start }));
}

/**
 * Les variables (propietats --nom) definides en qualsevol regla, amb tots
 * els valors que se'ls donen. Els noms distingeixen majúscules.
 *
 * @returns {Map<string, string[]>}
 */
function customProperties(sheets) {
  const variables = new Map();
  const visit = (list) => {
    for (const rule of list) {
      for (const decl of rule.declarations || []) {
        const name = decl.property.text.trim();
        if (!name.startsWith('--') || !decl.value) continue;
        if (!variables.has(name)) variables.set(name, []);
        variables.get(name).push(decl.value.text.trim());
      }
      if (rule.rules) visit(rule.rules);
    }
  };
  for (const sheet of sheets) visit(sheet.rules);
  return variables;
}

/**
 * Les classes i els id que apareixen a l'HTML (tal com són), i les classes
 * escrites amb puntuació (class=".avis", class="avis, gran") sense la
 * puntuació: d'aquestes ja n'avisa html/class-syntax.
 *
 * També, per a cada classe, de quins elements és (classElements).
 *
 * @returns {{ classes: Set<string>, ids: Set<string>, misspelt: Set<string>,
 *             classElements: Map<string, Set<string>> }}
 */
function pageNames(documents) {
  const classes = new Set();
  const ids = new Set();
  const misspelt = new Set();
  const classElements = new Map();
  for (const { tokens } of documents) {
    for (const token of tokens) {
      if (token.type !== 'startTag') continue;
      for (const attr of token.attrs) {
        const value = attr.value || '';
        if (attr.name === 'id' && value.trim()) ids.add(value.trim());
        if (attr.name !== 'class') continue;
        for (const name of value.split(/\s+/).filter(Boolean)) {
          classes.add(name);
          if (!classElements.has(name)) classElements.set(name, new Set());
          classElements.get(name).add(token.name);
          const bare = name.replace(/^[.#]+|,/g, '');
          if (bare !== name && bare) misspelt.add(bare);
        }
      }
    }
  }
  return { classes, ids, misspelt, classElements };
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
