// ════════════════════════════════════════════════════════
// preview/preview.js — Previsualització del codi de l'alumne
//
// Un <iframe sandbox="allow-same-origin"> amb srcdoc:
//   · sense allow-scripts: cap <script> ni onclick="" de l'alumne
//     no s'executa (ni <meta http-equiv="refresh">);
//   · amb allow-same-origin: aquesta pàgina pot llegir el document de
//     dins (DOM, estils calculats) per a les comprovacions i l'arbre.
// MAI no s'hi pot afegir allow-scripts: amb allow-same-origin, el codi
// de dins podria treure's el sandbox. (Comprovat a Chromium:
// docs/BLUEPRINT.md, apèndix A.)
//
// La navegació no surt mai de la previsualització: els clics als
// enllaços i els enviaments de formularis s'intercepten des d'aquí
// (els listeners d'aquesta pàgina sí que funcionen a dins).
//
// API pública:
//   createPreview(container, { title, forms, onLoad, onLink, onSubmit })
//     → { frame, render(html), document() }
//   onLink(href, doc)       clic a un enllaç (ja s'ha cancel·lat)
//   onSubmit(entries, form) enviament d'un formulari (només amb forms: true)
//   onLoad(doc)             cada vegada que s'acaba de pintar
// ════════════════════════════════════════════════════════

/**
 * @param {HTMLElement} container
 * @param {{ title: string, forms?: boolean, onLoad?: Function,
 *           onLink?: Function, onSubmit?: Function }} options
 */
export function createPreview(container, { title, forms = false, onLoad, onLink, onSubmit }) {
  const frame = document.createElement('iframe');
  frame.className = 'sim-preview__frame';
  frame.title = title;
  frame.setAttribute('sandbox', forms ? 'allow-same-origin allow-forms' : 'allow-same-origin');
  container.append(frame);

  let lastHtml = null;
  let scroll = { x: 0, y: 0 };

  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    if (!doc || lastHtml === null) return;
    frame.contentWindow.scrollTo(scroll.x, scroll.y);

    doc.addEventListener('click', (e) => {
      // (instanceof Element no serveix: els nodes de l'iframe són d'un altre «realm»)
      const link = typeof e.target.closest === 'function' ? e.target.closest('a[href]') : null;
      if (!link) return;
      e.preventDefault();
      const href = link.getAttribute('href');
      if (href.startsWith('#')) scrollToAnchor(doc, href.slice(1));
      onLink?.(href, doc);
    }, true);

    doc.addEventListener('submit', (e) => {
      e.preventDefault();
      const entries = [...new FormData(e.target)].map(([name, value]) => [name, String(value)]);
      onSubmit?.(entries, e.target);
    }, true);

    onLoad?.(doc);
  });

  return {
    frame,
    /** @param {string} html */
    render(html) {
      if (html === lastHtml) return;           // mateix contingut: res a fer
      const win = frame.contentWindow;
      if (win && lastHtml !== null) scroll = { x: win.scrollX, y: win.scrollY };
      lastHtml = html;
      frame.srcdoc = html;
    },
    document: () => frame.contentDocument,
  };
}

function scrollToAnchor(doc, id) {
  if (!id) {
    doc.defaultView.scrollTo(0, 0);
    return;
  }
  doc.getElementById(decodeURIComponent(id))?.scrollIntoView();
}
