// ════════════════════════════════════════════════════════
// sim/check-frame.js — L'iframe ocult on s'avaluen les comprovacions
//
// Les comprovacions no es fan a la previsualització que veu l'alumne:
// es fan en un iframe ocult de mida fixa (800 × 600, classe
// .sim-check-frame), perquè el resultat no depengui de la mida de la
// finestra. Té les mateixes proteccions que la previsualització
// (sandbox sense allow-scripts; la CSP ja ve dins del document).
//
// API pública:
//   renderForChecks(html, { forms }) → Promise<{ doc, dispose() }>
// ════════════════════════════════════════════════════════

/**
 * @param {string} html  el document (buildSrcdoc)
 * @param {{ forms?: boolean }} [options]
 * @returns {Promise<{ doc: Document, dispose: () => void }>}
 */
export function renderForChecks(html, { forms = false } = {}) {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.className = 'sim-check-frame';
    frame.setAttribute('sandbox', forms ? 'allow-same-origin allow-forms' : 'allow-same-origin');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.addEventListener('load', () => {
      // (un iframe nou pot carregar primer about:blank: s'espera el document de debò)
      if (frame.contentDocument?.URL !== 'about:srcdoc') return;
      resolve({ doc: frame.contentDocument, dispose: () => frame.remove() });
    });
    frame.srcdoc = html;
    document.body.append(frame);
  });
}
