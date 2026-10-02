// ════════════════════════════════════════════════════════
// lang/css-parser.js — Analitzador de CSS tolerant, amb posicions
// (mòdul pur)
//
// Llegeix el CSS de l'alumne sense aturar-se als errors i en conserva
// l'estructura (regles, selectors, declaracions) amb la posició de cada
// peça. El fan servir el ressaltat, el revisor de codi i les
// comprovacions dels exercicis.
//
// Recuperació d'errors pensada per als alumnes: si falta la «}» d'una
// regla i a continuació comença una altra regla («p {»), es tanca la
// primera i s'avisa (el navegador, en canvi, s'empassaria la segona).
//
// API pública:
//   parseCss(src) → { rules, comments, problems, segments }
//
// Regla d'estil: { type: 'style', selector: Span, selectors: Span[],
//                  declarations: Decl[], start, end, open, close }
//   open/close: posició de «{» i «}» (close === -1 si falta).
// Regla @:      { type: 'at', name, prelude: Span, rules?, declarations?,
//                 start, end, open, close }
//   @media/@supports/…: rules; @font-face/@page: declarations;
//   @import …; : cap de les dues (open === -1).
// Decl: { property: Span, value: Span|null, important, semicolon, start, end }
// Span: { text, start, end }   (text sense espais als extrems)
//
// Problemes: { code, start, end, line, col, data }
//   unclosed-block, unexpected-close-brace, missing-open-brace,
//   missing-colon, empty-value, missing-semicolon, unclosed-comment,
//   unclosed-string
//
// segments: [{ type, start, end }] per al ressaltat, en ordre. Tipus:
//   comment, selector, at-rule, property, value, important, punct
// ════════════════════════════════════════════════════════

import { makeLineIndex } from '../util/text.js';

/** @-regles que contenen altres regles. */
const NESTED_AT_RULES = new Set(['media', 'supports', 'container', 'layer', 'keyframes', '-webkit-keyframes', 'document', 'scope']);

/**
 * @param {string} src
 * @returns {{ rules: Array<Object>, comments: Array<Object>, problems: Array<Object>, segments: Array<Object> }}
 */
export function parseCss(src) {
  const comments = [];
  const problems = [];
  const segments = [];
  let pos = 0;

  const report = (code, start, end, data = {}) => problems.push({ code, start, end, data });
  const segment = (type, start, end) => { if (end > start) segments.push({ type, start, end }); };

  const rules = parseRuleList(false);

  const at = makeLineIndex(src);
  for (const problem of problems) Object.assign(problem, at(problem.start));
  problems.sort((a, b) => a.start - b.start);
  segments.sort((a, b) => a.start - b.start);
  return { rules, comments, problems, segments };

  // ── Lectura de baix nivell ──────────────────────────────

  // Salta espais i comentaris (i els registra)
  function skipSpaceAndComments() {
    while (pos < src.length) {
      if (/\s/.test(src[pos])) { pos++; continue; }
      if (src.startsWith('/*', pos)) { readComment(); continue; }
      break;
    }
  }

  function readComment() {
    const start = pos;
    const close = src.indexOf('*/', pos + 2);
    const end = close === -1 ? src.length : close + 2;
    const closed = close !== -1;
    comments.push({ start, end, closed });
    segment('comment', start, end);
    if (!closed) report('unclosed-comment', start, end);
    pos = end;
  }

  // Avança fins a un dels caràcters de `stops` fora de cadenes, comentaris
  // i parèntesis. Retorna el caràcter trobat ('' si s'arriba al final).
  // Els comentaris de dins es registren.
  function scanUntil(stops) {
    let depth = 0;
    while (pos < src.length) {
      const c = src[pos];
      if (src.startsWith('/*', pos)) { readComment(); continue; }
      if (c === '"' || c === "'") { skipString(c); continue; }
      if (c === '(') depth++;
      else if (c === ')' && depth > 0) depth--;
      else if (depth === 0 && stops.includes(c)) return c;
      pos++;
    }
    return '';
  }

  function skipString(quote) {
    const start = pos;
    pos++;
    while (pos < src.length && src[pos] !== quote && src[pos] !== '\n') {
      if (src[pos] === '\\') pos++;
      pos++;
    }
    if (src[pos] === quote) pos++;
    else report('unclosed-string', start, pos);
  }

  function span(start, end) {
    let s = start;
    let e = end;
    while (s < e && /\s/.test(src[s])) s++;
    while (e > s && /\s/.test(src[e - 1])) e--;
    return { text: src.slice(s, e), start: s, end: e };
  }

  // Segment que exclou els comentaris de dins (ja tenen el seu)
  function segmentSkippingComments(type, start, end) {
    let cursor = start;
    for (const c of comments) {
      if (c.end <= start || c.start >= end) continue;
      segment(type, cursor, c.start);
      cursor = c.end;
    }
    segment(type, cursor, end);
  }

  // ── Llistes de regles ───────────────────────────────────

  function parseRuleList(nested) {
    const list = [];
    while (true) {
      skipSpaceAndComments();
      if (pos >= src.length) return list;
      if (src[pos] === '}') {
        if (nested) return list;
        report('unexpected-close-brace', pos, pos + 1);
        segment('punct', pos, pos + 1);
        pos++;
        continue;
      }
      list.push(src[pos] === '@' ? parseAtRule() : parseStyleRule());
    }
  }

  function parseStyleRule() {
    const start = pos;
    const stop = scanUntil('{}');
    const selector = span(start, pos);
    segmentSkippingComments('selector', selector.start, selector.end);

    if (stop !== '{') {
      // «h1 color: red; }» o text solt al final: falta la «{»
      report('missing-open-brace', selector.start, Math.max(selector.end, selector.start + 1), { selector: selector.text });
      if (stop === '}') { segment('punct', pos, pos + 1); pos++; }
      return { type: 'style', selector, selectors: [], declarations: [], start, end: pos, open: -1, close: -1 };
    }

    const rule = { type: 'style', selector, selectors: splitSelectors(selector), declarations: [], start, end: -1, open: pos, close: -1 };
    segment('punct', pos, pos + 1);
    pos++;
    parseDeclarations(rule);
    rule.end = pos;
    return rule;
  }

  function parseAtRule() {
    const start = pos;
    pos++;
    while (pos < src.length && /[\w-]/.test(src[pos])) pos++;
    const name = src.slice(start + 1, pos).toLowerCase();
    segment('at-rule', start, pos);
    const preludeStart = pos;
    const stop = scanUntil(';{}');
    const prelude = span(preludeStart, pos);
    segmentSkippingComments('value', prelude.start, prelude.end);
    const rule = { type: 'at', name, prelude, start, end: -1, open: -1, close: -1 };

    if (stop === ';') {
      segment('punct', pos, pos + 1);
      pos++;
    } else if (stop === '{') {
      rule.open = pos;
      segment('punct', pos, pos + 1);
      pos++;
      if (NESTED_AT_RULES.has(name)) {
        rule.rules = parseRuleList(true);
        closeBlock(rule);
      } else {
        rule.declarations = [];
        parseDeclarations(rule);
      }
    }
    rule.end = pos;
    return rule;
  }

  function closeBlock(rule) {
    if (src[pos] === '}') {
      rule.close = pos;
      segment('punct', pos, pos + 1);
      pos++;
    } else {
      report('unclosed-block', rule.open, rule.open + 1, { selector: (rule.selector || rule.prelude).text });
    }
  }

  // ── Declaracions ────────────────────────────────────────

  function parseDeclarations(rule) {
    while (true) {
      skipSpaceAndComments();
      if (pos >= src.length || src[pos] === '}') {
        closeBlock(rule);
        return;
      }
      if (src[pos] === ';') { segment('punct', pos, pos + 1); pos++; continue; }

      const start = pos;
      const stop = scanUntil(';{}');

      if (stop === '{') {
        // Falta la «}» d'aquesta regla i ja en comença una altra:
        // es tanca aquí i el text llegit passa a ser el selector següent
        report('unclosed-block', rule.open, rule.open + 1, { selector: (rule.selector || rule.prelude).text });
        pos = start;
        return;
      }

      const decl = parseDeclaration(start, pos);
      decl.semicolon = stop === ';';
      if (decl.semicolon) {
        segment('punct', pos, pos + 1);
        pos++;
        decl.end = pos;
      }
      rule.declarations.push(decl);
    }
  }

  function parseDeclaration(start, end) {
    const text = src.slice(start, end);
    const colon = indexOutsideComments(text, ':');
    if (colon === -1) {
      const whole = span(start, end);
      report('missing-colon', whole.start, whole.end, { text: whole.text });
      segmentSkippingComments('property', whole.start, whole.end);
      return { property: whole, value: null, important: false, semicolon: false, start, end };
    }

    const property = span(start, start + colon);
    let value = span(start + colon + 1, end);
    let important = false;
    segment('property', property.start, property.end);
    segment('punct', start + colon, start + colon + 1);

    const imp = /!\s*important\s*$/i.exec(value.text);
    if (imp) {
      important = true;
      segment('important', value.start + imp.index, value.end);
      value = span(value.start, value.start + imp.index);
    }
    segmentSkippingComments('value', value.start, value.end);

    if (!value.text) report('empty-value', property.start, property.end, { property: property.text });
    checkMissingSemicolon(value);
    return { property, value, important, semicolon: false, start, end };
  }

  // «color: red⏎ font-size: 20px»: el valor s'ha empassat la declaració
  // següent perquè falta el «;». El text entre cometes no compta
  // (content: "Nota: llegeix" és correcte).
  function checkMissingSemicolon(value) {
    const outsideStrings = value.text.replace(/(["'])(?:\\.|(?!\1)[^\\\n])*\1?/g, (s) => ' '.repeat(s.length));
    const match = /(\s)([a-zA-Z-]+)\s*:\s*\S/.exec(outsideStrings);
    if (!match) return;
    const before = outsideStrings.slice(0, match.index);
    if (before.split('(').length !== before.split(')').length) return;   // dins d'un url(…)
    const offset = value.start + match.index;
    report('missing-semicolon', value.start, offset, { next: match[2] });
  }

  function indexOutsideComments(text, ch) {
    let inComment = false;
    for (let i = 0; i < text.length; i++) {
      if (!inComment && text.startsWith('/*', i)) { inComment = true; i++; continue; }
      if (inComment && text.startsWith('*/', i)) { inComment = false; i++; continue; }
      if (!inComment && text[i] === ch) return i;
    }
    return -1;
  }

  function splitSelectors(selector) {
    const parts = [];
    let start = selector.start;
    let depth = 0;
    for (let i = selector.start; i < selector.end; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') depth--;
      else if (src[i] === ',' && depth === 0) {
        parts.push(span(start, i));
        start = i + 1;
      }
    }
    parts.push(span(start, selector.end));
    return parts.filter((p) => p.text);
  }
}
