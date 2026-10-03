// ════════════════════════════════════════════════════════
// lint/rules-html.js — Regles del revisor de codi per a l'HTML
// (mòdul pur)
//
// Cada regla és un objet:
//   { id, lang: 'html', since, severity, mode?, check(ctx, report) }
//   since     capítol on s'ensenya el concepte: la regla només s'activa
//             a partir d'aquell capítol (docs/BLUEPRINT.md §4.7)
//   severity  'error' (el navegador ha hagut d'arreglar o ignorar alguna
//             cosa) | 'warning' (funciona, però no és codi net) | 'info'
//   mode      'document': només quan l'alumne escriu el document sencer
//   check     rep el context i crida report({ start, end }, data) per a
//             cada problema; el text en català és a messages.ca.js
//
// Context: { src, tokens, root, structure, mode, lineOf(pos) }
//   root i structure són l'arbre del codi font i els seus problemes
//   d'estructura (lang/html-model.js).
//
// API pública:
//   HTML_RULES
// ════════════════════════════════════════════════════════

import { KNOWN_ELEMENTS, DEPRECATED_ELEMENTS } from '../lang/html-spec.js';
import { closest } from './suggest.js';
import { indentChecker } from './lines.js';

/** Noms en català que els alumnes escriuen a vegades com a etiqueta. */
const CATALAN_TAGS = {
  paragraf: 'p', parragraf: 'p', 'paràgraf': 'p', titol: 'h1', 'títol': 'h1',
  llista: 'ul', enllac: 'a', 'enllaç': 'a', imatge: 'img', negreta: 'strong',
  cursiva: 'em', taula: 'table', fila: 'tr', cos: 'body', capcalera: 'header',
  'capçalera': 'header', peu: 'footer', seccio: 'section', 'secció': 'section',
  boto: 'button', 'botó': 'button', formulari: 'form',
};

const FOREIGN = new Set(['svg', 'math']);   // SVG i MathML tenen les seves pròpies regles
const LISTS = new Set(['ul', 'ol', 'menu']);
const HEADING = /^h([1-6])$/;

// ── Ajudes per recórrer l'arbre del codi font ──

/** Nodes en l'ordre del codi; no entra als elements per als quals skip() és cert. */
function* walk(node, skip = () => false) {
  for (const child of node.children || []) {
    yield child;
    if (child.type === 'element' && !skip(child)) yield* walk(child, skip);
  }
}

const isElement = (node) => node.type === 'element';

/** Elements HTML (sense el contingut d'<svg> i <math>); es calcula un sol cop per arbre. */
const elementsCache = new WeakMap();
function htmlElements(root) {
  if (!elementsCache.has(root)) {
    elementsCache.set(root, [...walk(root, (el) => FOREIGN.has(el.name))].filter(isElement));
  }
  return elementsCache.get(root);
}

const nameRange = (tag) => ({ start: tag.nameStart, end: tag.nameEnd });

const isBlankText = (src, node) => node.type === 'text' && !src.slice(node.token.start, node.token.end).trim();

const firstStartTag = (tokens, name) => tokens.find((t) => t.type === 'startTag' && t.name === name);

const attrOf = (tag, name) => tag.attrs.find((a) => a.name === name);

// Un text sense els espais i salts de línia dels extrems (perquè el problema
// s'assenyali a la línia on hi ha el text, no a la de l'etiqueta d'abans)
function trimmedRange(src, token) {
  const text = src.slice(token.start, token.end);
  const start = token.start + text.search(/\S/);
  return { start, end: start + text.trim().length };
}

// On es diu que falta alguna cosa del <head>: al nom del <head>, o del <html>,
// o al principi del codi
function headAnchor(tokens) {
  const tag = firstStartTag(tokens, 'head') || firstStartTag(tokens, 'html');
  return tag ? nameRange(tag) : { start: 0, end: 0 };
}

// ── Errors d'estructura de lang/html-model.js ──

function fromModel(code, since) {
  return {
    id: 'html/' + code,
    lang: 'html',
    since,
    severity: 'error',
    check(ctx, report) {
      for (const problem of ctx.structure) {
        if (problem.code === code) report(problem, problem.data);
      }
    },
  };
}

// ── Codi net ──

const uppercase = {
  id: 'html/uppercase',
  lang: 'html',
  since: 1,
  severity: 'warning',
  check(ctx, report) {
    for (const el of htmlElements(ctx.root)) {
      for (const tag of [el.startTag, el.endTag]) {
        if (tag && /[A-Z]/.test(tag.rawName)) {
          report(nameRange(tag), { kind: 'tag', name: tag.name, end: tag.type === 'endTag' });
        }
      }
      if (FOREIGN.has(el.name)) continue;   // <svg viewBox="…">: l'SVG sí que té majúscules
      for (const attr of el.startTag.attrs) {
        if (/[A-Z]/.test(attr.rawName)) report(nameRange(attr), { kind: 'attr', name: attr.name });
      }
    }
  },
};

const unquotedAttribute = {
  id: 'html/unquoted-attribute',
  lang: 'html',
  since: 1,
  severity: 'warning',
  check(ctx, report) {
    for (const el of htmlElements(ctx.root)) {
      for (const attr of el.startTag.attrs) {
        if (attr.quote === '') report(attr, { attr: attr.name, value: attr.value });
      }
    }
  },
};

/**
 * La indentació reflecteix el niuament. Només es revisen les línies que
 * comencen amb una etiqueta o un comentari (el text llarg pot continuar
 * on vulgui) i sempre respecte a la línia del pare tal com és, perquè un
 * error no se n'emporti d'altres. Si hi ha errors d'estructura, l'arbre no
 * és fiable: primer cal arreglar-los.
 */
const indentation = {
  id: 'html/indentation',
  lang: 'html',
  since: 1,
  severity: 'warning',
  check(ctx, report) {
    if (ctx.structure.length) return;
    const { width, expect } = indentChecker(ctx.src, report);
    const childIndent = (node) => (node.parent.type === 'root' ? 0 : width(node.parent.startTag.start) + 2);

    for (const node of walk(ctx.root, (el) => el.name === 'pre')) {
      if (node.type === 'doctype') expect(node.token, 0);
      else if (node.type === 'comment') expect(node.token, childIndent(node));
      else if (isElement(node)) {
        expect(node.startTag, childIndent(node));
        const end = node.endTag;
        if (end && node.name !== 'pre' && ctx.lineOf(end.start) !== ctx.lineOf(node.startTag.start)) {
          expect(end, width(node.startTag.start), { close: node.name, openLine: ctx.lineOf(node.startTag.start) });
        }
      }
    }
  },
};

// ── Document sencer (mode 'document') ──

const doctype = {
  id: 'html/doctype',
  lang: 'html',
  since: 1,
  severity: 'error',
  mode: 'document',
  check(ctx, report) {
    const first = ctx.tokens.find((t) => t.type !== 'comment' && !(t.type === 'text' && !ctx.src.slice(t.start, t.end).trim()));
    if (first && first.type === 'doctype') {
      if (!/^<!doctype\s+html\s*>$/i.test(ctx.src.slice(first.start, first.end))) report(first, { kind: 'old' });
      return;
    }
    const late = ctx.tokens.find((t) => t.type === 'doctype');
    report(late || { start: 0, end: 0 }, { kind: late ? 'late' : 'missing' });
  },
};

const lang = {
  id: 'html/lang',
  lang: 'html',
  since: 1,
  severity: 'warning',
  mode: 'document',
  check(ctx, report) {
    const html = firstStartTag(ctx.tokens, 'html');
    if (!html) report({ start: 0, end: 0 }, { kind: 'no-html' });
    else if (!attrOf(html, 'lang')?.value?.trim()) report(nameRange(html), { kind: 'missing' });
  },
};

const charset = {
  id: 'html/charset',
  lang: 'html',
  since: 1,
  severity: 'warning',
  mode: 'document',
  check(ctx, report) {
    const metas = ctx.tokens.filter((t) => t.type === 'startTag' && t.name === 'meta');
    const meta = metas.find((t) => attrOf(t, 'charset'));
    if (!meta) {
      const oldStyle = metas.some((t) => /charset\s*=\s*utf-8/i.test(attrOf(t, 'content')?.value || ''));
      if (!oldStyle) report(headAnchor(ctx.tokens), { kind: 'missing' });
      return;
    }
    const value = (attrOf(meta, 'charset').value || '').trim();
    if (value.toLowerCase() !== 'utf-8') report(attrOf(meta, 'charset'), { kind: 'value', value });
  },
};

const title = {
  id: 'html/title',
  lang: 'html',
  since: 1,
  severity: 'error',
  mode: 'document',
  check(ctx, report) {
    const index = ctx.tokens.findIndex((t) => t.type === 'startTag' && t.name === 'title');
    if (index === -1) {
      report(headAnchor(ctx.tokens), { kind: 'missing' });
      return;
    }
    const next = ctx.tokens[index + 1];
    const text = next && next.type === 'text' ? ctx.src.slice(next.start, next.end) : '';
    if (!text.trim()) report(nameRange(ctx.tokens[index]), { kind: 'empty' });
  },
};

// ── Elements ──

const unknownElement = {
  id: 'html/unknown-element',
  lang: 'html',
  since: 1,
  severity: 'error',
  check(ctx, report) {
    for (const el of htmlElements(ctx.root)) {
      const { name } = el;
      if (KNOWN_ELEMENTS.has(name) || DEPRECATED_ELEMENTS.has(name) || name.includes('-')) continue;
      const suggestion = CATALAN_TAGS[name] || closest(name, KNOWN_ELEMENTS);
      report(nameRange(el.startTag), { tag: name, suggestion });
    }
  },
};

const deprecatedElement = {
  id: 'html/deprecated-element',
  lang: 'html',
  since: 2,
  severity: 'warning',
  check(ctx, report) {
    for (const el of htmlElements(ctx.root)) {
      if (DEPRECATED_ELEMENTS.has(el.name)) report(nameRange(el.startTag), { tag: el.name });
    }
  },
};

const headingOrder = {
  id: 'html/heading-order',
  lang: 'html',
  since: 2,
  severity: 'warning',
  check(ctx, report) {
    let previous = null;
    for (const el of htmlElements(ctx.root)) {
      const match = HEADING.exec(el.name);
      if (!match) continue;
      const level = Number(match[1]);
      if (previous !== null && level > previous + 1) report(nameRange(el.startTag), { from: previous, to: level });
      previous = level;
    }
  },
};

const singleH1 = {
  id: 'html/single-h1',
  lang: 'html',
  since: 2,
  severity: 'warning',
  check(ctx, report) {
    const h1s = htmlElements(ctx.root).filter((el) => el.name === 'h1');
    for (const el of h1s.slice(1)) report(nameRange(el.startTag), { count: h1s.length });
  },
};

const brSpacing = {
  id: 'html/br-spacing',
  lang: 'html',
  since: 2,
  severity: 'warning',
  check(ctx, report) {
    for (const parent of [ctx.root, ...htmlElements(ctx.root)]) {
      let run = 0;
      for (const node of parent.children) {
        if (isElement(node) && node.name === 'br') {
          run++;
          if (run === 2) report(node.startTag, {});
        } else if (!isBlankText(ctx.src, node) && node.type !== 'comment') {
          run = 0;
        }
      }
    }
  },
};

const listStructure = {
  id: 'html/list-structure',
  lang: 'html',
  since: 3,
  severity: 'error',
  check(ctx, report) {
    for (const el of htmlElements(ctx.root)) {
      if (el.name === 'li' && !LISTS.has(el.parent.name)) report(nameRange(el.startTag), { kind: 'li-outside' });
      if (!LISTS.has(el.name)) continue;
      for (const child of el.children) {
        if (isElement(child) && child.name !== 'li' && child.name !== 'template' && child.name !== 'script') {
          report(nameRange(child.startTag), { kind: 'not-li', tag: child.name, list: el.name });
        } else if (child.type === 'text' && !isBlankText(ctx.src, child)) {
          report(trimmedRange(ctx.src, child.token), { kind: 'text', list: el.name });
        }
      }
    }
  },
};

const inlineStyle = {
  id: 'html/inline-style',
  lang: 'html',
  since: 9,
  severity: 'warning',
  check(ctx, report) {
    for (const el of htmlElements(ctx.root)) {
      const style = attrOf(el.startTag, 'style');
      if (style) report(style, { tag: el.name });
    }
  },
};

/** Totes les regles d'HTML, en l'ordre del catàleg (docs/STATE.md §2.6). */
export const HTML_RULES = [
  fromModel('unclosed-element', 1),
  fromModel('stray-end-tag', 1),
  fromModel('mismatched-end-tag', 1),
  fromModel('misnested', 1),
  fromModel('void-end-tag', 1),
  fromModel('p-closed-by-block', 1),
  fromModel('duplicate-attribute', 1),
  fromModel('unterminated-tag', 1),
  fromModel('unterminated-attribute-value', 1),
  fromModel('unclosed-comment', 2),
  uppercase,
  unquotedAttribute,
  indentation,
  doctype,
  lang,
  charset,
  title,
  unknownElement,
  deprecatedElement,
  headingOrder,
  singleH1,
  brSpacing,
  listStructure,
  inlineStyle,
];
