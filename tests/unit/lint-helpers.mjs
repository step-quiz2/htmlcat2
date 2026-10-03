// Ajudes compartides pels tests del revisor de codi (no és un test)
import { lintStatic } from '../../site/js/lint/lint.js';

const KNOWN = new Set(['color', 'background-color', 'background', 'font-size', 'font-family', 'font', 'margin',
  'margin-top', 'margin-bottom', 'padding', 'width', 'height', 'max-width', 'gap', 'text-align', 'content', 'display',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-style', 'border-radius',
  'box-sizing', 'float', 'position', 'line-height', 'font-weight']);
const COLOURS = /^(red|teal|blue|white|black|orange|#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(.*\)|hsl\(.*\))$/i;
const LENGTH = /^(0|-?(\d+\.?\d*|\.\d+)(px|em|rem|%))$/;
const STYLES = /^(none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset)$/;

// Cada part ha de ser una mida, un estil o un color, i com a molt un de cada
function isBorder(value) {
  const parts = value.split(/\s+/);
  const kinds = parts.map((part) => (LENGTH.test(part) && !part.startsWith('-') ? 'width' : STYLES.test(part) ? 'style' : COLOURS.test(part) ? 'color' : null));
  return !kinds.includes(null) && new Set(kinds).size === kinds.length;
}

/**
 * Imitació de CSS.supports per a Node: només les propietats i els valors
 * que fan servir els tests.
 */
export function supports(property, value) {
  if (!KNOWN.has(property)) return false;
  if (value === 'initial') return true;
  if (/var\(\s*--/i.test(value)) return true;   // com el navegador: amb var() no es pot saber fins al final
  const parts = value.split(/\s+/);
  const lengths = (max, { negative = true, auto = false } = {}) => parts.length <= max &&
    parts.every((part) => (LENGTH.test(part) && (negative || !part.startsWith('-'))) || (auto && part === 'auto'));
  switch (property) {
    case 'color':
    case 'background':
    case 'background-color': return COLOURS.test(value);
    case 'font-weight': return /^(normal|bold|[1-9]00)$/.test(value);
    case 'line-height': return /^(normal|\d+\.?\d*)$/.test(value) || LENGTH.test(value);
    case 'text-align': return /^(left|center|right|justify)$/.test(value);
    case 'display': return /^(block|inline|inline-block|flex|grid|none)$/.test(value);
    case 'content': return /^(".*"|'.*'|none)$/.test(value);
    case 'font-family': return value.length > 0;
    case 'font': return /^\S+ \S+/.test(value) && LENGTH.test(parts.find((part) => /\d/.test(part)) || '');
    case 'border':
    case 'border-top':
    case 'border-right':
    case 'border-bottom':
    case 'border-left': return isBorder(value);
    case 'border-style': return parts.length <= 4 && parts.every((part) => STYLES.test(part));
    case 'box-sizing': return /^(content-box|border-box)$/.test(value);
    case 'float': return /^(left|right|none)$/.test(value);
    case 'position': return /^(static|relative|absolute|fixed|sticky)$/.test(value);
    case 'margin': return lengths(4, { auto: true });
    case 'padding': return lengths(4, { negative: false });
    case 'width':
    case 'height':
    case 'max-width': return lengths(1, { negative: false, auto: true });
    case 'gap': return lengths(2, { negative: false });
    default: return lengths(4);
  }
}

/** Codi d'un cas: text (index.html) o { files, mode, chapter }. */
export function lintCase(input) {
  const options = typeof input === 'string' ? { files: { 'index.html': input } } : input;
  return lintStatic({ env: { supports }, ...options });
}

export const css = (src) => ({ files: { 'estils.css': src } });

export const rulesOf = (input) => lintCase(input).map((p) => p.rule);

/** Document sencer ben escrit, amb `body` dins del <body>. */
export function doc(body = '    <h1>Hola</h1>\n') {
  return '<!DOCTYPE html>\n<html lang="ca">\n  <head>\n    <meta charset="UTF-8">\n' +
    '    <title>Prova</title>\n  </head>\n  <body>\n' + body + '  </body>\n</html>\n';
}

export const documentCase = (src) => ({ files: { 'index.html': src }, mode: 'document' });
