// ════════════════════════════════════════════════════════
// editor/code-examples.js — Ressalta els exemples de codi d'una pàgina
//
// <pre class="code-example" data-lang="html|css"> amb el codi escapat.
// Sense JavaScript, l'exemple es veu igual, però sense colors.
//
// API pública:
//   highlightCodeExamples(root = document)
// ════════════════════════════════════════════════════════

import { highlight } from './highlight.js';

/** @param {ParentNode} [root] */
export function highlightCodeExamples(root = document) {
  for (const pre of root.querySelectorAll('pre.code-example[data-lang]')) {
    // highlight() escapa tot el text: el resultat és segur com a HTML
    pre.innerHTML = highlight(pre.textContent, pre.dataset.lang);
  }
}
