// ════════════════════════════════════════════════════════
// pages/landing-page.js — Punt d'entrada de la portada
//
// Ressalta els exemples de codi i omple la llista de capítols
// (<ol data-capitols>) a partir de course/data.js, amb ✓ als que
// l'alumne ja ha superat.
// ════════════════════════════════════════════════════════

import { highlightCodeExamples } from '../editor/code-examples.js';
import { courseSequence } from '../course/data.js';
import { completedGoals } from '../course/progress.js';
import { t } from '../i18n/ca.js';

highlightCodeExamples();

const list = document.querySelector('[data-capitols]');
if (list) {
  const goals = completedGoals();
  for (const page of courseSequence()) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = 'curs/' + page.arxiu;
    link.textContent = `${page.pagina === 'repte' ? t('course.repte', { num: page.num }) : t('course.chapter', { num: page.num })}: ${page.titol}`;
    item.append(link);
    if (goals[page.goalId]) item.append(' ✓');
    list.append(item);
  }
}
