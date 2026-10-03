// Tests de cada regla del revisor de codi (site/js/lint/rules-*.js):
// per a cada regla, un codi que l'ha de disparar i un que no.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../../site/js/lint/lint.js';
import { lintCase, rulesOf, css, doc, documentCase } from './lint-helpers.mjs';

const GOOD_CSS = 'h1 {\n  color: red;\n  font-size: 2em;\n}\n';

/** id de la regla → [codi que la dispara, codi correcte] */
const CASES = {
  // HTML: estructura
  'html/unclosed-element': ['<div>\n  <p>Hola</p>\n', '<div>\n  <p>Hola</p>\n</div>\n'],
  'html/stray-end-tag': ['<p>Hola</p></span>\n', '<p>Hola</p>\n'],
  'html/mismatched-end-tag': ['<h1>Hola</h2>\n', '<h1>Hola</h1>\n'],
  'html/misnested': ['<p><b><i>x</b></i></p>\n', '<p><b><i>x</i></b></p>\n'],
  'html/void-end-tag': ['<p>a<br></br>b</p>\n', '<p>a<br>b</p>\n'],
  'html/p-closed-by-block': ['<p>\n  <h2>Títol</h2>\n</p>\n', '<p>Text</p>\n<h2>Títol</h2>\n'],
  'html/duplicate-attribute': ['<p class="a" class="b">x</p>\n', '<p class="a b">x</p>\n'],
  'html/unterminated-tag': ['<p class="a"\n<b>x</b>\n', '<p class="a"><b>x</b></p>\n'],
  'html/unterminated-attribute-value': ['<p>\n  <img src="gat.svg>\n</p>\n', '<p>\n  <img src="gat.svg" alt="">\n</p>\n'],
  'html/unclosed-comment': ['<!-- comentari\n<p>x</p>\n', '<!-- comentari -->\n<p>x</p>\n'],
  // HTML: codi net
  'html/uppercase': ['<P CLASS="a">x</P>\n', '<p class="a">x</p>\n<svg viewBox="0 0 1 1"></svg>\n'],
  'html/unquoted-attribute': ['<p class=avis>x</p>\n', '<p class="avis">x</p>\n<input disabled>\n'],
  'html/indentation': ['<ul>\n<li>x</li>\n</ul>\n', '<ul>\n  <li>x</li>\n</ul>\n'],
  // HTML: document sencer
  'html/doctype': [documentCase(doc().replace('<!DOCTYPE html>\n', '')), documentCase(doc())],
  'html/lang': [documentCase(doc().replace(' lang="ca"', '')), documentCase(doc())],
  'html/charset': [documentCase(doc().replace('    <meta charset="UTF-8">\n', '')), documentCase(doc())],
  'html/title': [documentCase(doc().replace('    <title>Prova</title>\n', '')), documentCase(doc())],
  // HTML: elements
  'html/unknown-element': ['<titel>x</titel>\n', '<p>x</p>\n<meu-element>x</meu-element>\n'],
  'html/deprecated-element': ['<center>x</center>\n', '<p>x</p>\n'],
  'html/heading-order': ['<h1>a</h1>\n<h3>b</h3>\n', '<h1>a</h1>\n<h2>b</h2>\n<h3>c</h3>\n<h2>d</h2>\n'],
  'html/single-h1': ['<h1>a</h1>\n<h1>b</h1>\n', '<h1>a</h1>\n<h2>b</h2>\n'],
  'html/br-spacing': ['<p>a<br>\n<br>b</p>\n', '<p>a<br>b<br>c</p>\n'],
  'html/list-structure': ['<li>x</li>\n', '<ul>\n  <li>x</li>\n</ul>\n'],
  'html/inline-style': ['<p style="color: red">x</p>\n', '<p class="avis">x</p>\n'],
  // CSS: errors
  'css/unbalanced-braces': [css('h1 {\n  color: red;\n'), css(GOOD_CSS)],
  'css/missing-semicolon': [css('h1 {\n  color: red\n  font-size: 2em;\n}\n'), css(GOOD_CSS)],
  'css/missing-colon': [css('h1 {\n  color red;\n}\n'), css(GOOD_CSS)],
  'css/empty-value': [css('h1 {\n  color: ;\n}\n'), css(GOOD_CSS)],
  'css/unclosed-comment': [css('/* comentari\nh1 {\n  color: red;\n}\n'), css('/* comentari */\n' + GOOD_CSS)],
  'css/unclosed-string': [css('p::before {\n  content: "hola;\n}\n'), css('p::before {\n  content: "hola";\n}\n')],
  'css/unknown-property': [css('h1 {\n  colr: red;\n}\n'), css('h1 {\n  color: red;\n  --meu-color: red;\n}\n')],
  'css/invalid-value': [css('h1 {\n  color: vermell;\n}\n'), css(GOOD_CSS)],
  'css/last-semicolon': [css('h1 {\n  color: red\n}\n'), css(GOOD_CSS)],
  'css/one-declaration-per-line': [css('h1 {\n  color: red; font-size: 2em;\n}\n'), css('h1 { color: red; }\n')],
  'css/indentation': [css('h1 {\ncolor: red;\n}\n'), css(GOOD_CSS)],
};

test('cada regla del catàleg té un cas que la dispara i un que no', () => {
  assert.deepEqual(Object.keys(CASES).sort(), RULES.map((r) => r.id).sort());
});

for (const [id, [bad, good]] of Object.entries(CASES)) {
  test(id, () => {
    const found = lintCase(bad).filter((p) => p.rule === id);
    assert.ok(found.length, `no ha detectat ${id}`);
    for (const p of found) {
      for (const text of [p.text, p.hint]) {
        assert.ok(text.trim(), `${id}: missatge buit`);
        assert.doesNotMatch(text, /undefined|null|NaN|\[object/, `${id}: ${text}`);
      }
      assert.ok(p.line >= 1 && p.col >= 1 && p.start <= p.end, `${id}: posició`);
    }
    assert.ok(!rulesOf(good).includes(id), `${id} s'ha disparat amb codi correcte`);
  });
}

// ── Detalls de regles concretes ──

const first = (input, id) => lintCase(input).find((p) => p.rule === id);

test('suggeriments: noms semblants i noms en català', () => {
  assert.equal(first('<titel>x</titel>\n', 'html/unknown-element').data.suggestion, 'title');
  assert.equal(first('<parragraf>x</parragraf>\n', 'html/unknown-element').data.suggestion, 'p');
  assert.equal(first('<xyzzy>x</xyzzy>\n', 'html/unknown-element').data.suggestion, null);
  assert.equal(first(css('h1 {\n  colr: red;\n}\n'), 'css/unknown-property').data.suggestion, 'color');
  assert.equal(first(css('h1 {\n  color-de-fons: red;\n}\n'), 'css/unknown-property').data.suggestion, 'background-color');
});

test('css/invalid-value explica els errors típics', () => {
  const kind = (decl) => first(css(`h1 {\n  ${decl};\n}\n`), 'css/invalid-value')?.data;
  assert.deepEqual(kind('color: vermell'), { property: 'color', value: 'vermell', kind: 'catalan-colour', fix: 'red' });
  assert.equal(kind('font-size: 1,5em').kind, 'comma');
  assert.equal(kind('font-size: 1,5em').fix, '1.5em');
  assert.equal(kind('margin: 10').kind, 'unit');
  assert.equal(kind('margin: 0 10').fix, '0 10px');
  assert.equal(kind('text-align: centre').kind, 'generic');
  assert.equal(kind('margin: 0'), undefined);
});

test('si falta un «;», no es diu també que el valor és invàlid', () => {
  assert.deepEqual(rulesOf(css('h1 {\n  color: red\n  font-size: 2em;\n}\n')), ['css/missing-semicolon']);
});

test('sense supports (Node sense imitació), les regles de propietats i valors no fan res', async () => {
  const { lintStatic } = await import('../../site/js/lint/lint.js');
  const problems = lintStatic({ files: { 'estils.css': 'h1 {\n  colr: vermell;\n}\n' } });
  assert.deepEqual(problems.map((p) => p.rule), []);
});

test('html/doctype: falta, no és el primer o és antic', () => {
  const kind = (src) => first(documentCase(src), 'html/doctype')?.data.kind;
  assert.equal(kind(doc().replace('<!DOCTYPE html>\n', '')), 'missing');
  assert.equal(kind('<p>x</p>\n' + doc()), 'late');
  assert.equal(kind(doc().replace('<!DOCTYPE html>', '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN">')), 'old');
  assert.equal(kind('<!-- La meva pàgina -->\n' + doc()), undefined);
  assert.equal(kind(doc().replace('<!DOCTYPE html>', '<!doctype html>')), undefined);
});

test('html/charset i html/title: valors incorrectes', () => {
  assert.equal(first(documentCase(doc().replace('UTF-8', 'latin1')), 'html/charset').data.kind, 'value');
  const oldCharset = doc().replace('<meta charset="UTF-8">', '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">');
  assert.ok(!rulesOf(documentCase(oldCharset)).includes('html/charset'));
  assert.equal(first(documentCase(doc().replace('Prova', ' ')), 'html/title').data.kind, 'empty');
});

test('html/indentation: tancaments, tabuladors, <pre> i errors d\'estructura', () => {
  const indent = (src) => lintCase(src).filter((p) => p.rule === 'html/indentation').map((p) => [p.line, p.data]);
  // La línia de tancament s'alinea amb la d'obertura
  assert.deepEqual(indent('<ul>\n  <li>x</li>\n  </ul>\n'),
    [[3, { expected: 0, actual: 2, close: 'ul', openLine: 1 }]]);
  assert.deepEqual(indent('<div>\n\t<p>x</p>\n</div>\n'), [[2, { tab: true }]]);
  // Dins de <pre> els espais són part del contingut
  assert.deepEqual(indent('<pre>\n<b>x</b>\n    <i>y</i>\n</pre>\n'), []);
  // Els fills es comparen amb el pare tal com és: un error no se n'emporta d'altres
  assert.deepEqual(indent('<div>\n    <ul>\n      <li>x</li>\n    </ul>\n</div>\n').map(([line]) => line), [2]);
  // El text llarg pot continuar on vulgui; les etiquetes en línia no es revisen
  assert.deepEqual(indent('<p>Un text llarg\nque continua <b>aquí</b>\n</p>\n'), []);
  // Amb errors d'estructura, primer cal arreglar-los
  assert.deepEqual(indent('<div>\n<p>x\n'), []);
  // Document sencer: <head> i <body> dins d'<html>
  assert.deepEqual(indent(doc()), []);
});

test('css/indentation: @media, selectors en diverses línies i tancaments', () => {
  const indent = (src) => lintCase(css(src)).filter((p) => p.rule === 'css/indentation').map((p) => p.line);
  assert.deepEqual(indent('@media (min-width: 40em) {\n  h1,\n  h2 {\n    color: red;\n  }\n}\n'), []);
  // Només la línia 2: les de dins de la regla es comparen amb la línia 2 tal com és
  assert.deepEqual(indent('@media (min-width: 40em) {\nh1 {\n  color: red;\n}\n}\n'), [2]);
  assert.deepEqual(indent('h1 {\n  color: red;\n  }\n'), [3]);
  assert.deepEqual(indent('h1 { color: red; }\n'), []);
  // Amb claus desaparellades, primer cal arreglar-les
  assert.deepEqual(indent('h1 {\ncolor: red;\n'), []);
});

test('html/list-structure: text i elements dins de la llista', () => {
  const kinds = lintCase('<ul>\n  text\n  <p>x</p>\n  <li>ok</li>\n</ul>\n')
    .filter((p) => p.rule === 'html/list-structure').map((p) => p.data.kind);
  assert.deepEqual(kinds, ['text', 'not-li']);
  // El text solt s'assenyala a la seva línia, no a la del <ul>
  const text = lintCase('<ul>\n  Coses que he de comprar:\n  <li>Pomes</li>\n</ul>\n').find((p) => p.data.kind === 'text');
  assert.deepEqual([text.line, text.col], [2, 3]);
  assert.ok(!rulesOf('<ol>\n  <li>a\n    <ul>\n      <li>b</li>\n    </ul>\n  </li>\n</ol>\n').includes('html/list-structure'));
});

test('html/heading-order: tornar a un nivell més alt sí que es pot', () => {
  assert.deepEqual(lintCase('<h2>a</h2>\n<h3>b</h3>\n<h2>c</h2>\n<h4>d</h4>\n')
    .filter((p) => p.rule === 'html/heading-order').map((p) => p.data), [{ from: 2, to: 4 }]);
});
