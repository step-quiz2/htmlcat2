// Tests de site/js/util/text.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNewlines, dedent, lineColAt } from '../../site/js/util/text.js';

test('normalizeNewlines converteix CRLF i CR', () => {
  assert.equal(normalizeNewlines('a\r\nb\rc\n'), 'a\nb\nc\n');
});

test('dedent treu la indentació comuna i les línies buides dels extrems', () => {
  const block = '\n    <ul>\n      <li>Pomes</li>\n    </ul>\n  ';
  assert.equal(dedent(block), '<ul>\n  <li>Pomes</li>\n</ul>\n');
});

test('dedent conserva les línies buides del mig', () => {
  assert.equal(dedent('  h1 {\n\n    color: teal;\n  }\n'), 'h1 {\n\n  color: teal;\n}\n');
});

test('dedent no toca entitats, accents ni cometes', () => {
  const text = '  <p title=\'a "b"\'>&copy; Català</p>';
  assert.equal(dedent(text), '<p title=\'a "b"\'>&copy; Català</p>\n');
});

test('dedent d\'un bloc buit dona text buit', () => {
  assert.equal(dedent('\n   \n'), '');
});

test('lineColAt calcula línia i columna començant per 1', () => {
  const text = 'ab\ncde\nf';
  assert.deepEqual(lineColAt(text, 0), { line: 1, col: 1 });
  assert.deepEqual(lineColAt(text, 4), { line: 2, col: 2 });
  assert.deepEqual(lineColAt(text, 7), { line: 3, col: 1 });
});

test('makeLineIndex coincideix amb lineColAt a cada posició', async () => {
  const { makeLineIndex } = await import('../../site/js/util/text.js');
  const text = 'ab\n\ncde\nf\n';
  const at = makeLineIndex(text);
  for (let i = 0; i <= text.length; i++) assert.deepEqual(at(i), lineColAt(text, i), `posició ${i}`);
});
