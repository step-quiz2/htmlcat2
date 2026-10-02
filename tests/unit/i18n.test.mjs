// Tests de site/js/i18n/ca.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, KEYS } from '../../site/js/i18n/ca.js';

test('substitueix els paràmetres', () => {
  assert.equal(t('sim.link', { href: 'https://x.cat' }), 'Aquest enllaç portaria a: https://x.cat');
});

test('una clau que no existeix es veu tal qual', () => {
  assert.equal(t('no.existeix'), 'no.existeix');
});

test('cap text buit', () => {
  for (const key of KEYS) assert.ok(t(key).trim(), key);
});

test('cada clau que fa servir el codi existeix', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = new URL('../../site/js/', import.meta.url).pathname;
  const files = readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const src = readFileSync(join(dir, file), 'utf8');
    for (const [, key] of src.matchAll(/\bt\('([\w.]+)'/g)) assert.ok(KEYS.includes(key), `${file}: ${key}`);
  }
});
