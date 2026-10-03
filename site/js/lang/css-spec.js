// ════════════════════════════════════════════════════════
// lang/css-spec.js — Dades del CSS que fa servir el revisor de codi
// (mòdul pur, només dades)
//
// Si una propietat existeix o no ho diu el navegador mateix
// (CSS.supports); aquesta llista només serveix per SUGGERIR el nom
// correcte quan l'alumne n'escriu un que no existeix («colr» → color).
// Hi ha les propietats que es fan servir en un curs d'iniciació, no totes.
// ════════════════════════════════════════════════════════

/** Propietats CSS habituals (per als suggeriments). */
export const CSS_PROPERTIES = [
  'align-content', 'align-items', 'align-self', 'aspect-ratio',
  'background', 'background-color', 'background-image', 'background-position',
  'background-repeat', 'background-size',
  'border', 'border-bottom', 'border-collapse', 'border-color', 'border-left',
  'border-radius', 'border-right', 'border-spacing', 'border-style', 'border-top',
  'border-width', 'bottom', 'box-shadow', 'box-sizing',
  'caption-side', 'clear', 'color', 'column-gap', 'content', 'cursor',
  'display', 'flex', 'flex-basis', 'flex-direction', 'flex-flow', 'flex-grow',
  'flex-shrink', 'flex-wrap', 'float', 'font', 'font-family', 'font-size',
  'font-style', 'font-variant', 'font-weight', 'gap', 'grid', 'grid-area',
  'grid-column', 'grid-row', 'grid-template-areas', 'grid-template-columns',
  'grid-template-rows', 'height', 'justify-content', 'justify-items', 'left',
  'letter-spacing', 'line-height', 'list-style', 'list-style-type',
  'margin', 'margin-bottom', 'margin-left', 'margin-right', 'margin-top',
  'max-height', 'max-width', 'min-height', 'min-width', 'object-fit', 'opacity',
  'order', 'outline', 'overflow', 'padding', 'padding-bottom', 'padding-left',
  'padding-right', 'padding-top', 'position', 'right', 'row-gap',
  'text-align', 'text-decoration', 'text-indent', 'text-shadow', 'text-transform',
  'top', 'transform', 'transition', 'vertical-align', 'visibility',
  'white-space', 'width', 'word-spacing', 'z-index',
];
