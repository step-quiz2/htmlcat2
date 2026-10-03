// ════════════════════════════════════════════════════════
// course/progress.js — Els exercicis que l'alumne ha superat
//
// Es desa al navegador (clau «progress», docs/STATE.md §2.5):
//   { goals: { 'cap-1-ex': 1759390000000, … } }   (moment de superar-lo)
// Es pot importar des de Node (no toca localStorage fins que es crida).
//
// API pública:
//   completedGoals()            → { goalId: timestamp }
//   isGoalCompleted(goalId)     → boolean
//   saveGoalCompleted(goalId)   → true si s'ha pogut desar
//   onProgress(callback)        callback(goals) cada vegada que se'n supera un
// ════════════════════════════════════════════════════════

import { load, save } from '../util/storage.js';

const KEY = 'progress';
const listeners = new Set();

/** @returns {Record<string, number>} */
export function completedGoals() {
  const value = load(KEY, null);
  return value && value.goals && typeof value.goals === 'object' ? value.goals : {};
}

/** @param {string} goalId */
export function isGoalCompleted(goalId) {
  return Boolean(completedGoals()[goalId]);
}

/**
 * Es conserva el moment de la primera vegada que se supera.
 *
 * @param {string} goalId
 * @returns {boolean}
 */
export function saveGoalCompleted(goalId) {
  const goals = completedGoals();
  const updated = { ...goals, [goalId]: goals[goalId] || Date.now() };
  const ok = save(KEY, { goals: updated });
  for (const callback of listeners) callback(updated);
  return ok;
}

/** @param {(goals: Record<string, number>) => void} callback */
export function onProgress(callback) {
  listeners.add(callback);
}
