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
// Context: { src, tokens, root, structure, mode, fileNames, lineOf(pos) }
//   root i structure són l'arbre del codi font i els seus problemes
//   d'estructura (lang/html-model.js); fileNames, els fitxers del
//   simulador (index.html, estils.css…).
//
// API pública:
//   HTML_RULES
// ════════════════════════════════════════════════════════

import {
  KNOWN_ELEMENTS, DEPRECATED_ELEMENTS, GLOBAL_ATTRIBUTES, ELEMENT_ATTRIBUTES,
  OBSOLETE_ATTRIBUTES, ENUMERATED_ATTRIBUTES, CATALAN_TAGS, isGlobalAttribute,
} from '../lang/html-spec.js';
import { RECURSOS } from '../preview/recursos.js';
import { closest } from './suggest.js';
import { indentChecker } from './lines.js';


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

// ── Enllaços (capítol 4) ──

/** Textos d'enllaç que no diuen on porten (en minúscules, sense puntuació final). */
const VAGUE_LINK_TEXTS = new Set([
  'aquí', 'aqui', 'clica', 'clica aquí', 'clica aqui', 'clica-hi', 'clic', 'clic aquí',
  'fes clic', 'fes clic aquí', 'fes clic aqui', 'prem aquí', 'enllaç', 'aquest enllaç',
  'més', 'més informació', 'llegeix més', 'click', 'click here', 'here', 'link',
]);

/** Sembla una adreça d'Internet sense «https://» (www.… o nom.cat/…). */
const LOOKS_LIKE_DOMAIN = /^(www\.|[\w-]+(\.[\w-]+)*\.(cat|com|org|net|es|eu|info|edu|io)(\/|$))/i;

const links = (root) => htmlElements(root).filter((el) => el.name === 'a');
const hrefOf = (a) => attrOf(a.startTag, 'href');

/** El text que es veu dins d'un element (els textos dels seus descendents). */
function visibleText(src, el) {
  return [...walk(el)].filter((n) => n.type === 'text' && !n.token.raw)
    .map((n) => src.slice(n.token.start, n.token.end)).join('');
}

const hasImageWithAlt = (el) => [...walk(el)].some((n) =>
  isElement(n) && n.name === 'img' && (attrOf(n.startTag, 'alt')?.value || '').trim());

/** Valors de tots els atributs id, amb l'atribut on són (en ordre). */
const idAttributes = (root) => htmlElements(root)
  .map((el) => attrOf(el.startTag, 'id'))
  .filter((attr) => attr && attr.value !== null && attr.value.trim());

const missingHref = {
  id: 'html/missing-href',
  lang: 'html',
  since: 4,
  severity: 'error',
  check(ctx, report) {
    for (const a of links(ctx.root)) {
      const href = hrefOf(a);
      if (!href) report(nameRange(a.startTag), { kind: 'missing' });
      else if (!(href.value || '').trim()) report(href, { kind: 'empty' });
    }
  },
};

const emptyLink = {
  id: 'html/empty-link',
  lang: 'html',
  since: 4,
  severity: 'warning',
  check(ctx, report) {
    for (const a of links(ctx.root)) {
      if (hrefOf(a) && !visibleText(ctx.src, a).trim() && !hasImageWithAlt(a)) report(nameRange(a.startTag), {});
    }
  },
};

const vagueLinkText = {
  id: 'html/vague-link-text',
  lang: 'html',
  since: 4,
  severity: 'warning',
  check(ctx, report) {
    for (const a of links(ctx.root)) {
      const text = visibleText(ctx.src, a).replace(/\s+/g, ' ').trim();
      const key = text.toLowerCase().replace(/[.,:;!?…]+$/, '');
      if (VAGUE_LINK_TEXTS.has(key)) report(nameRange(a.startTag), { text });
    }
  },
};

const missingProtocol = {
  id: 'html/missing-protocol',
  lang: 'html',
  since: 4,
  severity: 'warning',
  check(ctx, report) {
    for (const a of links(ctx.root)) {
      const href = hrefOf(a);
      const value = (href?.value || '').trim();
      if (LOOKS_LIKE_DOMAIN.test(value)) report(href, { href: value, fix: 'https://' + value });
    }
  },
};

const duplicateId = {
  id: 'html/duplicate-id',
  lang: 'html',
  since: 4,
  severity: 'error',
  check(ctx, report) {
    const firstLine = new Map();
    for (const attr of idAttributes(ctx.root)) {
      const id = attr.value.trim();
      if (firstLine.has(id)) report(attr, { id, firstLine: firstLine.get(id) });
      else firstLine.set(id, ctx.lineOf(attr.start));
    }
  },
};

// Es fa sobre el codi font (el BLUEPRINT la preveia sobre la pàgina pintada):
// els id del codi són els que l'alumne ha escrit
const missingAnchor = {
  id: 'html/missing-anchor',
  lang: 'html',
  since: 4,
  severity: 'warning',
  check(ctx, report) {
    const ids = new Set(idAttributes(ctx.root).map((attr) => attr.value.trim()));
    for (const a of links(ctx.root)) {
      const href = hrefOf(a);
      const value = (href?.value || '').trim();
      if (!value.startsWith('#') || value === '#') continue;
      let id = value.slice(1);
      try { id = decodeURIComponent(id); } catch { /* es compara tal com és */ }
      if (!ids.has(id)) report(href, { id, suggestion: closest(id, ids) });
    }
  },
};

// ── Imatges i atributs (capítol 5) ──

const images = (root) => htmlElements(root).filter((el) => el.name === 'img');

/** Textos alternatius que no diuen què hi ha a la imatge (en minúscules, sense puntuació final). */
const VAGUE_ALT_TEXTS = new Set([
  'imatge', 'una imatge', 'la imatge', 'foto', 'una foto', 'fotografia', 'una fotografia',
  'dibuix', 'un dibuix', 'il·lustració', 'icona', 'image', 'img', 'photo', 'picture', 'pic', 'icon',
]);

const IMAGE_FILE = /\.(svg|png|jpe?g|gif|webp|avif)$/i;

const imgAlt = {
  id: 'html/img-alt',
  lang: 'html',
  since: 5,
  severity: 'error',
  check(ctx, report) {
    for (const img of images(ctx.root)) {
      if (!attrOf(img.startTag, 'alt')) report(nameRange(img.startTag), {});
    }
  },
};

const vagueAlt = {
  id: 'html/vague-alt',
  lang: 'html',
  since: 5,
  severity: 'warning',
  check(ctx, report) {
    for (const img of images(ctx.root)) {
      const alt = attrOf(img.startTag, 'alt');
      const text = (alt?.value || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;   // alt="": imatge decorativa
      const key = text.toLowerCase().replace(/[.,:;!?…]+$/, '');
      if (IMAGE_FILE.test(text)) report(alt, { alt: text, kind: 'file' });
      else if (VAGUE_ALT_TEXTS.has(key)) report(alt, { alt: text, kind: 'generic' });
    }
  },
};

/** Confusions habituals: { element: { atribut escrit: el que tocava } }. */
const ATTRIBUTE_MIXUPS = {
  img: { href: 'src', link: 'src', url: 'src', source: 'src', text: 'alt' },
  a: { src: 'href', link: 'href', url: 'href' },
};

// Noms d'atributs antics d'algun element (align, bgcolor…): en un altre element,
// el navegador els ignora del tot
const OBSOLETE_ANYWHERE = new Set(Object.values(OBSOLETE_ATTRIBUTES).flatMap((names) => [...names]));

/**
 * Atributs dels elements HTML coneguts. No es miren els d'<svg> i <math>
 * (tenen els seus propis atributs) ni els dels elements desconeguts o antics
 * (ja tenen la seva regla).
 */
function* checkedAttributes(root) {
  for (const el of htmlElements(root)) {
    if (!KNOWN_ELEMENTS.has(el.name) || FOREIGN.has(el.name)) continue;
    for (const attr of el.startTag.attrs) yield { el, attr };
  }
}

const isObsoleteAttribute = (element, name) => Boolean(OBSOLETE_ATTRIBUTES[element]?.has(name));

const isKnownAttribute = (element, name) =>
  isGlobalAttribute(name) || Boolean(ELEMENT_ATTRIBUTES[element]?.has(name)) || isObsoleteAttribute(element, name);

const unknownAttribute = {
  id: 'html/unknown-attribute',
  lang: 'html',
  since: 5,
  severity: 'error',
  check(ctx, report) {
    for (const { el, attr } of checkedAttributes(ctx.root)) {
      const { name } = attr;
      if (isKnownAttribute(el.name, name)) continue;
      const own = ELEMENT_ATTRIBUTES[el.name] || [];
      const suggestion = ATTRIBUTE_MIXUPS[el.name]?.[name] || closest(name, [...own, ...GLOBAL_ATTRIBUTES]);
      report(nameRange(attr), { attr: name, tag: el.name, suggestion, obsolete: OBSOLETE_ANYWHERE.has(name) });
    }
  },
};

const obsoleteAttribute = {
  id: 'html/obsolete-attribute',
  lang: 'html',
  since: 5,
  severity: 'warning',
  check(ctx, report) {
    for (const { el, attr } of checkedAttributes(ctx.root)) {
      if (isObsoleteAttribute(el.name, attr.name)) report(nameRange(attr), { attr: attr.name, tag: el.name });
    }
  },
};

const imgSize = {
  id: 'html/img-size',
  lang: 'html',
  since: 5,
  severity: 'error',
  check(ctx, report) {
    for (const img of images(ctx.root)) {
      for (const name of ['width', 'height']) {
        const attr = attrOf(img.startTag, name);
        if (!attr) continue;
        const value = (attr.value || '').trim();
        if (/^\d+$/.test(value)) continue;
        // Com ho llegeix el navegador (comprovat a Chromium): «100px» → 100,
        // «50%» → la meitat de l'amplada, «5cm» → 5 píxels, «gran» → res
        const px = /^(\d+)\s*px$/i.exec(value);
        const kind = px ? 'px' : /^\d+(\.\d+)?\s*%$/.test(value) ? 'percent' : /^\d/.test(value) ? 'unit' : 'invalid';
        report(attr, { attr: name, value, kind, fix: px ? px[1] : null });
      }
    }
  },
};

// Adreça on la previsualització busca les imatges (<base href> de
// preview/srcdoc.js). El web es publica des de l'arrel del repositori, de
// manera que «../recursos/gat.svg» i «/site/recursos/gat.svg» també hi porten.
const RECURSOS_URL = 'https://htmlcat.invalid/site/recursos/';
const RECURSOS_PATH = new URL(RECURSOS_URL).pathname;

/**
 * Busca la imatge com ho faria el navegador. Retorna null si es troba, o
 * per què no es troba: { kind: 'external' | 'computer' | 'missing',
 * suggestion?, reason? }.
 */
function findImage(src) {
  if (/^(data|blob):/i.test(src)) return null;
  if (/^(https?:)?\/\//i.test(src)) return { kind: 'external' };     // la CSP les bloqueja
  if (/^(file:|[a-z]:[\\/])/i.test(src)) return { kind: 'computer' };
  let url = null;
  try { url = new URL(src, RECURSOS_URL); } catch { /* adreça mal escrita: no es troba */ }
  if (url && url.origin === new URL(RECURSOS_URL).origin && url.pathname.startsWith(RECURSOS_PATH)) {
    let name = url.pathname.slice(RECURSOS_PATH.length);
    try { name = decodeURIComponent(name); } catch { /* es compara tal com és */ }
    if (RECURSOS.includes(name)) return null;
  }
  return { kind: 'missing', ...suggestImage(src) };
}

/** «Potser volies dir…?»: el fitxer amb el mateix nom (sense mirar majúscules), extensió, carpeta… */
function suggestImage(src) {
  const written = src.split(/[?#]/)[0].replace(/^(\.\/)+/, '').toLowerCase();
  const stem = (path) => path.replace(/\.[^./]*$/, '');
  const base = (path) => path.slice(path.lastIndexOf('/') + 1);
  const tests = [
    ['case', (name) => name === written],
    ['extension', (name) => stem(name) === stem(written)],
    ['folder', (name) => base(name) === base(written)],
    ['folder', (name) => stem(base(name)) === stem(base(written))],
  ];
  for (const [reason, test] of tests) {
    const found = RECURSOS.find((name) => test(name.toLowerCase()));
    if (found) return { suggestion: found, reason };
  }
  const near = closest(written, RECURSOS);
  return near ? { suggestion: near, reason: 'typo' } : {};
}

// Es fa sobre el codi font, amb la llista d'imatges que hi ha (el BLUEPRINT
// la preveia sobre la pàgina pintada): totes les imatges de l'alumne són a
// site/recursos/ i un test comprova que la llista coincideix amb els fitxers
const imageNotFound = {
  id: 'html/image-not-found',
  lang: 'html',
  since: 5,
  severity: 'error',
  check(ctx, report) {
    for (const img of images(ctx.root)) {
      const src = attrOf(img.startTag, 'src');
      const value = (src?.value || '').trim();
      if (!value) {
        // <img scr="…">: ja ho explica html/unknown-attribute («potser volies escriure src?»)
        const misspelt = img.startTag.attrs.some((attr) => !isKnownAttribute('img', attr.name));
        if (!misspelt) report(src || nameRange(img.startTag), { kind: 'no-src' });
        continue;
      }
      const problem = findImage(value);
      if (problem) report(src, { src: value, ...problem });
    }
  },
};

// ── Estructura de la pàgina (capítol 6) ──

/** On pot anar <main> (WHATWG: «hierarchically correct main element»). */
const MAIN_PARENTS = new Set(['html', 'body', 'div', 'form']);

const singleMain = {
  id: 'html/single-main',
  lang: 'html',
  since: 6,
  severity: 'warning',
  check(ctx, report) {
    const mains = htmlElements(ctx.root).filter((el) => el.name === 'main');
    for (const main of mains) {
      let parent = main.parent;
      while (parent.type === 'element' && (MAIN_PARENTS.has(parent.name) || parent.name.includes('-'))) parent = parent.parent;
      if (parent.type === 'element') report(nameRange(main.startTag), { kind: 'inside', parent: parent.name });
    }
    for (const main of mains.slice(1)) report(nameRange(main.startTag), { kind: 'several', count: mains.length });
    // Que falti només es diu quan l'alumne escriu el document sencer
    if (!mains.length && ctx.mode === 'document') {
      const body = htmlElements(ctx.root).find((el) => el.name === 'body');
      if (body && body.children.some(isElement)) report(nameRange(body.startTag), { kind: 'missing' });
    }
  },
};

// Un <head> dins del cos de la pàgina: el navegador l'ignora (el seu contingut
// queda al <body>). Sovint l'alumne volia <header>.
const headInBody = {
  id: 'html/head-in-body',
  lang: 'html',
  since: 6,
  severity: 'error',
  check(ctx, report) {
    const body = firstStartTag(ctx.tokens, 'body');
    const heads = ctx.tokens.filter((t) => t.type === 'startTag' && t.name === 'head');
    heads.forEach((head, i) => {
      const inPlace = ctx.mode === 'document' && i === 0 && (!body || head.start < body.start);
      if (!inPlace) report(nameRange(head), {});
    });
  },
};

const SECTIONING = new Set(['section', 'article']);
const NESTED_PARTS = new Set(['section', 'article', 'aside', 'nav']);

const sectionHeading = {
  id: 'html/section-heading',
  lang: 'html',
  since: 6,
  severity: 'warning',
  check(ctx, report) {
    for (const el of htmlElements(ctx.root)) {
      if (!SECTIONING.has(el.name)) continue;
      // El títol d'una part de dins (una altra <section>…) no compta
      const hasHeading = [...walk(el, (child) => NESTED_PARTS.has(child.name))]
        .some((node) => isElement(node) && HEADING.test(node.name));
      if (!hasHeading) report(nameRange(el.startTag), { tag: el.name });
    }
  },
};

/** Noms de classe o d'id que diuen que el <div> és una part amb element propi. */
const SEMANTIC_NAMES = {
  header: 'header', capcalera: 'header', 'capçalera': 'header',
  nav: 'nav', navegacio: 'nav', 'navegació': 'nav', menu: 'nav', 'menú': 'nav', 'menu-principal': 'nav',
  main: 'main', principal: 'main', 'contingut-principal': 'main',
  footer: 'footer', peu: 'footer', 'peu-de-pagina': 'footer', 'peu-pagina': 'footer',
  aside: 'aside', sidebar: 'aside', lateral: 'aside', 'barra-lateral': 'aside',
  article: 'article', section: 'section', seccio: 'section', 'secció': 'section',
};

const semanticDiv = {
  id: 'html/semantic-div',
  lang: 'html',
  since: 6,
  severity: 'warning',
  check(ctx, report) {
    for (const el of htmlElements(ctx.root)) {
      if (el.name !== 'div') continue;
      const classes = (attrOf(el.startTag, 'class')?.value || '').toLowerCase().split(/\s+/);
      const id = (attrOf(el.startTag, 'id')?.value || '').trim().toLowerCase();
      const found = [...classes.map((name) => ({ attr: 'class', name })), { attr: 'id', name: id }]
        .find(({ name }) => Object.hasOwn(SEMANTIC_NAMES, name));
      if (found) report(nameRange(el.startTag), { ...found, element: SEMANTIC_NAMES[found.name] });
    }
  },
};

// ── Taules (capítol 7) ──

const TABLE_SECTIONS = new Set(['thead', 'tbody', 'tfoot']);
const CELLS = new Set(['td', 'th']);

/**
 * Què pot anar directament dins de cada part d'una taula. El navegador treu
 * de la taula qualsevol altra cosa (text o elements) i la posa just abans
 * («foster parenting», comprovat a Chromium). Les files i les cel·les mal
 * posades tenen el seu propi missatge.
 */
const ROW_GROUP_CHILDREN = new Set(['tr', 'script', 'template']);
const TABLE_CHILDREN = {
  table: new Set(['caption', 'colgroup', 'thead', 'tbody', 'tfoot', 'tr', 'script', 'template', 'style']),
  thead: ROW_GROUP_CHILDREN,
  tbody: ROW_GROUP_CHILDREN,
  tfoot: ROW_GROUP_CHILDREN,
  tr: new Set(['td', 'th', 'script', 'template']),
};

const parentName = (el) => (el.parent.type === 'element' ? el.parent.name : null);
const childElements = (el, names) => el.children.filter((node) => isElement(node) && names.has(node.name));

const tableStructure = {
  id: 'html/table-structure',
  lang: 'html',
  since: 7,
  severity: 'error',
  check(ctx, report) {
    for (const el of htmlElements(ctx.root)) {
      const parent = parentName(el);
      if (el.name === 'tr' && parent !== 'table' && !TABLE_SECTIONS.has(parent)) {
        report(nameRange(el.startTag), { kind: 'row-outside' });
      } else if (CELLS.has(el.name) && parent !== 'tr') {
        const inTable = parent === 'table' || TABLE_SECTIONS.has(parent);
        report(nameRange(el.startTag), { kind: inTable ? 'cell-no-row' : 'cell-outside', tag: el.name });
      }
      const allowed = TABLE_CHILDREN[el.name];
      if (!allowed) continue;
      for (const child of el.children) {
        if (isElement(child)) {
          // (els formularis dins de taules són un cas a part que no s'ensenya)
          const handled = allowed.has(child.name) || child.name === 'tr' || CELLS.has(child.name) || child.name === 'form' ||
            (child.name === 'input' && (attrOf(child.startTag, 'type')?.value || '').toLowerCase() === 'hidden');
          if (!handled) report(nameRange(child.startTag), { kind: 'foster', tag: child.name });
        } else if (child.type === 'text' && !isBlankText(ctx.src, child)) {
          report(trimmedRange(ctx.src, child.token), { kind: 'foster-text' });
        }
      }
    }
  },
};

/** Les files d'una taula, per grups (thead, tbody, tfoot o files soltes): rowspan no passa d'un grup a un altre. */
function rowGroups(table) {
  const groups = [];
  let loose = null;
  for (const child of table.children) {
    if (!isElement(child)) continue;
    if (child.name === 'tr') {
      if (!loose) groups.push(loose = []);
      loose.push(child);
    } else if (TABLE_SECTIONS.has(child.name)) {
      loose = null;
      groups.push(childElements(child, new Set(['tr'])));
    }
  }
  return groups;
}

function spanOf(cell, name) {
  const n = parseInt(attrOf(cell.startTag, name)?.value ?? '', 10);
  if (name === 'rowspan' && n === 0) return Infinity;   // rowspan="0": fins al final del grup
  return n >= 1 ? n : 1;
}

/** Columnes que ocupa cada fila d'un grup, comptant colspan i les cel·les de més amunt amb rowspan. */
function rowWidths(group) {
  const pending = [];   // per columna: quantes files més ocupa una cel·la (incloent-hi la fila actual)
  return group.map((tr) => {
    const used = pending.map((n) => n > 0);
    let col = 0;
    for (const cell of childElements(tr, CELLS)) {
      while (used[col]) col++;
      const colspan = spanOf(cell, 'colspan');
      const rowspan = spanOf(cell, 'rowspan');
      for (let k = col; k < col + colspan; k++) {
        used[k] = true;
        pending[k] = rowspan;
      }
      col += colspan;
    }
    for (let k = 0; k < pending.length; k++) if (pending[k] > 0) pending[k]--;
    return used.lastIndexOf(true) + 1;
  });
}

const tables = (root) => htmlElements(root).filter((el) => el.name === 'table');

const tableColumns = {
  id: 'html/table-columns',
  lang: 'html',
  since: 7,
  severity: 'warning',
  check(ctx, report) {
    for (const table of tables(ctx.root)) {
      const groups = rowGroups(table);
      const rows = groups.flat();
      const widths = groups.flatMap(rowWidths);
      if (!rows.length) continue;
      const firstLine = ctx.lineOf(rows[0].startTag.start);
      rows.forEach((tr, i) => {
        if (widths[i] !== widths[0]) report(nameRange(tr.startTag), { columns: widths[i], expected: widths[0], firstLine });
      });
    }
  },
};

const tableHeaders = {
  id: 'html/table-headers',
  lang: 'html',
  since: 7,
  severity: 'warning',
  check(ctx, report) {
    for (const table of tables(ctx.root)) {
      const rows = rowGroups(table).flat();
      if (rows.length && !rows.some((tr) => childElements(tr, new Set(['th'])).length)) report(nameRange(table.startTag), {});
    }
  },
};

/** Confusions habituals amb els valors dels atributs enumerats. */
const VALUE_MIXUPS = {
  scope: {
    column: 'col', columns: 'col', colum: 'col', cols: 'col', columna: 'col', columnes: 'col',
    rows: 'row', fila: 'row', files: 'row', filera: 'row',
  },
  // (data és «date» en català; un suggeriment que l'atribut no admet es descarta)
  type: {
    txt: 'text', texte: 'text', mail: 'email', 'e-mail': 'email', correu: 'email',
    numero: 'number', 'número': 'number', num: 'number', telefon: 'tel', 'telèfon': 'tel', phone: 'tel',
    data: 'date', hora: 'time', contrasenya: 'password', pass: 'password', casella: 'checkbox',
    check: 'checkbox', boto: 'button', 'botó': 'button', enviar: 'submit', envia: 'submit',
    send: 'submit', datetime: 'datetime-local', colour: 'color',
  },
};

const invalidAttributeValue = {
  id: 'html/invalid-attribute-value',
  lang: 'html',
  since: 7,
  severity: 'error',
  check(ctx, report) {
    for (const el of htmlElements(ctx.root)) {
      const enumerated = ENUMERATED_ATTRIBUTES[el.name];
      if (!enumerated) continue;
      for (const attr of el.startTag.attrs) {
        const values = enumerated[attr.name];
        const value = (attr.value || '').trim();
        if (!values || values.includes(value.toLowerCase())) continue;
        const key = value.toLowerCase();
        const mixup = VALUE_MIXUPS[attr.name]?.[key];
        const suggestion = values.includes(mixup) ? mixup : (key ? closest(key, values) : null);
        report(attr, { attr: attr.name, tag: el.name, value, values, suggestion });
      }
    }
  },
};

const thScope = {
  id: 'html/th-scope',
  lang: 'html',
  since: 7,
  severity: 'info',
  check(ctx, report) {
    for (const el of htmlElements(ctx.root)) {
      if (el.name === 'th' && !attrOf(el.startTag, 'scope')) report(nameRange(el.startTag), {});
    }
  },
};

// ── Formularis (capítol 8) ──

/** Elements que poden tenir etiqueta (WHATWG: «labelable elements»). */
const LABELABLE = new Set(['button', 'input', 'meter', 'output', 'progress', 'select', 'textarea']);
/** Tipus d'<input> que no necessiten etiqueta (són botons, o no es veuen) ni, alguns, name. */
const BUTTON_INPUTS = new Set(['submit', 'reset', 'button', 'image']);

const inputType = (el) => (attrOf(el.startTag, 'type')?.value || 'text').trim().toLowerCase();

/** Camps que l'alumne omple: necessiten etiqueta i name. */
function isField(el) {
  if (el.name === 'select' || el.name === 'textarea') return true;
  return el.name === 'input' && !BUTTON_INPUTS.has(inputType(el)) && inputType(el) !== 'hidden';
}

const controlLabel = {
  id: 'html/control-label',
  lang: 'html',
  since: 8,
  severity: 'error',
  check(ctx, report) {
    const elements = htmlElements(ctx.root);
    const byId = new Map();   // amb ids repetits, el navegador fa servir el primer
    for (const el of elements) {
      const id = (attrOf(el.startTag, 'id')?.value || '').trim();
      if (id && !byId.has(id)) byId.set(id, el);
    }
    const labelled = new Set();
    for (const label of elements.filter((el) => el.name === 'label')) {
      const forAttr = attrOf(label.startTag, 'for');
      if (!forAttr) {
        // Sense for, l'etiqueta és del primer camp que té a dins
        const inner = [...walk(label)].find((node) => isElement(node) && LABELABLE.has(node.name));
        if (inner) labelled.add(inner);
        continue;
      }
      const id = (forAttr.value || '').trim();
      const target = byId.get(id);
      if (!target) report(forAttr, { kind: 'for-missing', id, suggestion: id ? closest(id, byId.keys()) : null });
      else if (!LABELABLE.has(target.name)) report(forAttr, { kind: 'for-not-control', id, tag: target.name });
      else labelled.add(target);
    }
    for (const el of elements) {
      if (!isField(el) || labelled.has(el)) continue;
      if ((attrOf(el.startTag, 'aria-label')?.value || '').trim() || attrOf(el.startTag, 'aria-labelledby')) continue;
      const placeholder = (attrOf(el.startTag, 'placeholder')?.value || '').trim();
      report(nameRange(el.startTag), { kind: placeholder ? 'placeholder' : 'missing', tag: el.name });
    }
  },
};

function insideForm(el) {
  for (let node = el.parent; node.type === 'element'; node = node.parent) {
    if (node.name === 'form') return true;
  }
  return Boolean(attrOf(el.startTag, 'form'));
}

const controlName = {
  id: 'html/control-name',
  lang: 'html',
  since: 8,
  severity: 'warning',
  check(ctx, report) {
    for (const el of htmlElements(ctx.root)) {
      const sends = isField(el) || (el.name === 'input' && inputType(el) === 'hidden');
      if (!sends || !insideForm(el) || (attrOf(el.startTag, 'name')?.value || '').trim()) continue;
      report(nameRange(el.startTag), { tag: el.name, radio: el.name === 'input' && inputType(el) === 'radio' });
    }
  },
};

// ── Fulls d'estil (capítol 9) ──

/** Adreces que no són fitxers del simulador (el document de la previsualització no les substitueix). */
const NOT_A_FILE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i;

// Només en mode document: en mode fragment, el simulador hi posa tots els CSS sol
const stylesheetLink = {
  id: 'html/stylesheet-link',
  lang: 'html',
  since: 9,
  severity: 'error',
  mode: 'document',
  check(ctx, report) {
    const cssFiles = ctx.fileNames.filter((name) => name.endsWith('.css'));
    const handled = new Set();   // fitxers que ja tenen el seu missatge (enllaçats, o amb el nom mal escrit)
    for (const el of htmlElements(ctx.root)) {
      if (el.name !== 'link') continue;
      const href = attrOf(el.startTag, 'href');
      const value = (href?.value || '').trim();
      const name = value.replace(/^\.\//, '');
      const rels = (attrOf(el.startTag, 'rel')?.value || '').toLowerCase().split(/\s+/);
      if (!rels.includes('stylesheet')) {
        if (/\.css$/i.test(name.split(/[?#]/)[0])) {
          report(nameRange(el.startTag), { kind: 'no-rel' });
          if (cssFiles.includes(name)) handled.add(name);
        }
        continue;
      }
      if (!value) {
        report(nameRange(el.startTag), { kind: 'no-href' });
      } else if (/^(https?:)?\/\//i.test(value)) {
        report(href, { kind: 'external' });
      } else if (!NOT_A_FILE.test(value) && cssFiles.includes(name)) {
        handled.add(name);
      } else {
        const bare = name.replace(/^\//, '');
        const suggestion = cssFiles.find((file) => file.toLowerCase() === bare.toLowerCase()) ||
          closest(bare, cssFiles) || (cssFiles.length === 1 ? cssFiles[0] : null);
        if (suggestion) handled.add(suggestion);
        report(href, { kind: 'not-found', href: value, suggestion, files: cssFiles });
      }
    }
    for (const file of cssFiles.filter((name) => !handled.has(name))) report(headAnchor(ctx.tokens), { kind: 'unlinked', file });
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
  missingHref,
  emptyLink,
  vagueLinkText,
  missingProtocol,
  duplicateId,
  missingAnchor,
  imgAlt,
  vagueAlt,
  unknownAttribute,
  obsoleteAttribute,
  imgSize,
  imageNotFound,
  singleMain,
  headInBody,
  sectionHeading,
  semanticDiv,
  tableStructure,
  tableColumns,
  tableHeaders,
  invalidAttributeValue,
  thScope,
  controlLabel,
  controlName,
  stylesheetLink,
  inlineStyle,
];
