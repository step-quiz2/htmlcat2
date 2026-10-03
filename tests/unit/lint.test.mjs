// Tests de site/js/lint/lint.js i messages.ca.js (el motor del revisor)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RULES, SEVERITIES, activeRules, summarize } from '../../site/js/lint/lint.js';
import { MESSAGES } from '../../site/js/lint/messages.ca.js';
import { dedent } from '../../site/js/util/text.js';
import { lintCase, rulesOf, css } from './lint-helpers.mjs';

test('catàleg: ids únics, amb missatge i ben descrits', () => {
  const ids = RULES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(Object.keys(MESSAGES).sort(), [...ids].sort());
  for (const rule of RULES) {
    assert.ok(rule.id.startsWith(rule.lang + '/'), rule.id);
    assert.ok(Number.isInteger(rule.since) && rule.since >= 1 && rule.since <= 15, rule.id);
    assert.ok(SEVERITIES.includes(rule.severity), rule.id);
    assert.ok(rule.mode === undefined || rule.mode === 'document', rule.id);
    assert.equal(typeof rule.check, 'function', rule.id);
  }
});

test('les regles s\'activen per capítol i per mode', () => {
  const ids = (options) => activeRules(options).map((r) => r.id);
  assert.equal(ids().length, RULES.filter((r) => !r.mode).length);
  assert.equal(ids({ mode: 'document' }).length, RULES.length);
  const chapter1 = ids({ chapter: 1 });
  assert.ok(chapter1.includes('html/unclosed-element'));
  assert.ok(chapter1.includes('html/indentation'));
  assert.ok(!chapter1.includes('html/list-structure'));    // capítol 3
  assert.ok(!chapter1.some((id) => id.startsWith('css/'))); // capítol 9
  assert.ok(!chapter1.includes('html/doctype'));            // només en mode document
  assert.ok(ids({ chapter: 1, mode: 'document' }).includes('html/doctype'));
});

test('al capítol 1 no es critica el que encara no s\'ha ensenyat', () => {
  const files = { 'index.html': '<li>x</li>\n<p style="color: red">y</p>\n<h1>a</h1>\n<h1>b</h1>\n', 'estils.css': 'h1 { colr: red }' };
  assert.deepEqual(rulesOf({ files, chapter: 1 }), []);
  assert.ok(rulesOf({ files, chapter: 9 }).includes('css/unknown-property'));
});

test('ordre: errors, avisos; després per fitxer i per posició', () => {
  const problems = lintCase({ files: {
    'index.html': '<P>x</P>\n<p>sense tancar\n',
    'estils.css': 'h1 {\n  colr: red;\n}\n',
  } });
  assert.deepEqual(problems.map((p) => [p.severity, p.file, p.line]), [
    ['error', 'index.html', 2],
    ['error', 'estils.css', 2],
    ['warning', 'index.html', 1],
    ['warning', 'index.html', 1],
  ]);
});

test('CSS de dins d\'un <style>: posicions del fitxer HTML, sense indentació', () => {
  const src = '<style>\n  h1 { colr: red; }\n</style>\n';
  const problems = lintCase(src);
  assert.deepEqual(problems.map((p) => [p.rule, p.file, p.line, p.col]), [['css/unknown-property', 'index.html', 2, 8]]);
  assert.equal(src.slice(problems[0].start, problems[0].end), 'colr');
});

test('summarize: com a molt 10 entrades, avisos repetits agrupats', () => {
  const problem = (severity, rule, start) => ({ severity, rule, file: 'index.html', start });
  const problems = [
    problem('error', 'html/unclosed-element', 1),
    problem('error', 'html/unclosed-element', 5),
    problem('warning', 'html/indentation', 2),
    problem('warning', 'html/indentation', 3),
    problem('warning', 'html/indentation', 4),
    problem('warning', 'html/uppercase', 6),
  ];
  const { entries, counts, hidden } = summarize(problems);
  assert.deepEqual(counts, { error: 2, warning: 4, info: 0 });
  assert.deepEqual(entries.map((e) => [e.problem.rule, e.problem.start, e.more]), [
    ['html/unclosed-element', 1, 0],
    ['html/unclosed-element', 5, 0],
    ['html/indentation', 2, 2],
    ['html/uppercase', 6, 0],
  ]);
  assert.equal(hidden, 0);
  const many = Array.from({ length: 13 }, (_, i) => problem('error', 'html/stray-end-tag', i));
  assert.equal(summarize(many).entries.length, 10);
  assert.equal(summarize(many).hidden, 3);
});

// ── El codi d'exemple del web és net (és el model que copiaran els alumnes) ──

const site = (path) => readFileSync(new URL('../../site/' + path, import.meta.url), 'utf8');

test('el codi inicial de l\'editor lliure (site/editor i el simulador de l\'arrel) no té cap problema', () => {
  for (const page of [site('editor/index.html'), readFileSync(new URL('../../index.html', import.meta.url), 'utf8')]) {
    const files = {};
    for (const [, name, code] of page.matchAll(/<script type="text\/plain" data-file="([^"]+)">([\s\S]*?)<\/script>/g)) {
      files[name] = dedent(code);
    }
    assert.deepEqual(Object.keys(files), ['index.html', 'estils.css']);
    assert.deepEqual(lintCase({ files, mode: 'document' }).map((p) => `${p.file}:${p.line} ${p.rule}`), []);
  }
});

test('els exemples de la portada no tenen cap problema', () => {
  const unescape = (text) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const examples = [...site('index.html').matchAll(/<pre class="code-example" data-lang="(\w+)"[^>]*>([\s\S]*?)<\/pre>/g)];
  assert.equal(examples.length, 2);
  for (const [, lang, code] of examples) {
    const input = lang === 'css' ? css(unescape(code) + '\n') : { files: { 'index.html': unescape(code) + '\n' }, mode: 'document' };
    assert.deepEqual(rulesOf(input), [], lang);
  }
});

test('rendiment: revisar 300 línies d\'HTML en menys de 50 ms (objectiu: 5 ms)', () => {
  const block = '<section class="seccio">\n  <h2>Títol</h2>\n  <p>Un text amb <strong>negreta</strong> i un <a href="#x">enllaç</a>.</p>\n' +
    '  <ul>\n    <li>Pomes</li>\n    <li>Peres</li>\n  </ul>\n</section>\n';
  const files = { 'index.html': '<h1>Pàgina</h1>\n' + block.repeat(38), 'estils.css': '.seccio {\n  color: teal;\n}\n\n'.repeat(75) };
  lintCase({ files });
  const runs = 20;
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) lintCase({ files });
  const ms = (performance.now() - t0) / runs;
  assert.ok(ms < 50, `${ms.toFixed(2)} ms per passada`);
});
