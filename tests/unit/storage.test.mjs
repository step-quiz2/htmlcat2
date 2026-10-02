// Tests de site/js/util/storage.js (amb un localStorage fals)
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { load, save, remove, PREFIX } from '../../site/js/util/storage.js';

class FakeStorage {
  constructor() { this.data = new Map(); this.full = false; }
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k, v) { if (this.full) throw new Error('QuotaExceededError'); this.data.set(k, String(v)); }
  removeItem(k) { this.data.delete(k); }
}

beforeEach(() => { globalThis.localStorage = new FakeStorage(); });

test('desa i llegeix JSON amb el prefix htmlcat:v1:', () => {
  assert.equal(save('code:x', { files: { 'index.html': '<p>à</p>' } }), true);
  assert.deepEqual(load('code:x', null), { files: { 'index.html': '<p>à</p>' } });
  assert.ok(localStorage.data.has(PREFIX + 'code:x'));
  assert.equal(PREFIX, 'htmlcat:v1:');
});

test('valor per defecte si no hi ha res o les dades estan malmeses', () => {
  assert.equal(load('res', 7), 7);
  localStorage.setItem(PREFIX + 'malmès', '{no és json');
  assert.equal(load('malmès', 'per defecte'), 'per defecte');
});

test('si no es pot desar, retorna false i no falla', () => {
  localStorage.full = true;
  assert.equal(save('a', 1), false);
});

test('sense localStorage (o bloquejat), tot funciona sense fallar', () => {
  delete globalThis.localStorage;
  assert.equal(save('a', 1), false);
  assert.equal(load('a', 'x'), 'x');
  remove('a');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  assert.equal(load('a', 'x'), 'x');
  assert.equal(save('a', 1), false);
  delete globalThis.localStorage;
});

test('remove esborra', () => {
  save('a', 1);
  remove('a');
  assert.equal(load('a', null), null);
});
