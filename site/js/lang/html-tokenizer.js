// ════════════════════════════════════════════════════════
// lang/html-tokenizer.js — Tokenitzador d'HTML amb posicions (mòdul pur)
//
// Divideix el codi de l'alumne en peces (tokens) sense «arreglar-lo»:
// a diferència del navegador, conserva exactament el que hi ha escrit,
// amb la posició de cada peça. El fan servir el ressaltat, l'arbre del
// codi font (html-model.js) i el revisor de codi.
//
// No és el tokenitzador complet de l'HTML5: cobreix el que pot escriure
// un alumne (etiquetes, atributs, text, comentaris, doctype, <style>…)
// i marca els casos incomplets (etiqueta sense «>», cometa sense tancar…).
//
// API pública:
//   tokenizeHtml(src) → Token[]
//
// Tipus de token (tots tenen start, end, line, col; end és exclusiu):
//   { type: 'doctype',  closed }
//   { type: 'comment',  closed, bogus }          bogus: <!…> o <?…>
//   { type: 'startTag', name, rawName, nameStart, nameEnd, attrs,
//                       selfClosing, closed }
//   { type: 'endTag',   name, rawName, nameStart, nameEnd, closed }
//   { type: 'text',     raw }                    raw: contingut de <style>,
//                                                <script>, <title>, <textarea>
// Atribut: { name, rawName, start, end, nameStart, nameEnd,
//            value, valueStart, valueEnd, quote, valueClosed }
//   value === null si l'atribut no té «=» (p. ex. <input disabled>);
//   quote és '"', "'" o '' (sense cometes); valueClosed és false si
//   falta la cometa de tancament.
// ════════════════════════════════════════════════════════

import { makeLineIndex } from '../util/text.js';
import { RAW_TEXT_ELEMENTS, RCDATA_ELEMENTS } from './html-spec.js';

const WHITESPACE = /[\t\n\f\r ]/;
const TAG_NAME_START = /[a-zA-Z]/;

/**
 * @param {string} src
 * @returns {Array<Object>} tokens en ordre, sense forats ni encavalcaments
 */
export function tokenizeHtml(src) {
  const at = makeLineIndex(src);
  const tokens = [];
  let pos = 0;
  let textStart = 0;

  function push(token) {
    const { line, col } = at(token.start);
    token.line = line;
    token.col = col;
    tokens.push(token);
    return token;
  }

  function flushText(end) {
    if (end > textStart) push({ type: 'text', start: textStart, end, raw: false });
  }

  while (pos < src.length) {
    if (src[pos] !== '<') {
      pos++;
      continue;
    }
    const next = src[pos + 1];
    let token = null;

    if (src.startsWith('<!--', pos)) {
      token = readComment(src, pos);
    } else if (next === '!' || next === '?') {
      token = /^<!doctype/i.test(src.slice(pos, pos + 9))
        ? readDoctype(src, pos)
        : readBogusComment(src, pos);
    } else if (next === '/' && TAG_NAME_START.test(src[pos + 2] || '')) {
      token = readEndTag(src, pos);
    } else if (TAG_NAME_START.test(next || '')) {
      token = readStartTag(src, pos);
    }

    if (!token) {           // «<» solt: és text (com al navegador)
      pos++;
      continue;
    }

    flushText(pos);
    push(token);
    pos = token.end;
    textStart = pos;

    // Dins de <style>, <script>, <title> i <textarea> tot és text fins a </nom>
    if (token.type === 'startTag' &&
        (RAW_TEXT_ELEMENTS.has(token.name) || RCDATA_ELEMENTS.has(token.name))) {
      const close = findClosingTag(src, pos, token.name);
      if (close > pos) push({ type: 'text', start: pos, end: close, raw: true });
      pos = close;
      textStart = pos;
    }
  }
  flushText(src.length);
  return tokens;
}

function readComment(src, start) {
  const close = src.indexOf('-->', start + 4);
  return close === -1
    ? { type: 'comment', start, end: src.length, closed: false, bogus: false }
    : { type: 'comment', start, end: close + 3, closed: true, bogus: false };
}

function readBogusComment(src, start) {
  const close = src.indexOf('>', start + 2);
  return close === -1
    ? { type: 'comment', start, end: src.length, closed: false, bogus: true }
    : { type: 'comment', start, end: close + 1, closed: true, bogus: true };
}

function readDoctype(src, start) {
  const close = src.indexOf('>', start + 9);
  return close === -1
    ? { type: 'doctype', start, end: src.length, closed: false }
    : { type: 'doctype', start, end: close + 1, closed: true };
}

function readName(src, pos) {
  let end = pos;
  while (end < src.length && !WHITESPACE.test(src[end]) && src[end] !== '/' &&
         src[end] !== '>' && src[end] !== '<') {
    end++;
  }
  return end;
}

function readEndTag(src, start) {
  const nameStart = start + 2;
  const nameEnd = readName(src, nameStart);
  const rawName = src.slice(nameStart, nameEnd);
  const close = findTagEnd(src, nameEnd);
  return {
    type: 'endTag',
    name: rawName.toLowerCase(),
    rawName,
    nameStart,
    nameEnd,
    start,
    end: close.end,
    closed: close.closed,
  };
}

// Final d'una etiqueta: el primer «>»; si abans apareix un «<» (l'alumne
// ha oblidat el «>»), l'etiqueta acaba just abans i queda oberta.
function findTagEnd(src, pos) {
  for (let i = pos; i < src.length; i++) {
    if (src[i] === '>') return { end: i + 1, closed: true };
    if (src[i] === '<') return { end: i, closed: false };
  }
  return { end: src.length, closed: false };
}

function readStartTag(src, start) {
  const nameStart = start + 1;
  const nameEnd = readName(src, nameStart);
  const rawName = src.slice(nameStart, nameEnd);
  const attrs = [];
  let pos = nameEnd;
  let selfClosing = false;
  let closed = false;

  while (pos < src.length) {
    const c = src[pos];
    if (WHITESPACE.test(c)) { pos++; continue; }
    if (c === '>') { pos++; closed = true; break; }
    if (c === '<') break;                              // falta el «>»
    if (c === '/') {
      if (src[pos + 1] === '>') { selfClosing = true; pos += 2; closed = true; break; }
      pos++;
      continue;
    }
    const attr = readAttribute(src, pos);
    attrs.push(attr);
    pos = attr.end;
    if (!attr.valueClosed) break;                      // cometa sense tancar: fins al final
  }

  return {
    type: 'startTag',
    name: rawName.toLowerCase(),
    rawName,
    nameStart,
    nameEnd,
    attrs,
    selfClosing,
    start,
    end: pos,
    closed,
  };
}

function readAttribute(src, start) {
  // El primer caràcter pot ser «=» (error rar però possible): forma part del nom
  let nameEnd = start + 1;
  while (nameEnd < src.length && !WHITESPACE.test(src[nameEnd]) &&
         !'/>=<'.includes(src[nameEnd])) {
    nameEnd++;
  }
  const rawName = src.slice(start, nameEnd);
  const attr = {
    name: rawName.toLowerCase(),
    rawName,
    start,
    end: nameEnd,
    nameStart: start,
    nameEnd,
    value: null,
    valueStart: -1,
    valueEnd: -1,
    quote: null,
    valueClosed: true,
  };

  let pos = nameEnd;
  while (pos < src.length && WHITESPACE.test(src[pos])) pos++;
  if (src[pos] !== '=') return attr;
  pos++;
  while (pos < src.length && WHITESPACE.test(src[pos])) pos++;

  const q = src[pos];
  if (q === '"' || q === "'") {
    const close = src.indexOf(q, pos + 1);
    attr.quote = q;
    attr.valueStart = pos + 1;
    if (close === -1) {
      attr.valueEnd = src.length;
      attr.end = src.length;
      attr.valueClosed = false;
    } else {
      attr.valueEnd = close;
      attr.end = close + 1;
    }
  } else {
    let end = pos;
    while (end < src.length && !WHITESPACE.test(src[end]) && src[end] !== '>' && src[end] !== '<') end++;
    attr.quote = '';
    attr.valueStart = pos;
    attr.valueEnd = end;
    attr.end = end;
  }
  attr.value = src.slice(attr.valueStart, attr.valueEnd);
  return attr;
}

// Posició de «</nom» (sense distingir majúscules) seguit d'espai, «/» o «>»;
// si no hi és, el final del codi.
function findClosingTag(src, pos, name) {
  const re = new RegExp('</' + name + '(?=[\\t\\n\\f\\r />]|$)', 'ig');
  re.lastIndex = pos;
  const match = re.exec(src);
  return match ? match.index : src.length;
}
