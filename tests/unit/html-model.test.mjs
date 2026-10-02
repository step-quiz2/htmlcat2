// Tests de site/js/lang/html-model.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSourceTree } from '../../site/js/lang/html-model.js';

const codes = (src) => buildSourceTree(src).problems.map((p) => p.code);
const first = (src) => buildSourceTree(src).problems[0];

test('un document ben escrit no té problemes', () => {
  const src = `<!DOCTYPE html>
<html lang="ca">
  <head>
    <meta charset="UTF-8">
    <title>Prova</title>
    <style>
      p > a { color: red; }
    </style>
  </head>
  <body>
    <!-- comentari -->
    <h1>Hola</h1>
    <ul>
      <li>Pomes</li>
      <li>Peres</li>
    </ul>
    <p>Text<br>amb <a href="#x">enllaç</a>.</p>
    <img src="gat.png" alt="Un gat">
  </body>
</html>
`;
  assert.deepEqual(codes(src), []);
});

test('construeix l\'arbre tal com està escrit', () => {
  const { root } = buildSourceTree('<ul><li>a</li><li>b</li></ul>');
  const ul = root.children[0];
  assert.equal(ul.name, 'ul');
  assert.deepEqual(ul.children.map((c) => c.name), ['li', 'li']);
  assert.equal(ul.children[0].parent, ul);
  assert.ok(ul.endTag);
});

test('element sense tancar', () => {
  const p = first('<div>\n  <p>Hola\n</div>');
  assert.equal(p.code, 'unclosed-element');
  assert.equal(p.data.tag, 'p');
  assert.deepEqual([p.line, p.col], [2, 3]);
});

test('element sense tancar al final del codi', () => {
  assert.deepEqual(codes('<section><h2>x</h2>'), ['unclosed-element']);
});

test('tancament que no correspon a res', () => {
  const p = first('<p>x</p>\n</span>');
  assert.equal(p.code, 'stray-end-tag');
  assert.equal(p.data.tag, 'span');
  assert.equal(p.line, 2);
});

test('etiquetes mal niades', () => {
  const p = first('<p><b>negreta <i>cursiva</b> mal</i></p>');
  assert.equal(p.code, 'misnested');
  assert.deepEqual(p.data, { outer: 'b', inner: 'i' });
  assert.deepEqual(codes('<p><b>negreta <i>cursiva</b> mal</i></p>'), ['misnested']);
});

test('tancament amb un nom diferent: <h1>…</h2>', () => {
  const p = first('<h1>Hola</h2>');
  assert.equal(p.code, 'mismatched-end-tag');
  assert.deepEqual(p.data, { open: 'h1', close: 'h2' });
  assert.equal(codes('<h1>Hola</h2>').length, 1);
});

test('element buit amb tancament: </br>, </img>', () => {
  assert.deepEqual(codes('<br></br>'), ['void-end-tag']);
  assert.deepEqual(codes('<img src="a.png" alt="a"></img>'), ['void-end-tag']);
});

test('un bloc dins d\'un <p> tanca el <p>', () => {
  const src = '<p>Llista:\n  <ul>\n    <li>a</li>\n  </ul>\n</p>';
  assert.deepEqual(codes(src), ['p-closed-by-block']);
  assert.equal(first(src).data.tag, 'ul');
});

test('<li> sense tancar abans del següent <li>', () => {
  const src = '<ul>\n  <li>Pomes\n  <li>Peres</li>\n</ul>';
  const p = first(src);
  assert.equal(p.code, 'unclosed-element');
  assert.equal(p.data.tag, 'li');
  assert.equal(p.line, 2);
  assert.equal(codes(src).length, 1);
});

test('llistes niades correctes no donen problemes', () => {
  assert.deepEqual(codes('<ul><li>Fruita<ul><li>Pomes</li></ul></li></ul>'), []);
});

test('atribut repetit', () => {
  const p = first('<p class="a"\n   class="b">x</p>');
  assert.equal(p.code, 'duplicate-attribute');
  assert.equal(p.data.attr, 'class');
  assert.equal(p.line, 2);
});

test('comentari i etiqueta sense tancar, cometa sense tancar', () => {
  assert.deepEqual(codes('<!-- x'), ['unclosed-comment']);
  assert.ok(codes('<p class="a"\n<b>x</b>').includes('unterminated-tag'));
  assert.ok(codes('<img src="gat.png>').includes('unterminated-attribute-value'));
});

test('els problemes surten ordenats per posició', () => {
  const { problems } = buildSourceTree('</a>\n<p>\n<br></br>');
  const starts = problems.map((p) => p.start);
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b));
});
