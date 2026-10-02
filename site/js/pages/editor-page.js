// ════════════════════════════════════════════════════════
// pages/editor-page.js — Punt d'entrada de l'editor lliure
//
// Munta el simulador de la pàgina amb els botons Obre / Desa.
// El codi es desa al navegador amb la clau code:editor.
// ════════════════════════════════════════════════════════

import { mountSimulator } from '../sim/simulador.js';

for (const host of document.querySelectorAll('.simulador')) {
  mountSimulator(host, { fileActions: true });
}
