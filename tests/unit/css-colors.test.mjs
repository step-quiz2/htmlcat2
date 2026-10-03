// Tests de site/js/lang/css-colors.js: llegir colors i calcular el contrast
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAMED_COLORS, parseColor, contrastRatio } from '../../site/js/lang/css-colors.js';

test('noms de colors: els 148 del CSS', () => {
  assert.equal(Object.keys(NAMED_COLORS).length, 148);
  assert.deepEqual(NAMED_COLORS.teal, [0, 128, 128]);
  assert.deepEqual(NAMED_COLORS.rebeccapurple, [102, 51, 153]);
  assert.deepEqual(parseColor('Tomato'), [255, 99, 71, 1]);
  assert.deepEqual(parseColor('transparent'), [0, 0, 0, 0]);
  assert.equal(parseColor('vermell'), null);
});

test('el mateix color escrit de totes les maneres', () => {
  for (const text of ['tomato', '#ff6347', '#FF6347', 'rgb(255, 99, 71)', 'rgb(255 99 71)', 'rgba(255, 99, 71, 1)',
    'hsl(9, 100%, 64%)', 'hsl(9deg 100% 64%)', ' #ff6347 ']) {
    assert.deepEqual(parseColor(text), [255, 99, 71, 1], text);
  }
  assert.deepEqual(parseColor('#f60'), [255, 102, 0, 1]);
  assert.deepEqual(parseColor('#f608'), [255, 102, 0, 0x88 / 255]);
  assert.deepEqual(parseColor('#ff660080'), [255, 102, 0, 128 / 255]);
  assert.deepEqual(parseColor('rgb(100%, 0%, 50%)'), [255, 0, 128, 1]);
  assert.deepEqual(parseColor('rgb(0 0 0 / 50%)'), [0, 0, 0, 0.5]);
  assert.deepEqual(parseColor('hsla(120, 100%, 25%, 0.5)'), [0, 128, 0, 0.5]);
  assert.deepEqual(parseColor('hsl(0, 0%, 100%)'), [255, 255, 255, 1]);
  assert.deepEqual(parseColor('hsl(-120, 100%, 50%)'), [0, 0, 255, 1]);
  assert.deepEqual(parseColor('hsl(0.5turn 50% 50%)'), [64, 191, 191, 1]);
  assert.deepEqual(parseColor('rgb(300, -5, 0)'), [255, 0, 0, 1]);   // com el navegador: es retalla a 0–255
});

test('el que no és un color', () => {
  for (const text of ['', '#ff634', '#ggg', 'ff6347', 'rgb(1, 2)', 'rgb(a, b, c)', 'var(--x)', 'red blue', 'hsl(1, 2%)', 'hsl(10px, 50%, 50%)']) {
    assert.equal(parseColor(text), null, text);
  }
});

test('contrast (WCAG): de 1:1 a 21:1, igual en tots dos sentits', () => {
  const ratio = (a, b) => contrastRatio(parseColor(a), parseColor(b));
  assert.equal(ratio('black', 'white'), 21);
  assert.equal(ratio('teal', 'teal'), 1);
  assert.equal(ratio('#777', 'white'), ratio('white', '#777'));
  assert.equal(ratio('#777', 'white').toFixed(2), '4.48');      // per poc no arriba a 4,5
  assert.equal(ratio('#767676', 'white').toFixed(2), '4.54');
  assert.equal(ratio('gray', 'white').toFixed(2), '3.95');
});
