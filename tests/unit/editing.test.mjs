// Tests de site/js/editor/editing.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newlineEdit, indentEdit, dedentEdit } from '../../site/js/editor/editing.js';

// Aplica una edició i marca la selecció amb | (cursor) o [ ] (selecció)
function apply(text, edit) {
  const out = text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
  if (edit.selStart === edit.selEnd) return out.slice(0, edit.selStart) + '|' + out.slice(edit.selStart);
  return out.slice(0, edit.selStart) + '[' + out.slice(edit.selStart, edit.selEnd) + ']' + out.slice(edit.selEnd);
}
// Posició del «|» dins d'un text d'exemple
const at = (marked) => ({ text: marked.replace('|', ''), pos: marked.indexOf('|') });

test('Retorn manté la indentació', () => {
  const { text, pos } = at('  <p>Hola</p>|');
  assert.equal(apply(text, newlineEdit(text, pos, 'html')), '  <p>Hola</p>\n  |');
});

test('Retorn després d\'una etiqueta d\'obertura afegeix un nivell', () => {
  const { text, pos } = at('<ul>|');
  assert.equal(apply(text, newlineEdit(text, pos, 'html')), '<ul>\n  |');
});

test('Retorn entre obertura i tancament baixa el tancament', () => {
  const { text, pos } = at('  <ul>|</ul>');
  assert.equal(apply(text, newlineEdit(text, pos, 'html')), '  <ul>\n    |\n  </ul>');
});

test('Retorn després d\'un element buit o d\'una etiqueta tancada no afegeix nivell', () => {
  for (const line of ['<br>|', '<img src="a.png" alt="a">|', '<p>x</p>|', '<br/>|', '<!-- c -->|']) {
    const { text, pos } = at(line);
    assert.equal(apply(text, newlineEdit(text, pos, 'html')), text + '\n|', line);
  }
});

test('Retorn al CSS després de «{» i entre «{}»', () => {
  let { text, pos } = at('h1 {|');
  assert.equal(apply(text, newlineEdit(text, pos, 'css')), 'h1 {\n  |');
  ({ text, pos } = at('h1 {|}'));
  assert.equal(apply(text, newlineEdit(text, pos, 'css')), 'h1 {\n  |\n}');
});

test('Tab sense selecció: espais fins al nivell següent', () => {
  let { text, pos } = at('|x');
  assert.equal(apply(text, indentEdit(text, pos, pos)), '  |x');
  ({ text, pos } = at(' |x'));
  assert.equal(apply(text, indentEdit(text, pos, pos)), '  |x');
});

test('Tab amb diverses línies seleccionades les indenta totes (no les buides)', () => {
  const text = '<ul>\n<li>a</li>\n\n<li>b</li>\n</ul>';
  const start = text.indexOf('<li>a');
  const end = text.indexOf('</ul>');
  assert.equal(apply(text, indentEdit(text, start, end)), '<ul>\n[  <li>a</li>\n\n  <li>b</li>]\n</ul>');
});

test('Maj+Tab desindenta la línia del cursor', () => {
  const { text, pos } = at('    <li>|a</li>');
  assert.equal(apply(text, dedentEdit(text, pos, pos)), '  <li>|a</li>');
});

test('Maj+Tab amb el cursor a l\'inici de la línia no passa enrere', () => {
  const { text, pos } = at('x\n|  y');
  assert.equal(apply(text, dedentEdit(text, pos, pos)), 'x\n|y');
});

test('Maj+Tab amb diverses línies', () => {
  const text = '  <li>a</li>\n   <li>b</li>\nc';
  assert.equal(apply(text, dedentEdit(text, 0, text.indexOf('\nc'))), '[<li>a</li>\n <li>b</li>]\nc');
});
