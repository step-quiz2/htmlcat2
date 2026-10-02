// ════════════════════════════════════════════════════════
// preview/srcdoc.js — Construeix el document de la previsualització
// (mòdul pur)
//
// A partir dels fitxers virtuals de l'alumne ({ 'index.html': …,
// 'estils.css': … }) construeix el text que es posa a l'atribut srcdoc
// de l'iframe de previsualització:
//   · mode 'fragment': l'alumne només escriu el contingut del <body>;
//     s'embolcalla amb un esquelet i s'hi afegeixen tots els CSS.
//   · mode 'document': l'alumne escriu el document sencer; cada
//     <link rel="stylesheet" href="estils.css"> que apunta a un fitxer
//     virtual es substitueix pel seu contingut dins d'un <style>.
// En tots dos casos s'injecta al principi del <head>:
//   · <meta http-equiv="Content-Security-Policy"> (cap petició externa)
//   · <base href="…/recursos/"> (les imatges de l'alumne es busquen al
//     paquet d'imatges, sigui quina sigui la pàgina on és el simulador)
//
// Les línies que veu l'alumne no canvien: el revisor de codi treballa
// sobre els fitxers originals, no sobre aquest text.
//
// API pública:
//   buildSrcdoc({ files, mode, assetBase, csp? }) → { html, missingFiles }
//   DEFAULT_CSP
// ════════════════════════════════════════════════════════

import { tokenizeHtml } from '../lang/html-tokenizer.js';

export const DEFAULT_CSP = "default-src 'none'; img-src 'self' data: blob:; " +
  "style-src 'self' 'unsafe-inline'; font-src 'self' data:; media-src 'self'";

const escapeAttr = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Un CSS no pot tancar el <style> que el conté
const safeCss = (css) => css.replace(/<\/style/gi, '<\\/style');

const styleTag = (name, css) => `<style data-file="${escapeAttr(name)}">\n${safeCss(css)}</style>`;

/**
 * @param {{ files: Record<string,string>, mode?: 'fragment'|'document',
 *           assetBase: string, csp?: string }} options
 * @returns {{ html: string, missingFiles: string[] }}
 */
export function buildSrcdoc({ files, mode = 'fragment', assetBase, csp = DEFAULT_CSP }) {
  const head = `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(csp)}">` +
    `<base href="${escapeAttr(assetBase)}">`;
  const htmlFile = files['index.html'] ?? '';
  const cssNames = Object.keys(files).filter((name) => name.endsWith('.css'));

  if (mode === 'fragment') {
    const styles = cssNames.map((name) => styleTag(name, files[name])).join('\n');
    const html = '<!DOCTYPE html>\n<html lang="ca">\n<head>\n<meta charset="UTF-8">\n' + head +
      '\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Resultat</title>\n' +
      styles + '\n</head>\n<body>\n' + htmlFile + '\n</body>\n</html>\n';
    return { html, missingFiles: [] };
  }

  const missingFiles = [];
  const edits = [];
  const tokens = tokenizeHtml(htmlFile);

  for (const token of tokens) {
    if (token.type !== 'startTag' || token.name !== 'link') continue;
    const attr = (name) => token.attrs.find((a) => a.name === name)?.value ?? '';
    if (!attr('rel').toLowerCase().split(/\s+/).includes('stylesheet')) continue;
    const href = attr('href').trim();
    if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(href)) continue;   // externs: els bloqueja la CSP
    const name = href.replace(/^\.\//, '');
    if (name in files) edits.push({ from: token.start, to: token.end, insert: styleTag(name, files[name]) });
    else missingFiles.push(href);
  }

  edits.push({ ...headInsertionPoint(tokens), insert: head });
  // De darrere cap endavant (amb el mateix inici, primer la substitució més llarga)
  edits.sort((a, b) => b.from - a.from || b.to - a.to);
  let html = htmlFile;
  for (const edit of edits) html = html.slice(0, edit.from) + edit.insert + html.slice(edit.to);
  return { html, missingFiles };
}

// Just després de <head>; si no n'hi ha, després de <html>; si tampoc,
// després del doctype; si tampoc, al principi.
function headInsertionPoint(tokens) {
  for (const name of ['head', 'html']) {
    const tag = tokens.find((t) => t.type === 'startTag' && t.name === name);
    if (tag) return { from: tag.end, to: tag.end };
  }
  const doctype = tokens.find((t) => t.type === 'doctype');
  const at = doctype ? doctype.end : 0;
  return { from: at, to: at };
}
