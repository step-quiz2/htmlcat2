// Tests de site/js/editor/highlight.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlight, highlightLines, escapeHtml } from '../../site/js/editor/highlight.js';
import { tokenizeHtml } from '../../site/js/lang/html-tokenizer.js';
import { buildSourceTree } from '../../site/js/lang/html-model.js';
import { parseCss } from '../../site/js/lang/css-parser.js';

// Treu les etiquetes <span> i desfà l'escapament: ha de tornar el codi original
const plain = (html) => html.replace(/<\/?span[^>]*>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const HTML_SAMPLE = `<!DOCTYPE html>
<html lang="ca">
<head>
  <title>Prova &amp; error</title>
  <style>
    h1, .titol { color: teal !important; } /* c */
  </style>
</head>
<body>
  <!-- comentari
       de dues línies -->
  <p class="intro" hidden>Hola &copy; <b>món</b> 3 < 4</p>
  <img src=gat.png alt='un "gat"'/>
</body>
</html>`;

test('el ressaltat conserva exactament el codi (HTML)', () => {
  assert.equal(plain(highlight(HTML_SAMPLE, 'html')), HTML_SAMPLE);
});

test('el ressaltat conserva exactament el codi (CSS)', () => {
  const css = '/* x\n y */\n@media (max-width: 600px) {\n  a::before { content: "<b>"; }\n}\np { color: red\n  margin: 0 }';
  assert.equal(plain(highlight(css, 'css')), css);
});

test('una entrada per línia i cap <span> travessa un salt de línia', () => {
  const lines = highlightLines(HTML_SAMPLE, 'html');
  assert.equal(lines.length, HTML_SAMPLE.split('\n').length);
  for (const line of lines) {
    assert.equal((line.match(/<span/g) || []).length, (line.match(/<\/span>/g) || []).length);
  }
});

test('el codi de l\'alumne mai no es converteix en etiquetes reals', () => {
  const html = highlight('<script>alert(1)</script><img src=x onerror=alert(1)>', 'html');
  assert.ok(!/<script|<img/.test(html));
});

test('classes principals', () => {
  const html = highlight('<p class="a">&amp;</p><!-- c -->', 'html');
  for (const cls of ['hl-tag', 'hl-attr', 'hl-val', 'hl-ent', 'hl-cm']) assert.ok(html.includes(cls), cls);
  const css = highlight('@media print { h1 { color: red !important; } }', 'css');
  for (const cls of ['hl-at', 'hl-sel', 'hl-prop', 'hl-cssval', 'hl-imp', 'hl-punct']) assert.ok(css.includes(cls), cls);
});

test('el CSS de dins de <style> també es ressalta', () => {
  assert.ok(highlight('<style>h1 { color: red; }</style>', 'html').includes('hl-prop'));
});

test('escapeHtml', () => {
  assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href="x"&gt;&amp;&lt;/a&gt;');
});

test('rendiment: 300 línies en menys de 50 ms (objectiu: 5 ms)', () => {
  const html = Array.from({ length: 300 }, (_, i) => `  <li class="element-${i}"><a href="#s${i}">Element ${i}</a></li>`).join('\n');
  const css = Array.from({ length: 300 }, (_, i) => `.c${i} { color: red; margin: ${i}px; }`).join('\n');
  for (let i = 0; i < 5; i++) { highlight(html, 'html'); highlight(css, 'css'); }   // escalfament
  const t0 = performance.now();
  const runs = 20;
  for (let i = 0; i < runs; i++) {
    buildSourceTree(html, tokenizeHtml(html));
    highlight(html, 'html');
    parseCss(css);
    highlight(css, 'css');
  }
  const ms = (performance.now() - t0) / runs;
  assert.ok(ms < 50, `${ms.toFixed(2)} ms per passada`);
});
