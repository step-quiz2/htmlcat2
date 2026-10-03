// Ajudes compartides pels tests del revisor de codi (no és un test)
import { lintStatic } from '../../site/js/lint/lint.js';

const KNOWN = new Set(['color', 'background-color', 'background', 'font-size', 'font-family', 'margin',
  'padding', 'width', 'text-align', 'content', 'display', 'border-left', 'line-height', 'font-weight']);
const COLOURS = /^(red|teal|blue|white|black|orange|#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(.*\)|hsl\(.*\))$/i;
const LENGTH = /^(0|-?(\d+\.?\d*|\.\d+)(px|em|rem|%))$/;

/**
 * Imitació de CSS.supports per a Node: només les propietats i els valors
 * que fan servir els tests.
 */
export function supports(property, value) {
  if (!KNOWN.has(property)) return false;
  if (value === 'initial') return true;
  if (/var\(\s*--/i.test(value)) return true;   // com el navegador: amb var() no es pot saber fins al final
  switch (property) {
    case 'color':
    case 'background':
    case 'background-color': return COLOURS.test(value);
    case 'font-weight': return /^(normal|bold|[1-9]00)$/.test(value);
    case 'line-height': return /^(normal|\d+\.?\d*)$/.test(value) || LENGTH.test(value);
    case 'text-align': return /^(left|center|right|justify)$/.test(value);
    case 'display': return /^(block|inline|flex|none)$/.test(value);
    case 'content': return /^(".*"|'.*'|none)$/.test(value);
    case 'font-family': return value.length > 0;
    case 'border-left': {
      const parts = /^(\S+) (solid|dashed|dotted) (\S+)$/.exec(value);
      return Boolean(parts) && LENGTH.test(parts[1]) && COLOURS.test(parts[3]);
    }
    default: return value.split(/\s+/).every((part) => LENGTH.test(part));
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
