// ════════════════════════════════════════════════════════
// lint/rules-css.js — Regles del revisor de codi per al CSS
// (mòdul pur)
//
// Mateix format que lint/rules-html.js, amb lang: 'css'. Les regles
// s'apliquen als fitxers .css i al contingut dels <style> de l'HTML,
// excepte les marcades amb embedded: false.
//
// Context: { src, sheet, supports, embedded, page, lineOf(pos) }
//   sheet     resultat de parseCss(src) (lang/css-parser.js)
//   supports  (propietat, valor) → boolean: al navegador és CSS.supports
//             (el navegador mateix diu què és vàlid); als tests, una
//             imitació. Si no n'hi ha, les regles que el necessiten no
//             fan res.
//   embedded  true si el CSS és dins d'un <style>
//   page      { classes, ids, misspelt } de l'HTML del simulador, o null si
//             no n'hi ha (lint/lint.js)
//   variables Map --nom → [valors] de tot el CSS del simulador (fitxers i
//             <style>), per saber si una variable existeix i què val
//   sheets    tots els fulls d'estil del simulador (fitxers i <style>), ja
//             analitzats, per a les regles que han de mirar més enllà del full
//
// API pública:
//   CSS_RULES
// ════════════════════════════════════════════════════════

import { CSS_PROPERTIES } from '../lang/css-spec.js';
import { KNOWN_ELEMENTS, DEPRECATED_ELEMENTS, CATALAN_TAGS, SVG_ELEMENTS } from '../lang/html-spec.js';
import { parseColor, contrastRatio } from '../lang/css-colors.js';
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

/** Paraules clau en català (o mig en anglès) → la paraula del CSS. */
const CATALAN_KEYWORDS = {
  centre: 'center', centrat: 'center', centrada: 'center', centrar: 'center', esquerra: 'left',
  dreta: 'right', justificat: 'justify', justificar: 'justify', negreta: 'bold', cursiva: 'italic',
  subratllat: 'underline', 'majúscules': 'uppercase', majuscules: 'uppercase',
  'minúscules': 'lowercase', minuscules: 'lowercase', 'sòlid': 'solid', solida: 'solid',
  'sòlida': 'solid', discontinu: 'dashed', puntejat: 'dotted', cap: 'none', bloc: 'block',
};

/** Propietats que admeten 1, 2, 3 o 4 valors (dalt, dreta, baix, esquerra). */
const FOUR_SIDES = new Set(['margin', 'padding', 'border-width', 'border-style', 'border-color', 'inset']);

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
  const works = (fix) => fix !== value && supports(property, fix);
  const colour = CATALAN_COLOURS[value.toLowerCase()];
  if (colour && supports(property, colour)) return { kind: 'catalan-colour', fix: colour };
  const english = value.replace(/[\p{L}-]+/gu, (word) => CATALAN_KEYWORDS[word.toLowerCase()] || CATALAN_COLOURS[word.toLowerCase()] || word);
  if (works(english)) return { kind: 'catalan-keyword', fix: english };
  const dot = value.replace(/(\d),(\d)/g, '$1.$2');
  if (works(dot)) return { kind: 'comma', fix: dot };
  const spaced = dot.replace(/\s*,\s*/g, ' ');
  if (works(spaced)) return { kind: 'list-comma', fix: spaced };
  const joined = dot.replace(/(\d)\s+(px|r?em|%|vw|vh|pt|ch|deg)(?![\w-])/gi, '$1$2');
  if (works(joined)) return { kind: 'unit-space', fix: joined };
  const withUnits = dot.replace(/(^|\s)(-?(?:\d+\.?\d*|\.\d+))(?=\s|$)/g,
    (match, space, number) => space + (Number(number) === 0 ? number : number + 'px'));
  if (works(withUnits)) return { kind: 'unit', fix: withUnits };
  const positive = dot.replace(/(^|\s)-(?=[\d.])/g, '$1');
  if (works(positive)) return { kind: 'negative', fix: positive };
  const parts = dot.split(/\s+/).filter(Boolean);
  if (FOUR_SIDES.has(property) && parts.length > 4) return { kind: 'too-many', count: parts.length };
  const hashed = value.replace(/(^|[\s,(])((?:[0-9a-f]{3}){1,2}|(?:[0-9a-f]{4}){1,2})(?=$|[\s,)])/gi, '$1#$2');
  if (works(hashed)) return { kind: 'hash', fix: hashed };
  const hex = /#([0-9a-z]*)/i.exec(value);
  if (hex && !(/^[0-9a-f]+$/i.test(hex[1]) && [3, 4, 6, 8].includes(hex[1].length))) {
    return { kind: 'hex', hex: hex[0], digits: hex[1].length, letters: !/^[0-9a-f]*$/i.test(hex[1]) };
  }
  const wrapped = value.replace(/(var\(\s*)?(--[\w-]+)/g, (match, inside, name) => inside ? match : `var(${name})`);
  if (works(wrapped)) return { kind: 'var', fix: wrapped };
  const dashed = value.replace(/var\(\s*(?=[a-z])/gi, 'var(--');
  if (works(dashed)) return { kind: 'var-dashes', fix: dashed };
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

// ── Selectors i cascada (capítol 10) ──

/** Les classes (.nom) i els id (#nom) d'un selector, amb la seva posició; no mira dins de [...], (...) ni cadenes. */
function* namedSelectors(selector) {
  const blank = (text) => ' '.repeat(text.length);
  const text = selector.text.replace(/"[^"]*"|'[^']*'/g, blank).replace(/\[[^\]]*\]|\([^)]*\)/g, blank);
  for (const match of text.matchAll(/([.#])(-?[_a-zA-Z\u00a0-\uffff][\w\u00a0-\uffff-]*)/g)) {
    const start = selector.start + match.index;
    yield { kind: match[1] === '.' ? 'class' : 'id', name: match[2], start, end: start + match[0].length };
  }
}

function* selectorsOf(sheet) {
  for (const rule of styleRules(sheet.rules)) {
    for (const selector of rule.selectors) {
      if (!WRONG_COMMENT.test(selector.text)) yield selector;
    }
  }
}

// Es fa sobre el codi font (el BLUEPRINT la preveia sobre la pàgina pintada):
// si un selector demana una classe o un id que cap element no té, no
// selecciona res. Els selectors d'elements que no existeixen els mira
// css/unknown-element-selector.
const selectorMatchesNothing = {
  id: 'css/selector-matches-nothing',
  lang: 'css',
  since: 10,
  severity: 'warning',
  check(ctx, report) {
    if (!ctx.page) return;
    const { classes, ids, misspelt } = ctx.page;
    for (const selector of selectorsOf(ctx.sheet)) {
      for (const named of namedSelectors(selector)) {
        const known = named.kind === 'class' ? classes : ids;
        if (known.has(named.name) || (named.kind === 'class' && misspelt.has(named.name))) continue;
        report(named, { kind: named.kind, name: named.name, suggestion: closest(named.name, known) });
      }
    }
  },
};

const idSelector = {
  id: 'css/id-selector',
  lang: 'css',
  since: 10,
  severity: 'warning',
  check(ctx, report) {
    for (const selector of selectorsOf(ctx.sheet)) {
      for (const named of namedSelectors(selector)) {
        if (named.kind === 'id') report(named, { name: named.name });
      }
    }
  },
};

const important = {
  id: 'css/important',
  lang: 'css',
  since: 10,
  severity: 'warning',
  check(ctx, report) {
    for (const decl of styleDeclarations(ctx.sheet)) {
      if (!decl.important) continue;
      const at = ctx.src.lastIndexOf('!', decl.end);
      report(at >= decl.start ? { start: at, end: decl.end } : decl.property, { property: propertyName(decl) });
    }
  },
};

const duplicateDeclaration = {
  id: 'css/duplicate-declaration',
  lang: 'css',
  since: 10,
  severity: 'warning',
  check(ctx, report) {
    for (const rule of containers(ctx.sheet.rules)) {
      const seen = new Map();   // propietat → la primera declaració
      for (const decl of rule.declarations) {
        const property = propertyName(decl);
        if (!property || !decl.value || WRONG_COMMENT.test(property)) continue;
        const first = seen.get(property);
        if (!first) seen.set(property, decl);
        // (si la primera porta !important, guanya ella: ja ho diu css/important)
        else if (!first.important || decl.important) report(decl.property, { property, firstLine: ctx.lineOf(first.property.start) });
      }
    }
  },
};

/** Paraules que diuen com es veu un element, no què és (en minúscules, sense accents). */
const PRESENTATIONAL_WORDS = new Set([
  // colors en català i en anglès
  'vermell', 'vermella', 'blau', 'blava', 'verd', 'verda', 'groc', 'groga', 'taronja', 'lila', 'morat',
  'morada', 'rosa', 'negre', 'negra', 'blanc', 'blanca', 'gris', 'grisa', 'marro', 'daurat', 'daurada',
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'black', 'white', 'gray', 'grey',
  'brown', 'gold', 'teal', 'navy', 'maroon', 'violet', 'cyan', 'magenta', 'lime', 'olive', 'silver',
  // mides, gruixos i posicions
  'gran', 'petit', 'petita', 'gros', 'grossa', 'negreta', 'cursiva', 'subratllat', 'subratllada',
  'centrat', 'centrada', 'esquerra', 'dreta', 'big', 'small', 'large', 'bold', 'italic', 'underline',
  'center', 'centre', 'left', 'right',
]);

const plain = (text) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const presentationalClass = {
  id: 'css/presentational-class',
  lang: 'css',
  since: 10,
  severity: 'info',
  check(ctx, report) {
    for (const selector of selectorsOf(ctx.sheet)) {
      for (const named of namedSelectors(selector)) {
        if (named.kind === 'class' && plain(named.name).split(/[-_]/).some((word) => PRESENTATIONAL_WORDS.has(word))) {
          report(named, { name: named.name });
        }
      }
    }
  },
};

// ── Colors, lletra i variables (capítol 11) ──

const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong']);
const CSS_WIDE_KEYWORDS = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

/** Lletres conegudes que no són de pal sec (sans-serif): la genèrica que s'hi assembla. */
const FONT_GENERIC = {
  georgia: 'serif', times: 'serif', 'times new roman': 'serif', garamond: 'serif', palatino: 'serif',
  'palatino linotype': 'serif', 'book antiqua': 'serif', cambria: 'serif', baskerville: 'serif',
  courier: 'monospace', 'courier new': 'monospace', consolas: 'monospace', monaco: 'monospace',
  menlo: 'monospace', 'lucida console': 'monospace', 'comic sans ms': 'cursive',
};

const unquote = (name) => name.trim().replace(/^(["'])(.*)\1$/, '$2');

const genericFontFamily = {
  id: 'css/generic-font-family',
  lang: 'css',
  since: 11,
  severity: 'warning',
  check(ctx, report) {
    for (const decl of styleDeclarations(ctx.sheet)) {
      if (propertyName(decl) !== 'font-family' || !decl.value || !decl.value.text.trim()) continue;
      const value = decl.value.text.trim();
      if (CSS_WIDE_KEYWORDS.has(value.toLowerCase()) || /var\(/i.test(value) || WRONG_COMMENT.test(value)) continue;
      const families = value.split(',');
      const last = families.at(-1).trim();
      if (GENERIC_FAMILIES.has(last.toLowerCase())) continue;
      const family = unquote(last);
      if (GENERIC_FAMILIES.has(family.toLowerCase())) {   // entre cometes ("serif") ja no és la genèrica
        report(decl.value, { family, quoted: true, fix: [...families.slice(0, -1), ` ${family}`].join(',').trim() });
        continue;
      }
      const suggestion = FONT_GENERIC[unquote(families[0]).toLowerCase()] || 'sans-serif';
      report(decl.value, { family, value, suggestion });
    }
  },
};

const VAR_CALL = /var\(\s*(--[\w-]+)\s*([,)]?)/gi;

/**
 * El valor d'una variable, si se sap segur: definida un sol cop (o sempre
 * amb el mateix valor) o, si no existeix, el valor de reserva. Si no, null.
 */
function resolveVariables(value, variables, depth = 0) {
  const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+?))?\s*\)$/i.exec(value.trim());
  if (!m) return value.trim();
  if (depth > 5) return null;
  const values = variables.get(m[1]);
  if (values && new Set(values).size === 1) return resolveVariables(values[0], variables, depth + 1);
  if (!values && m[2]) return resolveVariables(m[2], variables, depth + 1);
  return null;
}

const undefinedVariable = {
  id: 'css/undefined-variable',
  lang: 'css',
  since: 11,
  severity: 'error',
  check(ctx, report) {
    for (const rule of containers(ctx.sheet.rules)) {
      for (const decl of rule.declarations) {
        if (!decl.value) continue;
        for (const match of decl.value.text.matchAll(VAR_CALL)) {
          const name = match[1];
          if (match[2] === ',' || ctx.variables.has(name)) continue;   // amb valor de reserva, no cal que existeixi
          const known = [...ctx.variables.keys()];
          const suggestion = known.find((other) => other.toLowerCase() === name.toLowerCase()) || closest(name, known);
          const start = decl.value.start + match.index + match[0].indexOf(name);
          report({ start, end: start + name.length }, { name, suggestion });
        }
      }
    }
  },
};

// Es fa sobre el codi font (el BLUEPRINT la preveia sobre la pàgina pintada):
// només quan el color del text i el del fons són a la mateixa regla, que és
// quan se sap segur que van junts
const lowContrast = {
  id: 'css/low-contrast',
  lang: 'css',
  since: 11,
  severity: 'warning',
  check(ctx, report) {
    for (const rule of styleRules(ctx.sheet.rules)) {
      let text = null;
      let background = null;
      for (const decl of rule.declarations) {
        const property = propertyName(decl);
        if (!decl.value) continue;
        if (property === 'color') text = decl;
        if (property === 'background-color' || property === 'background') background = decl;
      }
      if (!text || !background) continue;
      const values = [text, background].map((decl) => resolveVariables(decl.value.text, ctx.variables));
      const colors = values.map((value) => value && parseColor(value));
      if (colors.includes(null) || colors.some((c) => c[3] < 1)) continue;   // transparent: depèn del que hi ha a sota
      const ratio = contrastRatio(colors[0], colors[1]);
      if (ratio >= 4.5) continue;
      // (arrodonit cap avall: 4,48 és «4,4», que no arriba a 4,5)
      report(text.value, { ratio: (Math.floor(ratio * 10) / 10).toFixed(1).replace('.', ','), color: values[0], background: values[1] });
    }
  },
};

/** Colors escrits amb #, rgb() o hsl() (els noms, com white, no compten). */
const COLOR_LITERAL = /#[0-9a-f]{3,8}(?![\w-])|\b(?:rgba?|hsla?)\([^)]*\)/gi;

const repeatedColor = {
  id: 'css/repeated-color',
  lang: 'css',
  since: 11,
  severity: 'warning',
  check(ctx, report) {
    const seen = new Map();   // color (r,g,b,a) → aparicions
    for (const decl of styleDeclarations(ctx.sheet)) {
      if (!decl.value || propertyName(decl).startsWith('--')) continue;   // definir la variable és el que cal fer
      for (const match of decl.value.text.matchAll(COLOR_LITERAL)) {
        const color = parseColor(match[0]);
        if (!color) continue;
        const key = color.join();
        if (!seen.has(key)) seen.set(key, []);
        const start = decl.value.start + match.index;
        seen.get(key).push({ start, end: start + match[0].length, text: match[0] });
      }
    }
    for (const places of seen.values()) {
      if (places.length < 3) continue;
      report(places[2], { color: places[0].text, count: places.length, firstLine: ctx.lineOf(places[0].start) });
    }
  },
};

// ── El model de caixa (capítol 12) ──

const BORDER_STYLES = new Set(['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset']);
const BORDER_SHORTHANDS = new Set(['border', 'border-top', 'border-right', 'border-bottom', 'border-left']);
const isWidthWord = (word) => /^(thin|medium|thick|-?(\d+\.?\d*|\.\d+)[a-z%]*)$/i.test(word);

// border: 2px red és vàlid, però sense estil (solid, dashed…) el navegador no dibuixa la vora
const borderWithoutStyle = {
  id: 'css/border-without-style',
  lang: 'css',
  since: 12,
  severity: 'warning',
  check(ctx, report) {
    for (const rule of containers(ctx.sheet.rules)) {
      rule.declarations.forEach((decl, i) => {
        const property = propertyName(decl);
        if (!BORDER_SHORTHANDS.has(property) || !decl.value) return;
        const value = decl.value.text.trim();
        const words = value.toLowerCase().split(/\s+/).filter(Boolean);
        if (!words.length || words.some((word) => BORDER_STYLES.has(word)) || value === '0') return;
        if (CSS_WIDE_KEYWORDS.has(value.toLowerCase()) || /var\(/i.test(value) || WRONG_COMMENT.test(value)) return;
        if (ctx.supports && !ctx.supports(property, value)) return;   // ja ho diu css/invalid-value
        // (si més avall, a la mateixa regla, es posa l'estil, sí que es veu)
        if (rule.declarations.slice(i + 1).some((later) => /^border(-(top|right|bottom|left))?-style$/.test(propertyName(later)))) return;
        const at = value.split(/\s+/).findIndex(isWidthWord);
        const fixWords = value.split(/\s+/);
        fixWords.splice(at + 1, 0, 'solid');
        report(decl.value, { property, value, fix: fixWords.join(' ') });
      });
    }
  },
};

/** Elements en línia que no són imatges ni camps: no tenen amplada ni alçada. */
const INLINE_ELEMENTS = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd',
  'label', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var']);
const SIZE_PROPERTIES = new Set(['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height']);

/** L'element que tria un selector (el de l'última part: «nav a» → a), o null. */
function subjectElement(selector) {
  const text = selector.text.replace(/"[^"]*"|'[^']*'/g, '').replace(/\[[^\]]*\]|\([^)]*\)/g, '');
  const last = text.trim().split(/\s*[\s>+~]\s*/).at(-1);
  const m = /^([a-zA-Z][\w-]*)/.exec(last);
  return m ? m[1].toLowerCase() : null;
}

/** El valor que una regla dona a una propietat (l'últim), o null. */
const valueOf = (rule, property) => rule.declarations.filter((d) => propertyName(d) === property && d.value).at(-1)?.value.text.trim().toLowerCase() ?? null;

// Els marges de dalt i de baix d'un «margin» (1 a 4 valors: dalt, dreta, baix, esquerra)
function verticalMargins(value) {
  const parts = value.trim().split(/\s+/);
  return [parts[0], parts[parts.length > 2 ? 2 : 0]];
}
const isZero = (word) => /^-?(0+\.?0*|\.0+)[a-z%]*$/i.test(word);

const inlineDimensions = {
  id: 'css/inline-dimensions',
  lang: 'css',
  since: 12,
  severity: 'warning',
  check(ctx, report) {
    // Elements que alguna regla (de qualsevol full) ja treu de la línia: no es pot saber segur
    const displayed = new Set();
    for (const sheet of ctx.sheets) {
      for (const rule of styleRules(sheet.rules)) {
        const display = valueOf(rule, 'display');
        const out = (display && display !== 'inline') || (valueOf(rule, 'float') ?? 'none') !== 'none' ||
          /^(absolute|fixed)$/.test(valueOf(rule, 'position') || '');
        if (out) rule.selectors.forEach((selector) => displayed.add(subjectElement(selector)));
      }
    }
    for (const rule of styleRules(ctx.sheet.rules)) {
      const elements = rule.selectors.map(subjectElement);
      if (!elements.length || !elements.every((name) => INLINE_ELEMENTS.has(name) && !displayed.has(name))) continue;
      for (const decl of rule.declarations) {
        const property = propertyName(decl);
        if (!decl.value || /var\(/i.test(decl.value.text)) continue;
        const value = decl.value.text.trim();
        const element = elements[0];
        if (SIZE_PROPERTIES.has(property) && !/^(auto|none|initial|inherit|unset)$/i.test(value)) {
          report(decl.property, { property, element, kind: 'size' });
        } else if ((property === 'margin-top' || property === 'margin-bottom') && !isZero(value)) {
          report(decl.property, { property, element, kind: 'margin' });
        } else if (property === 'margin' && verticalMargins(value).some((word) => !isZero(word) && word !== 'auto')) {
          report(decl.property, { property, element, kind: 'margin' });
        }
      }
    }
  },
};

/** Si una drecera (margin, border, font…) dona valor a una propietat. */
function covers(shorthand, property) {
  if (property === shorthand || property.includes('radius')) return false;
  switch (shorthand) {
    case 'margin':
    case 'padding': return new RegExp(`^${shorthand}-(top|right|bottom|left)$`).test(property);
    case 'border': return property.startsWith('border-') && !/^border-(collapse|spacing)$/.test(property);
    case 'border-top':
    case 'border-right':
    case 'border-bottom':
    case 'border-left': return property.startsWith(shorthand + '-');
    case 'border-width':
    case 'border-style':
    case 'border-color': return new RegExp(`^border-(top|right|bottom|left)-${shorthand.slice(7)}$`).test(property);
    case 'background':
    case 'list-style':
    case 'text-decoration': return property.startsWith(shorthand + '-');
    case 'font': return /^(font-(size|family|weight|style|variant|stretch)|line-height)$/.test(property);
    case 'flex': return /^flex-(grow|shrink|basis)$/.test(property);
    case 'gap': return property === 'row-gap' || property === 'column-gap';
    case 'outline': return /^outline-(width|style|color)$/.test(property);
    default: return false;
  }
}

const shorthandOverride = {
  id: 'css/shorthand-override',
  lang: 'css',
  since: 12,
  severity: 'warning',
  check(ctx, report) {
    for (const rule of containers(ctx.sheet.rules)) {
      rule.declarations.forEach((decl, i) => {
        const property = propertyName(decl);
        if (!decl.value || WRONG_COMMENT.test(property)) return;
        const later = rule.declarations.slice(i + 1).find((other) => other.value && covers(propertyName(other), property));
        if (!later || (decl.important && !later.important)) return;   // amb !important guanya la primera
        report(decl.property, { property, shorthand: propertyName(later), line: ctx.lineOf(later.property.start) });
      });
    }
  },
};

const SPACING_PROPERTIES = /^(margin|padding)(-(top|right|bottom|left))?$|^(row-|column-)?gap$/;
const LENGTH = /^-?(\d+\.?\d*|\.\d+)(px|r?em)$/i;

// L'hàbit del capítol: poques mides d'espai, que es repeteixen
const spacingScale = {
  id: 'css/spacing-scale',
  lang: 'css',
  since: 12,
  severity: 'info',
  check(ctx, report) {
    const seen = [];
    let fifth = null;
    for (const decl of styleDeclarations(ctx.sheet)) {
      if (!decl.value || !SPACING_PROPERTIES.test(propertyName(decl))) continue;
      if (ctx.supports && !ctx.supports(propertyName(decl), decl.value.text.trim())) continue;   // no compta: el navegador la ignora
      let offset = 0;
      for (const word of decl.value.text.split(/(\s+)/)) {
        const size = word.toLowerCase();
        if (LENGTH.test(size) && !isZero(size) && !seen.includes(size)) {
          seen.push(size);
          if (seen.length === 5) fifth = { start: decl.value.start + offset, end: decl.value.start + offset + word.length };
        }
        offset += word.length;
      }
    }
    if (fifth) report(fifth, { count: seen.length, sizes: seen.join(', ') });
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
  selectorMatchesNothing,
  idSelector,
  important,
  duplicateDeclaration,
  presentationalClass,
  genericFontFamily,
  undefinedVariable,
  lowContrast,
  repeatedColor,
  borderWithoutStyle,
  inlineDimensions,
  shorthandOverride,
  spacingScale,
  lastSemicolon,
  oneDeclarationPerLine,
  indentation,
];
