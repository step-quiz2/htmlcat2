// ════════════════════════════════════════════════════════
// pages/course-page.js — Punt d'entrada dels capítols i dels reptes
//
// Afegeix l'estructura del curs (course/shell.js), ressalta els exemples
// de codi i munta cada simulador quan s'acosta a la pantalla (una pàgina
// amb vint simuladors no en crea vint de cop). El revisor de codi de cada
// simulador només aplica el que ja s'ha ensenyat fins a aquesta pàgina.
// ════════════════════════════════════════════════════════

import { initCoursePage } from '../course/shell.js';
import { highlightCodeExamples } from '../editor/code-examples.js';
import { mountSimulator } from '../sim/simulador.js';

const page = initCoursePage();
highlightCodeExamples();

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    observer.unobserve(entry.target);
    mountSimulator(entry.target, { chapter: page ? page.chapter : Infinity });
  }
}, { rootMargin: '200px' });

for (const host of document.querySelectorAll('.simulador')) observer.observe(host);
