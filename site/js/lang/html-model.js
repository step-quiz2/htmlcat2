// ════════════════════════════════════════════════════════
// lang/html-model.js — Arbre del codi font i errors d'estructura
// (mòdul pur)
//
// Construeix l'arbre que l'alumne HA ESCRIT (no el que el navegador
// construeix, que es llegeix de la previsualització) i hi detecta els
// errors que el navegador arregla en silenci.
//
// No reprodueix l'algorisme de construcció de l'HTML5: és una pila senzilla
// pensada per DIAGNOSTICAR, amb tres imitacions del navegador perquè els
// errors que es comuniquen siguin els que l'alumne entén:
//   · un bloc dins d'un <p> tanca el <p>          → 'p-closed-by-block'
//   · <li> dins d'un <li> obert tanca l'anterior   → 'unclosed-element'
//   · <b><i></b></i>                              → 'misnested'
//
// API pública:
//   buildSourceTree(src, tokens?) → { root, problems }
//
// Node element: { type: 'element', name, startTag, endTag, parent, children }
//   endTag és el token de tancament o null (no s'ha tancat).
// Node text / comment / doctype: { type, token, parent }
//
// Problema: { code, start, end, line, col, data }
//   codes: unclosed-element, stray-end-tag, misnested, void-end-tag,
//          p-closed-by-block, mismatched-end-tag, duplicate-attribute, unclosed-comment,
//          unterminated-tag, unterminated-attribute-value
// ════════════════════════════════════════════════════════

import { makeLineIndex } from '../util/text.js';
import { tokenizeHtml } from './html-tokenizer.js';
import { VOID_ELEMENTS, CLOSES_P, IMPLIED_END, IMPLIED_END_SCOPE } from './html-spec.js';

/**
 * @param {string} src
 * @param {Array<Object>} [tokens] si ja s'han calculat
 * @returns {{ root: Object, problems: Array<Object> }}
 */
export function buildSourceTree(src, tokens = tokenizeHtml(src)) {
  const root = { type: 'root', name: '#root', children: [], parent: null, startTag: null, endTag: null };
  const stack = [root];
  const problems = [];
  // Elements que el navegador ha tancat «abans d'hora» (p tancat per un bloc,
  // o interromput per un tancament mal niat): un </nom> posterior hi casa.
  const pendingClose = [];

  const top = () => stack[stack.length - 1];

  function report(code, token, data = {}, range = token) {
    problems.push({ code, start: range.start, end: range.end, data });
  }

  function append(node) {
    node.parent = top();
    top().children.push(node);
    return node;
  }

  function closeImplicitly(el, reason, token) {
    const removed = stack.splice(stack.indexOf(el));
    for (const inner of removed.slice(1)) reportUnclosed(inner);
    if (reason === 'p') {
      report('p-closed-by-block', token, { tag: token.name });
      pendingClose.push(el);
    } else {
      reportUnclosed(el);
    }
  }

  function reportUnclosed(el) {
    report('unclosed-element', el.startTag, { tag: el.name });
  }

  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        append({ type: 'text', token });
        break;

      case 'doctype':
        append({ type: 'doctype', token });
        if (!token.closed) report('unterminated-tag', token, { tag: '!DOCTYPE' });
        break;

      case 'comment':
        append({ type: 'comment', token });
        if (!token.closed) report(token.bogus ? 'unterminated-tag' : 'unclosed-comment', token, { tag: '!' });
        break;

      case 'startTag':
        onStartTag(token);
        break;

      case 'endTag':
        onEndTag(token);
        break;
    }
  }

  // Elements que queden oberts al final
  for (const el of stack.slice(1)) reportUnclosed(el);
  for (const el of pendingClose) {
    if (!el.endTag && el.misnestedBy) reportUnclosed(el);
  }

  const at = makeLineIndex(src);
  for (const problem of problems) Object.assign(problem, at(problem.start));
  problems.sort((a, b) => a.start - b.start);
  return { root, problems };

  function onStartTag(token) {
    if (!token.closed) report('unterminated-tag', token, { tag: token.name });
    const unclosedAttr = token.attrs.find((a) => !a.valueClosed);
    if (unclosedAttr) report('unterminated-attribute-value', token, { attr: unclosedAttr.name }, unclosedAttr);
    reportDuplicateAttributes(token);

    // Un bloc dins d'un <p> obert: el navegador tanca el <p>
    if (CLOSES_P.has(token.name)) {
      const p = findOpen('p', new Set(['div', 'section', 'article', 'body', 'main', 'li', 'td', 'th', 'blockquote']));
      if (p) closeImplicitly(p, 'p', token);
    }

    // <li> dins d'un <li> obert, <td> dins d'un <td>…: es tanca l'anterior
    for (const [name, closers] of Object.entries(IMPLIED_END)) {
      if (!closers.includes(token.name)) continue;
      const open = findOpen(name, IMPLIED_END_SCOPE);
      if (open) closeImplicitly(open, 'implied', token);
    }

    const el = append({ type: 'element', name: token.name, startTag: token, endTag: null, children: [] });
    if (!VOID_ELEMENTS.has(token.name)) stack.push(el);
  }

  function onEndTag(token) {
    if (!token.closed) report('unterminated-tag', token, { tag: '/' + token.name });

    if (VOID_ELEMENTS.has(token.name)) {
      report('void-end-tag', token, { tag: token.name });
      return;
    }

    const index = findOpenIndex(token.name);
    if (index === -1) {
      // Pot ser el tancament d'un element que el navegador ja havia tancat
      const pending = [...pendingClose].reverse().find((el) => el.name === token.name && !el.endTag);
      if (pending) {
        pending.endTag = token;
        if (pending.misnestedBy) {
          report('misnested', pending.misnestedBy, { outer: pending.misnestedBy.name, inner: pending.name });
        }
        return;
      }
      // <h1>Hola</h2>: probablement volia tancar l'element obert
      const open = top();
      if (open !== root && isLikelyMismatch(open, token)) {
        report('mismatched-end-tag', token, { open: open.name, close: token.name });
        open.endTag = token;
        stack.pop();
        return;
      }
      report('stray-end-tag', token, { tag: token.name });
      return;
    }

    // Elements oberts a sobre del que es tanca: o bé estan mal niats
    // (si després arriba el seu tancament) o bé no es tanquen mai
    for (const el of stack.slice(index + 1)) {
      el.misnestedBy = token;
      pendingClose.push(el);
    }
    stack[index].endTag = token;
    stack.splice(index);
  }

  // Un tancament que no casa amb res és probablement el de l'element obert
  // si tots dos són títols (<h1>…</h2>) o si són a la mateixa línia.
  function isLikelyMismatch(open, endToken) {
    const heading = /^h[1-6]$/;
    if (heading.test(open.name) && heading.test(endToken.name)) return true;
    return open.startTag.line === endToken.line;
  }

  function findOpenIndex(name) {
    for (let i = stack.length - 1; i > 0; i--) {
      if (stack[i].name === name) return i;
    }
    return -1;
  }

  // Element obert amb aquest nom, sense travessar cap element d'«àmbit»
  function findOpen(name, scope) {
    for (let i = stack.length - 1; i > 0; i--) {
      if (stack[i].name === name) return stack[i];
      if (scope.has(stack[i].name)) return null;
    }
    return null;
  }

  function reportDuplicateAttributes(token) {
    const seen = new Set();
    for (const attr of token.attrs) {
      if (seen.has(attr.name)) {
        report('duplicate-attribute', token, { tag: token.name, attr: attr.name }, attr);
      }
      seen.add(attr.name);
    }
  }
}
