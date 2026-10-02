// ════════════════════════════════════════════════════════
// pages/landing-page.js — Punt d'entrada de la portada
//
// Ressalta els exemples de codi (<pre class="code-example"
// data-lang="html|css">). Sense JavaScript, l'exemple es veu igual
// però sense colors.
// ════════════════════════════════════════════════════════

import { highlight } from '../editor/highlight.js';

for (const pre of document.querySelectorAll('pre.code-example[data-lang]')) {
  // highlight() escapa tot el text: el resultat és segur com a HTML
  pre.innerHTML = highlight(pre.textContent, pre.dataset.lang);
}
