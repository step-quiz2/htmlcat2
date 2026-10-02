// Tests de site/js/lang/html-tokenizer.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeHtml } from '../../site/js/lang/html-tokenizer.js';

const types = (src) => tokenizeHtml(src).map((t) => t.type);
const slices = (src) => tokenizeHtml(src).map((t) => src.slice(t.start, t.end));

test('cobreix tot el codi, sense forats ni encavalcaments', () => {
  const src = '<!DOCTYPE html>\n<p class="a">Hola <b>món</b></p>\n<!-- c -->\n<br>';
  assert.equal(slices(src).join(''), src);
});

test('reconeix doctype, comentaris, etiquetes i text', () => {
  assert.deepEqual(types('<!doctype html><!-- c --><p>x</p>'),
    ['doctype', 'comment', 'startTag', 'text', 'endTag']);
});

test('noms en minúscules, però conserva el nom original', () => {
  const [tag] = tokenizeHtml('<DIV>');
  assert.equal(tag.name, 'div');
  assert.equal(tag.rawName, 'DIV');
});

test('atributs amb cometes dobles, simples, sense cometes i sense valor', () => {
  const [tag] = tokenizeHtml('<input type="text" name=\'nom\' size=10 disabled>');
  assert.deepEqual(tag.attrs.map((a) => [a.name, a.value, a.quote]), [
    ['type', 'text', '"'],
    ['name', 'nom', "'"],
    ['size', '10', ''],
    ['disabled', null, null],
  ]);
  assert.ok(tag.closed);
});

test('posicions de l\'atribut i del valor', () => {
  const src = '<a href="x.html">';
  const [{ attrs: [attr] }] = tokenizeHtml(src);
  assert.equal(src.slice(attr.nameStart, attr.nameEnd), 'href');
  assert.equal(src.slice(attr.valueStart, attr.valueEnd), 'x.html');
  assert.equal(src.slice(attr.start, attr.end), 'href="x.html"');
});

test('espais al voltant del «=»', () => {
  const [tag] = tokenizeHtml('<p class = "a">');
  assert.equal(tag.attrs[0].value, 'a');
});

test('etiqueta que es tanca sola (<br/>)', () => {
  const [tag] = tokenizeHtml('<br/>');
  assert.ok(tag.selfClosing);
  assert.ok(tag.closed);
});

test('línia i columna de cada token', () => {
  const tokens = tokenizeHtml('<ul>\n  <li>x</li>\n</ul>');
  const li = tokens.find((t) => t.type === 'startTag' && t.name === 'li');
  assert.deepEqual([li.line, li.col], [2, 3]);
});

test('«<» solt és text', () => {
  assert.deepEqual(types('3 < 4 i 5 <= 6'), ['text']);
});

test('el contingut de <style> és text cru (no hi ha etiquetes)', () => {
  const tokens = tokenizeHtml('<style>p > a { color: red }</style>');
  assert.deepEqual(tokens.map((t) => t.type), ['startTag', 'text', 'endTag']);
  assert.ok(tokens[1].raw);
});

test('<title> no interpreta etiquetes, i el tancament no distingeix majúscules', () => {
  const tokens = tokenizeHtml('<title>A <b> B</TITLE>');
  assert.deepEqual(tokens.map((t) => t.type), ['startTag', 'text', 'endTag']);
});

test('comentari sense tancar arriba fins al final', () => {
  const [c] = tokenizeHtml('<!-- sense tancar <p>x</p>');
  assert.equal(c.type, 'comment');
  assert.equal(c.closed, false);
});

test('etiqueta sense «>» acaba abans del «<» següent', () => {
  const tokens = tokenizeHtml('<p class="a"\n<b>x</b>');
  assert.equal(tokens[0].closed, false);
  assert.equal(tokens[1].name, 'b');
});

test('cometa sense tancar', () => {
  const [tag] = tokenizeHtml('<img src="gat.png alt="gat">');
  assert.equal(tag.attrs[0].valueClosed, true);       // src="gat.png alt="
  assert.equal(tag.attrs[1].name, 'gat"');
  const [tag2] = tokenizeHtml('<img src="gat.png>');
  assert.equal(tag2.attrs[0].valueClosed, false);
  assert.equal(tag2.closed, false);
});

test('accents, entitats i salts de línia Windows', () => {
  const src = '<p title="Català">&copy; Adéu</p>\r\n';
  assert.equal(slices(src).join(''), src);
});

test('codi buit', () => {
  assert.deepEqual(tokenizeHtml(''), []);
});
