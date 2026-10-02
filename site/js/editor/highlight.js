// ════════════════════════════════════════════════════════
// editor/highlight.js — Ressaltat de sintaxi d'HTML i CSS (mòdul pur)
//
// Converteix el codi en HTML amb <span class="hl-…"> a partir dels
// mateixos analitzadors que fa servir el revisor de codi, així el que
// es pinta i el que es revisa sempre coincideixen. El CSS de dins
// d'un <style> també es ressalta.
//
// Tot el text passa per escapeHtml: el codi de l'alumne mai no
// s'interpreta com a HTML de la pàgina.
//
// API pública:
//   highlightLines(src, lang) → string[]   una entrada per línia; cap
//                                          <span> no travessa un salt de línia
//   highlight(src, lang)      → string     les línies unides amb '\n'
//   escapeHtml(text)          → string
//   lang: 'html' | 'css'
//
// Classes: hl-tag (< > </ /> i el nom), hl-attr, hl-val, hl-cm,
//          hl-doc, hl-ent, hl-sel, hl-at, hl-prop, hl-cssval, hl-imp, hl-punct
// ════════════════════════════════════════════════════════

import { tokenizeHtml } from '../lang/html-tokenizer.js';
import { parseCss } from '../lang/css-parser.js';

const CSS_CLASSES = {
  comment: 'hl-cm',
  selector: 'hl-sel',
  'at-rule': 'hl-at',
  property: 'hl-prop',
  value: 'hl-cssval',
  important: 'hl-imp',
  punct: 'hl-punct',
};

/**
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * @param {string} src
 * @param {'html'|'css'} lang
 * @returns {string[]}
 */
export function highlightLines(src, lang) {
  const segments = lang === 'css' ? cssSegments(src, 0) : htmlSegments(src);
  return render(src, segments);
}

/**
 * @param {string} src
 * @param {'html'|'css'} lang
 * @returns {string}
 */
export function highlight(src, lang) {
  return highlightLines(src, lang).join('\n');
}

// ── Segments: [{ cls, start, end }] en ordre i sense encavalcar-se ──

function cssSegments(src, offset) {
  return parseCss(src).segments.map((s) => ({
    cls: CSS_CLASSES[s.type],
    start: s.start + offset,
    end: s.end + offset,
  }));
}

function htmlSegments(src) {
  const out = [];
  const add = (cls, start, end) => { if (end > start) out.push({ cls, start, end }); };
  let rawParent = null;

  for (const token of tokenizeHtml(src)) {
    switch (token.type) {
      case 'comment':
        add('hl-cm', token.start, token.end);
        break;
      case 'doctype':
        add('hl-doc', token.start, token.end);
        break;
      case 'text':
        if (token.raw && rawParent === 'style') {
          out.push(...cssSegments(src.slice(token.start, token.end), token.start));
        } else if (!token.raw || rawParent === 'title' || rawParent === 'textarea') {
          addEntities(src, token, add);
        }
        break;
      case 'startTag':
      case 'endTag':
        addTag(src, token, add);
        rawParent = token.type === 'startTag' ? token.name : null;
        break;
    }
  }
  return out;
}

function addEntities(src, token, add) {
  const re = /&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);?/gi;
  const text = src.slice(token.start, token.end);
  for (const match of text.matchAll(re)) {
    add('hl-ent', token.start + match.index, token.start + match.index + match[0].length);
  }
}

function addTag(src, token, add) {
  add('hl-tag', token.start, token.nameEnd);              // «<nom» o «</nom»
  for (const attr of token.attrs || []) {
    add('hl-attr', attr.nameStart, attr.nameEnd);
    if (attr.value !== null) {
      const quote = attr.quote ? 1 : 0;
      const end = attr.valueEnd + (attr.valueClosed && quote ? 1 : 0);
      add('hl-val', attr.valueStart - quote, end);
    }
  }
  if (token.closed) {
    const closeLength = token.selfClosing ? 2 : 1;          // «/>» o «>»
    add('hl-tag', token.end - closeLength, token.end);
  }
}

// ── Pintat per línies ────────────────────────────────────

function render(src, segments) {
  const lines = [];
  let current = '';
  let pos = 0;

  const emit = (text, cls) => {
    const parts = text.split('\n');
    parts.forEach((part, i) => {
      if (i > 0) {
        lines.push(current);
        current = '';
      }
      if (part) current += cls ? `<span class="${cls}">${escapeHtml(part)}</span>` : escapeHtml(part);
    });
  };

  for (const seg of segments) {
    if (seg.start < pos) continue;                         // per si de cas: mai encavalcats
    emit(src.slice(pos, seg.start), null);
    emit(src.slice(seg.start, seg.end), seg.cls);
    pos = seg.end;
  }
  emit(src.slice(pos), null);
  lines.push(current);
  return lines;
}
