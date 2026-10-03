// Tests de site/js/course/data.js i progress.js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CAPITOLS, REPTES, PARTS, courseSequence, findPage, neighbours } from '../../site/js/course/data.js';
import { completedGoals, isGoalCompleted, saveGoalCompleted, onProgress } from '../../site/js/course/progress.js';
import { PREFIX } from '../../site/js/util/storage.js';

test('dades: capítols i reptes numerats des de l\'1, sense forats, amb el fitxer que toca', () => {
  CAPITOLS.forEach((capitol, i) => {
    assert.equal(capitol.num, i + 1);
    assert.equal(capitol.arxiu, `capitol-${capitol.num}.html`);
    assert.equal(capitol.goalId, `cap-${capitol.num}-ex`);
    assert.ok(capitol.part in PARTS, capitol.part);
    assert.ok(capitol.titol.trim());
  });
  REPTES.forEach((repte, i) => {
    assert.equal(repte.num, i + 1);
    assert.equal(repte.arxiu, `repte-${repte.num}.html`);
    assert.equal(repte.goalId, `repte-${repte.num}`);
    assert.ok(CAPITOLS.some((c) => c.num === repte.afterChapter), `repte ${repte.num}: afterChapter`);
  });
  const goals = [...CAPITOLS, ...REPTES].map((p) => p.goalId);
  assert.equal(new Set(goals).size, goals.length);
});

test('seqüència del curs, pàgina actual i anterior / següent', () => {
  const sequence = courseSequence();
  assert.equal(sequence.length, CAPITOLS.length + REPTES.length);
  assert.deepEqual(sequence[0], { pagina: 'capitol', ...CAPITOLS[0], chapter: 1 });
  assert.equal(findPage('capitol', 1).titol, CAPITOLS[0].titol);
  assert.equal(findPage('capitol', 999), null);
  assert.equal(findPage(undefined, NaN), null);
  assert.equal(neighbours('capitol', 1).prev, null);
  assert.deepEqual(neighbours('capitol', 999), { prev: null, next: null });
  const last = sequence.at(-1);
  assert.equal(neighbours(last.pagina, last.num).next, null);
});

class FakeStorage {
  constructor() { this.data = new Map(); }
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k, v) { this.data.set(k, String(v)); }
  removeItem(k) { this.data.delete(k); }
}

beforeEach(() => { globalThis.localStorage = new FakeStorage(); });

test('progrés: desa els exercicis superats i avisa', () => {
  assert.deepEqual(completedGoals(), {});
  assert.equal(isGoalCompleted('cap-1-ex'), false);
  const seen = [];
  onProgress((goals) => seen.push(Object.keys(goals)));
  assert.equal(saveGoalCompleted('cap-1-ex'), true);
  assert.equal(isGoalCompleted('cap-1-ex'), true);
  assert.deepEqual(seen, [['cap-1-ex']]);
  assert.ok(localStorage.data.has(PREFIX + 'progress'));
});

test('progrés: es conserva el moment de la primera vegada', () => {
  saveGoalCompleted('cap-1-ex');
  const first = completedGoals()['cap-1-ex'];
  saveGoalCompleted('cap-1-ex');
  assert.equal(completedGoals()['cap-1-ex'], first);
});

test('progrés: dades malmeses no fan fallar res', () => {
  localStorage.setItem(PREFIX + 'progress', '{"goals": 7}');
  assert.deepEqual(completedGoals(), {});
  localStorage.setItem(PREFIX + 'progress', 'no és json');
  assert.equal(isGoalCompleted('cap-1-ex'), false);
});
