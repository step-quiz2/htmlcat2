// ════════════════════════════════════════════════════════
// lint/rules-css.js — Regles del revisor de codi per al CSS
// (mòdul pur)
//
// Mateix format que lint/rules-html.js, amb lang: 'css'. Les regles
// s'apliquen als fitxers .css i al contingut dels <style> de l'HTML,
// excepte les marcades amb embedded: false.
//
// Context: { src, sheet, supports, embedded, lineOf(pos) }
//   sheet     resultat de parseCss(src) (lang/css-parser.js)
//   supports  (propietat, valor) → boolean: al navegador és CSS.supports
//             (el navegador mateix diu què és vàlid); als tests, una
//             imitació. Si no n'hi ha, les regles que el necessiten no
//             fan res.
//   embedded  true si el CSS és dins d'un <style>
//
// API pública:
//   CSS_RULES
// ════════════════════════════════════════════════════════

import { CSS_PROPERTIES } from '../lang/css-spec.js';
import { KNOWN_ELEMENTS, DEPRECATED_ELEMENTS, CATALAN_TAGS, SVG_ELEMENTS } from '../lang/html-spec.js';
import { closest } from './suggest.js';
import { indentChecker } from './lines.js';

/** Noms en català que els alumnes escriuen a vegades com a propietat. */
const CATALAN_PROPERTIES = {
  'color-de-fons': 'background-color', fons: 'background', mida: 'font-size',
  'mida-lletra': 'font-size', lletra: 'font-family', alineacio: 'text-align',
  'alineació': 'text-align', vora: 'border', amplada: 'width', 'alçada': 'height',
  alcada: 'height', marge: 'margin', farciment: 'padding',
};

/** Colors en català → nom del color en CSS. */
const CATALAN_COLOURS = {
  vermell: 'red', blau: 'blue', verd: 'green', groc: 'yellow', negre: 'black',
  blanc: 'white', gris: 'gray', taronja: 'orange', rosa: 'pink', lila: 'violet',
  morat: 'purple', 'marró': 'brown', marro: 'brown', daurat: 'gold',
  platejat: 'silver', granat: 'maroon', turquesa: 'turquoise', beix: 'beige',
};

const BRACE_PROBLEMS = ['unclosed-block', 'unexpected-close-brace', 'missing-open-brace'];

// ── Ajudes ──

/** Regles amb declaracions (també les de dins d'un @media), en ordre. */
function* containers(list) {
  for (const rule of list) {
    if (rule.declarations) yield rule;
    if (rule.rules) yield* containers(rule.rules);
  }
}

/** Declaracions de regles d'estil (no les de @font-face, que són descriptors). */
function* styleDeclarations(sheet) {
  for (const rule of containers(sheet.rules)) {
    if (rule.type === 'style') yield* rule.declarations;
  }
}

const propertyName = (decl) => decl.property.text.toLowerCase().replace(/\s+/g, ' ');

// Un comentari mal escrit (// o <!--) fa que el navegador llegeixi el text com a
// codi: ja ho explica css/wrong-comment, i els altres missatges confondrien
const WRONG_COMMENT = /\/\/|<!--/;

/** El CSS amb els comentaris, les cadenes i els url(…) canviats per espais (mateixes posicions). */
function maskCss(src, sheet) {
  const blank = (text) => text.replace(/[^\n]/g, ' ');
  let masked = src;
  for (const c of sheet.comments) masked = masked.slice(0, c.start) + blank(masked.slice(c.start, c.end)) + masked.slice(c.end);
  return masked.replace(/"[^"\n]*"?|'[^'\n]*'?/g, blank).replace(/url\(\s*[^)]*\)?/gi, blank);
}

/** Regles d'estil (també les de dins d'un @media), sense els passos dels @keyframes (from, to, 50%). */
function* styleRules(list) {
  for (const rule of list) {
    if (rule.type === 'style') yield rule;
    if (rule.rules && !/keyframes$/i.test(rule.name || '')) yield* styleRules(rule.rules);
  }
}

// ── Errors de lang/css-parser.js ──

function fromParser(id, codes) {
  return {
    id,
    lang: 'css',
    since: 9,
    severity: 'error',
    check(ctx, report) {
      for (const problem of ctx.sheet.problems) {
        if (codes.includes(problem.code)) report(problem, { kind: problem.code, ...problem.data });
      }
    },
  };
}

// ── Propietats i valors (els valida el navegador) ──

const unknownProperty = {
  id: 'css/unknown-property',
  lang: 'css',
  since: 9,
  severity: 'error',
  check(ctx, report) {
    if (!ctx.supports) return;
    for (const decl of styleDeclarations(ctx.sheet)) {
      const property = propertyName(decl);
      if (!decl.value || !property || property.startsWith('-') || WRONG_COMMENT.test(property)) continue;   // --variables i -webkit-…
      if (ctx.supports(property, 'initial')) continue;
      const suggestion = CATALAN_PROPERTIES[property] || closest(property, CSS_PROPERTIES);
      report(decl.property, { property, suggestion });
    }
  },
};

// Per què no és vàlid? Els errors típics tenen un missatge propi.
function diagnoseValue(supports, property, value) {
  const colour = CATALAN_COLOURS[value.toLowerCase()];
  if (colour && supports(property, colour)) return { kind: 'catalan-colour', fix: colour };
  const dot = value.replace(/(\d),(\d)/g, '$1.$2');
  if (dot !== value && supports(property, dot)) return { kind: 'comma', fix: dot };
  const withUnits = dot.replace(/(^|\s)(-?(?:\d+\.?\d*|\.\d+))(?=\s|$)/g,
    (match, space, number) => space + (Number(number) === 0 ? number : number + 'px'));
  if (withUnits !== dot && supports(property, withUnits)) return { kind: 'unit', fix: withUnits };
  return { kind: 'generic' };
}

const invalidValue = {
  id: 'css/invalid-value',
  lang: 'css',
  since: 9,
  severity: 'error',
  check(ctx, report) {
    if (!ctx.supports) return;
    // Si falta un «;», el valor s'ha empassat la declaració següent: ja se n'avisa
    const swallowed = new Set(ctx.sheet.problems.filter((p) => p.code === 'missing-semicolon').map((p) => p.start));
    for (const decl of styleDeclarations(ctx.sheet)) {
      if (!decl.value || !decl.value.text || swallowed.has(decl.value.start)) continue;
      const property = propertyName(decl);
      if (property.startsWith('--') || !ctx.supports(property, 'initial')) continue;
      const value = decl.value.text;
      if (ctx.supports(property, value)) continue;
      report(decl.value, { property, value, ...diagnoseValue(ctx.supports, property, value) });
    }
  },
};

// ── Comentaris i selectors (capítol 9) ──

const wrongComment = {
  id: 'css/wrong-comment',
  lang: 'css',
  since: 9,
  severity: 'error',
  check(ctx, report) {
    const masked = maskCss(ctx.src, ctx.sheet);
    for (const match of masked.matchAll(/<!--|\/\//g)) {
      report({ start: match.index, end: match.index + match[0].length }, { kind: match[0] === '//' ? 'slash' : 'html' });
    }
  },
};

const unknownElementSelector = {
  id: 'css/unknown-element-selector',
  lang: 'css',
  since: 9,
  severity: 'warning',
  check(ctx, report) {
    for (const rule of styleRules(ctx.sheet.rules)) {
      for (const selector of rule.selectors) {
        if (WRONG_COMMENT.test(selector.text)) continue;
        // Fora el contingut de [...], (...) i les cadenes: hi pot haver noms que no són elements
        const blank = (text) => ' '.repeat(text.length);
        const text = selector.text.replace(/"[^"]*"|'[^']*'/g, blank).replace(/\[[^\]]*\]|\([^)]*\)/g, blank);
        // Un nom d'element va al començament d'un selector compost (no després de . # : ni d'un altre nom)
        for (const match of text.matchAll(/(^|[\s>+~])([a-zA-Z][\w-]*)/g)) {
          const name = match[2].toLowerCase();
          if (KNOWN_ELEMENTS.has(name) || DEPRECATED_ELEMENTS.has(name) || SVG_ELEMENTS.has(name) || name.includes('-')) continue;
          const start = selector.start + match.index + match[1].length;
          report({ start, end: start + name.length }, { name, suggestion: CATALAN_TAGS[name] || closest(name, KNOWN_ELEMENTS) });
        }
      }
    }
  },
};

// ── Codi net ──

const lastSemicolon = {
  id: 'css/last-semicolon',
  lang: 'css',
  since: 9,
  severity: 'warning',
  check(ctx, report) {
    for (const rule of containers(ctx.sheet.rules)) {
      const last = rule.declarations.at(-1);
      if (!last || last.semicolon || rule.close === -1 || !last.value || !last.value.text) continue;
      let end = last.end;
      while (end > last.start && /\s/.test(ctx.src[end - 1])) end--;
      report({ start: end, end }, { property: propertyName(last) });
    }
  },
};

const oneDeclarationPerLine = {
  id: 'css/one-declaration-per-line',
  lang: 'css',
  since: 9,
  severity: 'warning',
  check(ctx, report) {
    for (const rule of containers(ctx.sheet.rules)) {
      rule.declarations.forEach((decl, i) => {
        const previous = rule.declarations[i - 1];
        if (WRONG_COMMENT.test(decl.property.text)) return;
        if (previous && ctx.lineOf(previous.property.start) === ctx.lineOf(decl.property.start)) {
          report(decl.property, { property: propertyName(decl) });
        }
      });
    }
  },
};

/**
 * Les declaracions van 2 espais més a la dreta que la línia on comença
 * la regla, i la «}» s'alinea amb aquesta línia. Sempre respecte a la línia
 * tal com és, perquè un error no se n'emporti d'altres. Amb claus
 * desaparellades, l'estructura no és fiable: primer cal arreglar-les.
 */
const indentation = {
  id: 'css/indentation',
  lang: 'css',
  since: 9,
  severity: 'warning',
  embedded: false,
  check(ctx, report) {
    if (ctx.sheet.problems.some((p) => BRACE_PROBLEMS.includes(p.code))) return;
    const { width, expect } = indentChecker(ctx.src, report);

    function checkList(list, base) {
      for (const rule of list) {
        expect(rule, base);
        for (const selector of (rule.selectors || []).slice(1)) expect(selector, width(rule.start));
        const inner = width(rule.start) + 2;
        for (const decl of rule.declarations || []) expect(decl.property, inner);
        if (rule.rules) checkList(rule.rules, inner);
        if (rule.close !== -1) expect({ start: rule.close, end: rule.close + 1 }, width(rule.start), { close: true });
      }
    }
    checkList(ctx.sheet.rules, 0);
  },
};

/** Totes les regles de CSS, en l'ordre del catàleg (docs/STATE.md §2.6). */
export const CSS_RULES = [
  fromParser('css/unbalanced-braces', BRACE_PROBLEMS),
  fromParser('css/missing-semicolon', ['missing-semicolon']),
  fromParser('css/missing-colon', ['missing-colon']),
  fromParser('css/empty-value', ['empty-value']),
  fromParser('css/unclosed-comment', ['unclosed-comment']),
  fromParser('css/unclosed-string', ['unclosed-string']),
  unknownProperty,
  invalidValue,
  wrongComment,
  unknownElementSelector,
  lastSemicolon,
  oneDeclarationPerLine,
  indentation,
];
