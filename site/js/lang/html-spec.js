// ════════════════════════════════════════════════════════
// lang/html-spec.js — Dades de l'HTML que fan servir els analitzadors
// (mòdul pur, només dades)
//
// Font: HTML Living Standard (WHATWG). Només el que necessiten
// el tokenitzador, l'arbre del codi font i el revisor de codi.
// Els atributs per element s'afegiran amb la regla
// html/unknown-attribute (fase 3).
// ════════════════════════════════════════════════════════

/** Elements buits: no tenen contingut ni etiqueta de tancament. */
export const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr',
]);

/** El contingut és text pla fins a </nom> (no hi ha etiquetes a dins). */
export const RAW_TEXT_ELEMENTS = new Set(['script', 'style']);

/** Com els anteriors, però el navegador hi interpreta les entitats (&amp;). */
export const RCDATA_ELEMENTS = new Set(['textarea', 'title']);

/**
 * Elements que, si s'obren dins d'un <p>, fan que el navegador tanqui
 * el <p> abans (l'alumne creu que són a dins i no ho són).
 */
export const CLOSES_P = new Set([
  'address', 'article', 'aside', 'blockquote', 'details', 'dialog', 'div',
  'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'main',
  'menu', 'nav', 'ol', 'p', 'pre', 'search', 'section', 'table', 'ul',
]);

/**
 * Elements amb etiqueta de tancament opcional que el navegador tanca sol
 * quan s'obre un germà: { element: [elements que el tanquen] }.
 * A HTMLCat ensenyem a tancar-los sempre, i l'arbre ho detecta.
 */
export const IMPLIED_END = {
  li: ['li'],
  dt: ['dt', 'dd'],
  dd: ['dt', 'dd'],
  option: ['option', 'optgroup'],
  tr: ['tr'],
  td: ['td', 'th', 'tr'],
  th: ['td', 'th', 'tr'],
};

/** On s'atura la cerca d'un element obert d'IMPLIED_END (el seu «àmbit»). */
export const IMPLIED_END_SCOPE = new Set(['ul', 'ol', 'menu', 'dl', 'select', 'datalist', 'table', 'tbody', 'thead', 'tfoot']);

/** Elements obsolets de presentació (el CSS els substitueix). */
export const DEPRECATED_ELEMENTS = new Set([
  'acronym', 'applet', 'basefont', 'big', 'blink', 'center', 'dir', 'font',
  'frame', 'frameset', 'marquee', 'nobr', 'noframes', 'strike', 'tt',
]);

/** Tots els elements vàlids de l'HTML actual (més els obsolets, a part). */
export const KNOWN_ELEMENTS = new Set([
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio',
  'b', 'base', 'bdi', 'bdo', 'blockquote', 'body', 'br', 'button',
  'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
  'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt',
  'em', 'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html',
  'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label', 'legend', 'li', 'link',
  'main', 'map', 'mark', 'menu', 'meta', 'meter', 'nav', 'noscript',
  'object', 'ol', 'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress',
  'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'search', 'section', 'select',
  'slot', 'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup',
  'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time',
  'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr',
  // SVG i MathML incrustats (no s'ensenyen, però són vàlids)
  'svg', 'math',
]);
