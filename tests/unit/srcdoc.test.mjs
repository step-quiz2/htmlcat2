// Tests de site/js/preview/srcdoc.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSrcdoc, DEFAULT_CSP } from '../../site/js/preview/srcdoc.js';

const BASE = 'http://localhost/recursos/';

test('mode fragment: esquelet, CSP, base i CSS', () => {
  const { html, missingFiles } = buildSrcdoc({
    files: { 'index.html': '<h1>Hola</h1>', 'estils.css': 'h1 { color: teal; }' },
    mode: 'fragment',
    assetBase: BASE,
  });
  assert.deepEqual(missingFiles, []);
  assert.match(html, /^<!DOCTYPE html>\n<html lang="ca">/);
  assert.ok(html.includes(`<meta http-equiv="Content-Security-Policy" content="${DEFAULT_CSP}">`));
  assert.ok(html.includes(`<base href="${BASE}">`));
  assert.ok(html.includes('<style data-file="estils.css">\nh1 { color: teal; }</style>'));
  assert.ok(html.includes('<body>\n<h1>Hola</h1>\n</body>'));
});

test('la CSP bloqueja scripts i peticions externes', () => {
  assert.match(DEFAULT_CSP, /default-src 'none'/);
  assert.doesNotMatch(DEFAULT_CSP, /script-src/);
  assert.doesNotMatch(DEFAULT_CSP, /\*|https?:/);
});

test('mode document: la CSP i el base van just després del doctype', () => {
  const src = '<!DOCTYPE html>\n<html lang="ca">\n  <head>\n    <title>X</title>\n  </head>\n  <body></body>\n</html>';
  const { html } = buildSrcdoc({ files: { 'index.html': src }, mode: 'document', assetBase: BASE });
  assert.equal(html, `<!DOCTYPE html><meta http-equiv="Content-Security-Policy" content="${DEFAULT_CSP}">` +
    `<base href="${BASE}">` + src.slice('<!DOCTYPE html>'.length));
});

test('mode document: amb contingut abans de <html> o <head>, la CSP continua anant al principi', () => {
  // El navegador ignora una CSP que no és dins del <head>
  const src = '<!DOCTYPE html>\n<h1>Hola</h1>\n<html lang="ca">\n<head>\n<title>X</title>\n</head>\n</html>';
  const { html } = buildSrcdoc({ files: { 'index.html': src }, mode: 'document', assetBase: BASE });
  assert.ok(html.startsWith('<!DOCTYPE html><meta http-equiv="Content-Security-Policy"'));
  assert.ok(html.indexOf('<base') < html.indexOf('<h1>'));
});

test('mode document sense doctype, o amb un doctype que el navegador no té en compte', () => {
  for (const src of ['<html><p>x</p></html>', '<p>x</p>', '<p>x</p>\n<!DOCTYPE html>', 'Hola <!DOCTYPE html><head></head>']) {
    const { html } = buildSrcdoc({ files: { 'index.html': src }, mode: 'document', assetBase: BASE });
    assert.ok(html.startsWith('<meta http-equiv="Content-Security-Policy"'), src);
    assert.ok(html.endsWith(src), src);
  }
});

test('mode document: espais i comentaris abans del doctype', () => {
  const src = '\n<!-- La meva pàgina -->\n<!DOCTYPE html>\n<html lang="ca"></html>';
  const { html } = buildSrcdoc({ files: { 'index.html': src }, mode: 'document', assetBase: BASE });
  assert.ok(html.startsWith('\n<!-- La meva pàgina -->\n<!DOCTYPE html><meta http-equiv'));
});

test('el <link> a un fitxer virtual es substitueix pel seu CSS', () => {
  const src = '<head><link rel="stylesheet" href="estils.css"></head><body></body>';
  const { html, missingFiles } = buildSrcdoc({
    files: { 'index.html': src, 'estils.css': 'p { color: red; }' }, mode: 'document', assetBase: BASE,
  });
  assert.deepEqual(missingFiles, []);
  assert.ok(!html.includes('<link'));
  assert.ok(html.includes('<style data-file="estils.css">\np { color: red; }</style>'));
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<style'));
});

test('<link> just després de <head>, amb ./, majúscules i altres atributs', () => {
  const src = '<HEAD><LINK HREF="./estils.css" REL="Stylesheet" type="text/css"></HEAD>';
  const { html } = buildSrcdoc({ files: { 'index.html': src, 'estils.css': 'a{}' }, mode: 'document', assetBase: BASE });
  assert.match(html, /^<meta http-equiv="Content-Security-Policy"[^>]*><base [^>]*><HEAD><style data-file="estils.css">\na\{\}<\/style><\/HEAD>$/);
});

test('<link> just després del doctype: primer la CSP, després el CSS', () => {
  const src = '<!DOCTYPE html><link rel="stylesheet" href="estils.css">';
  const { html } = buildSrcdoc({ files: { 'index.html': src, 'estils.css': 'a{}' }, mode: 'document', assetBase: BASE });
  assert.match(html, /^<!DOCTYPE html><meta http-equiv="Content-Security-Policy"[^>]*><base [^>]*><style data-file="estils.css">\na\{\}<\/style>$/);
});

test('un <link> a un fitxer que no existeix es comunica', () => {
  const src = '<head><link rel="stylesheet" href="estil.css"></head>';
  const { missingFiles } = buildSrcdoc({ files: { 'index.html': src, 'estils.css': '' }, mode: 'document', assetBase: BASE });
  assert.deepEqual(missingFiles, ['estil.css']);
});

test('els <link> externs o d\'un altre tipus no es toquen', () => {
  const src = '<head><link rel="icon" href="estils.css"><link rel="stylesheet" href="https://x.cat/a.css"></head>';
  const { html, missingFiles } = buildSrcdoc({ files: { 'index.html': src, 'estils.css': 'a{}' }, mode: 'document', assetBase: BASE });
  assert.deepEqual(missingFiles, []);
  assert.ok(html.includes('<link rel="icon" href="estils.css">'));
  assert.ok(html.includes('<link rel="stylesheet" href="https://x.cat/a.css">'));
});

test('un CSS amb «</style» no pot tancar el seu <style>', () => {
  const { html } = buildSrcdoc({
    files: { 'index.html': '', 'estils.css': 'a::after { content: "</style><script>x</script>"; }' },
    mode: 'fragment', assetBase: BASE,
  });
  assert.equal(html.match(/<\/style/gi).length, 1);
});
