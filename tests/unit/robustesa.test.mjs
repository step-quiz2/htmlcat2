// Robustesa: amb codi aleatori (el que pot escriure un alumne a mitges),
// cap analitzador no pot fallar i el ressaltat ha de conservar el codi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeHtml } from '../../site/js/lang/html-tokenizer.js';
import { buildSourceTree } from '../../site/js/lang/html-model.js';
import { parseCss } from '../../site/js/lang/css-parser.js';
import { highlight } from '../../site/js/editor/highlight.js';

// Generador pseudoaleatori repetible (mateixos casos a cada execució)
function rng(seed) {
  let h = seed >>> 0;
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
}

const PIECES = ['<', '>', '/', '=', '"', "'", '!', '-', '{', '}', ':', ';', '(', ')', '*', '@',
  ' ', '\n', 'p', 'div', 'li', 'style', 'a', 'href', 'color', 'red', '<!--', '-->', '/*', '*/',
  '&amp;', 'à', '</', '<!DOCTYPE html>', '<style>', '</style>', '<title>', '\r\n', '\t'];

const plain = (html) => html.replace(/<\/?span[^>]*>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('500 codis aleatoris: res no falla i el codi es conserva', () => {
  const random = rng(20261002);
  for (let n = 0; n < 500; n++) {
    let src = '';
    const length = Math.floor(random() * 60);
    for (let i = 0; i < length; i++) src += PIECES[Math.floor(random() * PIECES.length)];

    const tokens = tokenizeHtml(src);
    assert.equal(tokens.map((t) => src.slice(t.start, t.end)).join(''), src, JSON.stringify(src));
    buildSourceTree(src, tokens);
    parseCss(src);
    assert.equal(plain(highlight(src, 'html')), src, JSON.stringify(src));
    assert.equal(plain(highlight(src, 'css')), src, JSON.stringify(src));
  }
});
