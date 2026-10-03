// ════════════════════════════════════════════════════════
// lang/html-spec.js — Dades de l'HTML que fan servir els analitzadors
// (mòdul pur, només dades)
//
// Font: HTML Living Standard (WHATWG). Només el que necessiten
// el tokenitzador, l'arbre del codi font i el revisor de codi.
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

// ── Atributs (regles html/unknown-attribute i html/obsolete-attribute) ──

const words = (text) => new Set(text.split(/\s+/).filter(Boolean));

/**
 * Atributs que pot tenir qualsevol element. A més, també són vàlids els
 * que comencen per data-, aria- i on (gestors d'esdeveniments), i els que
 * porten dos punts (xml:lang, xlink:href…): vegeu isGlobalAttribute.
 */
export const GLOBAL_ATTRIBUTES = words(`
  accesskey autocapitalize autocorrect autofocus class contenteditable dir
  draggable enterkeyhint exportparts hidden id inert inputmode is itemid
  itemprop itemref itemscope itemtype lang nonce part popover role slot
  spellcheck style tabindex title translate virtualkeyboardpolicy
  writingsuggestions xmlns
`);

/** @param {string} name nom de l'atribut, en minúscules */
export const isGlobalAttribute = (name) =>
  GLOBAL_ATTRIBUTES.has(name) || /^(data-|aria-|on)/.test(name) || name.includes(':');

/** Atributs propis de cada element (a més dels globals). */
export const ELEMENT_ATTRIBUTES = Object.fromEntries(Object.entries({
  a: 'href target download ping rel hreflang type referrerpolicy',
  area: 'alt coords shape href target download ping rel referrerpolicy',
  audio: 'src crossorigin preload autoplay loop muted controls',
  base: 'href target',
  blockquote: 'cite',
  button: 'command commandfor disabled form formaction formenctype formmethod formnovalidate formtarget name popovertarget popovertargetaction type value',
  canvas: 'width height',
  col: 'span',
  colgroup: 'span',
  data: 'value',
  del: 'cite datetime',
  details: 'open name',
  dialog: 'open closedby',
  embed: 'src type width height',
  fieldset: 'disabled form name',
  form: 'accept-charset action autocomplete enctype method name novalidate target rel',
  iframe: 'src srcdoc name sandbox allow allowfullscreen width height referrerpolicy loading',
  img: 'alt src srcset sizes crossorigin usemap ismap width height referrerpolicy decoding loading fetchpriority',
  input: 'accept alpha alt autocomplete capture checked colorspace dirname disabled form formaction formenctype formmethod formnovalidate formtarget height list max maxlength min minlength multiple name pattern placeholder popovertarget popovertargetaction readonly required size src step switch type value width',
  ins: 'cite datetime',
  label: 'for',
  li: 'value',
  link: 'href crossorigin rel as media hreflang type sizes imagesrcset imagesizes referrerpolicy integrity blocking color disabled fetchpriority',
  map: 'name',
  meta: 'name http-equiv content charset media',
  meter: 'value min max low high optimum',
  object: 'data type name form width height',
  ol: 'reversed start type',
  optgroup: 'disabled label',
  option: 'disabled label selected value',
  output: 'for form name',
  progress: 'value max',
  q: 'cite',
  script: 'src type nomodule async defer crossorigin integrity referrerpolicy blocking fetchpriority',
  select: 'autocomplete disabled form multiple name required size',
  slot: 'name',
  source: 'type media src srcset sizes width height',
  style: 'media blocking type',
  td: 'colspan rowspan headers',
  template: 'shadowrootmode shadowrootdelegatesfocus shadowrootclonable shadowrootserializable',
  textarea: 'autocomplete cols dirname disabled form maxlength minlength name placeholder readonly required rows wrap',
  th: 'colspan rowspan headers scope abbr',
  time: 'datetime',
  track: 'default kind label src srclang',
  video: 'src crossorigin poster preload autoplay playsinline loop muted controls width height',
}).map(([name, list]) => [name, words(list)]));

/**
 * Atributs antics (ja no formen part de l'HTML, però el navegador encara
 * en fa cas d'alguns): l'aspecte es controla amb CSS.
 */
export const OBSOLETE_ATTRIBUTES = Object.fromEntries(Object.entries({
  a: 'charset coords name rev shape',
  area: 'nohref type hreflang',
  body: 'alink background bgcolor link text vlink marginheight marginwidth leftmargin topmargin rightmargin bottommargin',
  br: 'clear',
  caption: 'align',
  col: 'align char charoff valign width',
  colgroup: 'align char charoff valign width',
  div: 'align',
  dl: 'compact',
  embed: 'name align hspace vspace',
  h1: 'align', h2: 'align', h3: 'align', h4: 'align', h5: 'align', h6: 'align',
  head: 'profile',
  hr: 'align color noshade size width',
  html: 'manifest version',
  iframe: 'align frameborder longdesc marginheight marginwidth scrolling',
  img: 'align border hspace vspace longdesc name lowsrc',
  input: 'align usemap',
  label: 'form',
  legend: 'align',
  li: 'type',
  link: 'charset rev target',
  menu: 'compact',
  meta: 'scheme',
  object: 'align archive border classid code codebase codetype declare hspace standby typemustmatch usemap vspace',
  ol: 'compact',
  p: 'align',
  pre: 'width',
  script: 'charset event for language',
  table: 'align bgcolor border cellpadding cellspacing frame rules summary width height',
  tbody: 'align char charoff valign',
  td: 'abbr align axis bgcolor char charoff height nowrap scope valign width',
  tfoot: 'align char charoff valign',
  th: 'align axis bgcolor char charoff height nowrap valign width',
  thead: 'align char charoff valign',
  tr: 'align bgcolor char charoff valign height',
  ul: 'compact type',
}).map(([name, list]) => [name, words(list)]));

/**
 * Atributs que només admeten uns quants valors (sense distingir majúscules):
 * { element: { atribut: [valors] } } (regla html/invalid-attribute-value).
 */
export const ENUMERATED_ATTRIBUTES = {
  th: { scope: ['col', 'row', 'colgroup', 'rowgroup'] },
  // Els tipus més habituals, primer (el missatge en mostra uns quants)
  input: {
    type: ['text', 'email', 'password', 'number', 'tel', 'url', 'search', 'date', 'time',
      'checkbox', 'radio', 'file', 'color', 'range', 'datetime-local', 'month', 'week',
      'hidden', 'submit', 'reset', 'button', 'image'],
  },
  button: { type: ['submit', 'reset', 'button'] },
  form: { method: ['get', 'post', 'dialog'] },
};

/** Noms en català que els alumnes escriuen a vegades com a etiqueta (o com a selector). */
export const CATALAN_TAGS = {
  paragraf: 'p', parragraf: 'p', 'paràgraf': 'p', titol: 'h1', 'títol': 'h1',
  llista: 'ul', enllac: 'a', 'enllaç': 'a', imatge: 'img', negreta: 'strong',
  cursiva: 'em', taula: 'table', fila: 'tr', cos: 'body', capcalera: 'header',
  'capçalera': 'header', peu: 'footer', seccio: 'section', 'secció': 'section',
  boto: 'button', 'botó': 'button', formulari: 'form',
};

/** Elements de l'SVG que es poden fer servir com a selectors (no són d'HTML, però existeixen). */
export const SVG_ELEMENTS = new Set([
  'circle', 'clippath', 'defs', 'ellipse', 'foreignobject', 'g', 'image', 'line',
  'lineargradient', 'marker', 'mask', 'path', 'pattern', 'polygon', 'polyline',
  'radialgradient', 'rect', 'stop', 'symbol', 'text', 'textpath', 'tspan', 'use',
]);
