// Tests de site/js/lang/css-parser.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCss } from '../../site/js/lang/css-parser.js';

const codes = (src) => parseCss(src).problems.map((p) => p.code);
const decls = (rule) => rule.declarations.map((d) => [d.property.text, d.value && d.value.text]);

test('regla ben escrita', () => {
  const src = 'h1 {\n  color: teal;\n  font-size: 2rem;\n}\n';
  const { rules, problems } = parseCss(src);
  assert.deepEqual(problems, []);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].selector.text, 'h1');
  assert.deepEqual(decls(rules[0]), [['color', 'teal'], ['font-size', '2rem']]);
  assert.ok(rules[0].declarations.every((d) => d.semicolon));
  assert.equal(src[rules[0].close], '}');
});

test('selectors agrupats', () => {
  const [rule] = parseCss('h1,\nh2 > a, :is(p, li) { color: red; }').rules;
  assert.deepEqual(rule.selectors.map((s) => s.text), ['h1', 'h2 > a', ':is(p, li)']);
});

test('posicions de propietat i valor', () => {
  const src = 'p { margin: 0 auto; }';
  const [{ declarations: [d] }] = parseCss(src).rules;
  assert.equal(src.slice(d.property.start, d.property.end), 'margin');
  assert.equal(src.slice(d.value.start, d.value.end), '0 auto');
});

test('!important', () => {
  const [{ declarations: [d] }] = parseCss('p { color: red !important; }').rules;
  assert.ok(d.important);
  assert.equal(d.value.text, 'red');
});

test('última declaració sense punt i coma (vàlid, però es marca)', () => {
  const [{ declarations }] = parseCss('p { color: red; margin: 0 }').rules;
  assert.deepEqual(declarations.map((d) => d.semicolon), [true, false]);
  assert.deepEqual(codes('p { color: red; margin: 0 }'), []);
});

test('falta el punt i coma entre declaracions', () => {
  const src = 'h1 {\n  color: red\n  font-size: 20px;\n}';
  const [p] = parseCss(src).problems;
  assert.equal(p.code, 'missing-semicolon');
  assert.equal(p.data.next, 'font-size');
  assert.equal(p.line, 2);
});

test('els dos punts d\'un url() no són un punt i coma oblidat', () => {
  assert.deepEqual(codes('a { background: url(http://x.cat/a.png) no-repeat; }'), []);
});

test('falta la «}» i comença una altra regla', () => {
  const src = 'h1 {\n  color: red;\n\np {\n  margin: 0;\n}';
  const { rules, problems } = parseCss(src);
  assert.deepEqual(problems.map((p) => [p.code, p.line]), [['unclosed-block', 1]]);
  assert.deepEqual(rules.map((r) => r.selector.text), ['h1', 'p']);
  assert.deepEqual(decls(rules[1]), [['margin', '0']]);
});

test('falta la «}» al final', () => {
  assert.deepEqual(codes('p { color: red;'), ['unclosed-block']);
});

test('«}» que sobra', () => {
  assert.deepEqual(codes('p { color: red; }\n}'), ['unexpected-close-brace']);
});

test('falta la «{»', () => {
  assert.deepEqual(codes('h1 color: red; }'), ['missing-open-brace']);
});

test('falten els dos punts', () => {
  const [p] = parseCss('p { color red; }').problems;
  assert.equal(p.code, 'missing-colon');
  assert.equal(p.data.text, 'color red');
});

test('valor buit', () => {
  assert.deepEqual(codes('p { color: ; }'), ['empty-value']);
});

test('comentaris, també dins de regles, i comentari sense tancar', () => {
  const { comments, rules, problems } = parseCss('/* a */\np { /* b */ color: /* c */ red; }');
  assert.equal(comments.length, 3);
  assert.deepEqual(decls(rules[0]), [['color', '/* c */ red']]);
  assert.deepEqual(problems, []);
  assert.deepEqual(codes('p { } /* sense tancar'), ['unclosed-comment']);
});

test('cadenes amb caràcters especials i cadena sense tancar', () => {
  const [rule] = parseCss('a::before { content: "}{;:"; }').rules;
  assert.deepEqual(decls(rule), [['content', '"}{;:"']]);
  assert.ok(codes('a::before { content: "sense tancar; }').includes('unclosed-string'));
});

test('@media conté regles; @import és una instrucció; @font-face conté declaracions', () => {
  const { rules, problems } = parseCss(
    '@import url("a.css");\n@media (max-width: 600px) {\n  h1 { color: red; }\n  p { margin: 0; }\n}\n@font-face { font-family: X; src: url(x.woff2); }');
  assert.deepEqual(problems, []);
  assert.deepEqual(rules.map((r) => r.name), ['import', 'media', 'font-face']);
  assert.equal(rules[1].prelude.text, '(max-width: 600px)');
  assert.deepEqual(rules[1].rules.map((r) => r.selector.text), ['h1', 'p']);
  assert.deepEqual(decls(rules[2]), [['font-family', 'X'], ['src', 'url(x.woff2)']]);
});

test('@media sense «}»', () => {
  assert.deepEqual(codes('@media print {\n  p { color: red; }\n'), ['unclosed-block']);
});

test('els segments de ressaltat no s\'encavalquen', () => {
  const src = '/* x */ @media screen { h1, p { color: red !important; } }';
  const { segments } = parseCss(src);
  for (let i = 1; i < segments.length; i++) assert.ok(segments[i].start >= segments[i - 1].end);
});

test('codi buit', () => {
  assert.deepEqual(parseCss(''), { rules: [], comments: [], problems: [], segments: [] });
});
