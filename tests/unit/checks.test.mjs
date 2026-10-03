// Tests de site/js/checks/schema.js i de les comprovacions de checks.js
// que no necessiten navegador (uses-html, uses-css, lint). Les altres
// (sobre el DOM) les prova course-browser.mjs amb els exercicis de debò.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateChecks, CHECK_TYPES } from '../../site/js/checks/schema.js';
import { runChecks } from '../../site/js/checks/checks.js';
import { RULES } from '../../site/js/lint/lint.js';

const ruleIds = RULES.map((r) => r.id);
const validate = (checks) => validateChecks(checks, { ruleIds });

const VALID = [
  { type: 'exists', selector: 'h1', msg: 'Hi ha d\'haver un <h1>.' },
  { type: 'count', selector: 'body > p', min: 2, max: 5, msg: 'Entre dos i cinc paràgrafs.' },
  { type: 'count', selector: 'h1', eq: 1, msg: 'Un sol <h1>.' },
  { type: 'text', selector: 'title', matches: '^qui s[oó]c$', ci: true, msg: 'El títol diu «Qui soc».' },
  { type: 'text', selector: 'p', includes: 'gat', all: true, msg: 'Tots els paràgrafs parlen del gat.' },
  { type: 'attr', selector: 'html', name: 'lang', equals: 'ca', msg: 'La pàgina és en català.' },
  { type: 'attr', selector: 'img', name: 'alt', nonEmpty: true, all: true, msg: 'Cada imatge té alt.' },
  { type: 'style', selector: 'h1', prop: 'color', equals: 'teal', msg: 'El títol és de color teal.' },
  { type: 'uses-html', tag: 'meta', attr: 'charset', msg: 'Hi ha <meta charset>.' },
  { type: 'uses-css', selector: 'h1', prop: 'color', value: 'teal', msg: 'Una regla h1 posa color: teal.' },
  { type: 'lint', maxErrors: 0, msg: 'El codi no té errors.' },
  { type: 'lint', rules: ['html/indentation'], maxWarnings: 0, msg: 'La indentació és correcta.' },
];

test('esquema: totes les comprovacions vàlides passen (i cobreixen tots els tipus)', () => {
  assert.deepEqual(validate(VALID), []);
  assert.deepEqual([...new Set(VALID.map((c) => c.type))].sort(), [...CHECK_TYPES].sort());
});

test('esquema: errors típics', () => {
  const one = (check) => validate([check]);
  assert.match(validateChecks([]).join(), /llista no buida/);
  assert.match(validateChecks({}).join(), /llista no buida/);
  assert.match(one('h1').join(), /objecte/);
  assert.match(one({ type: 'existeix', selector: 'h1', msg: 'x' }).join(), /tipus desconegut/);
  assert.match(one({ type: 'exists', selector: 'h1' }).join(), /falta «msg»/);
  assert.match(one({ type: 'exists', selecter: 'h1', msg: 'x' }).join(), /camp desconegut «selecter»/);
  assert.match(one({ type: 'exists', msg: 'x' }).join(), /falta «selector»/);
  assert.match(one({ type: 'exists', selector: ' ', msg: 'x' }).join(), /text no buit/);
  assert.match(one({ type: 'count', selector: 'p', msg: 'x' }).join(), /almenys un de eq, min, max/);
  assert.match(one({ type: 'count', selector: 'p', eq: 1, min: 1, msg: 'x' }).join(), /no es pot combinar/);
  assert.match(one({ type: 'count', selector: 'p', min: -1, msg: 'x' }).join(), /enter no negatiu/);
  assert.match(one({ type: 'text', selector: 'p', equals: 'a', includes: 'b', msg: 'x' }).join(), /exactament un/);
  assert.match(one({ type: 'text', selector: 'p', msg: 'x' }).join(), /exactament un/);
  assert.match(one({ type: 'text', selector: 'p', matches: '([', msg: 'x' }).join(), /expressió regular/);
  assert.match(one({ type: 'text', selector: 'p', equals: 'a', ci: 'sí', msg: 'x' }).join(), /true o false/);
  assert.match(one({ type: 'attr', selector: 'img', name: 'alt', present: false, msg: 'x' }).join(), /ha de ser true/);
  assert.match(one({ type: 'uses-html', msg: 'x' }).join(), /almenys un de tag, attr/);
  assert.match(one({ type: 'lint', rules: ['html/no-existeix'], msg: 'x' }).join(), /regla desconeguda/);
  assert.match(one({ type: 'lint', rules: [], msg: 'x' }).join(), /llista no buida/);
});

// ── Comprovacions sobre el codi font (sense navegador) ──

const files = {
  'index.html': '<!DOCTYPE html>\n<html lang="ca">\n  <head>\n    <meta charset="UTF-8">\n    <title>X</title>\n    <link rel="stylesheet" href="estils.css">\n' +
    '    <style>\n      p { margin: 0; }\n    </style>\n  </head>\n  <body>\n    <h1>Hola</h1>\n  </body>\n</html>\n',
  'estils.css': 'h1,\nh2 {\n  color:   teal;\n}\n\n@media (min-width: 40em) {\n  .avis {\n    display: flex;\n  }\n}\n',
};
const passed = (check, extra = {}) => runChecks({ doc: null, files, mode: 'document', checks: [{ msg: 'x', ...check }], ...extra })[0].passed;

test('uses-html: al codi font', () => {
  assert.equal(passed({ type: 'uses-html', tag: 'meta', attr: 'charset' }), true);
  assert.equal(passed({ type: 'uses-html', tag: 'h1' }), true);
  assert.equal(passed({ type: 'uses-html', attr: 'lang' }), true);
  assert.equal(passed({ type: 'uses-html', tag: 'tbody' }), false);
  assert.equal(passed({ type: 'uses-html', tag: 'h1', attr: 'class' }), false);
});

test('uses-css: fitxers CSS, <style> i @media; el selector i el valor es normalitzen', () => {
  assert.equal(passed({ type: 'uses-css', selector: 'h2', prop: 'color', value: 'teal' }), true);
  assert.equal(passed({ type: 'uses-css', selector: 'p', prop: 'margin' }), true);
  assert.equal(passed({ type: 'uses-css', selector: '.avis', prop: 'display', value: 'flex' }), true);
  assert.equal(passed({ type: 'uses-css', matches: '^\\.', prop: 'display' }), true);
  assert.equal(passed({ type: 'uses-css', prop: 'COLOR' }), true);
  assert.equal(passed({ type: 'uses-css', selector: 'h1', prop: 'color', value: 'red' }), false);
  assert.equal(passed({ type: 'uses-css', selector: 'p', prop: 'color' }), false);
});

test('lint: errors i avisos al nivell del capítol', () => {
  assert.equal(passed({ type: 'lint', maxErrors: 0 }), true);
  const broken = { 'index.html': '<p>sense tancar\n<ul>\n<li>x</li>\n</ul>\n' };
  const result = (check, chapter) => runChecks({ doc: null, files: broken, chapter, checks: [{ msg: 'x', ...check }] })[0];
  assert.equal(result({ type: 'lint' }, 1).passed, false);
  assert.match(result({ type: 'lint' }, 1).detail, /errors: 1/);
  assert.equal(result({ type: 'lint', maxErrors: 1 }, 1).passed, true);
  assert.equal(result({ type: 'lint', rules: ['html/indentation'], maxWarnings: 0 }, 1).passed, true);  // amb errors no es revisa
});

test('un tipus desconegut no fa fallar res: la comprovació no se supera', () => {
  const [result] = runChecks({ doc: null, files, checks: [{ type: 'màgia', msg: 'x' }] });
  assert.equal(result.passed, false);
  assert.match(result.detail, /mal escrita/);
});
