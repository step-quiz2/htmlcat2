#!/usr/bin/env node
// ════════════════════════════════════════════════════════
// tests/course-static.mjs — Comprovacions estàtiques del web
//
// Ús (des de l'arrel del projecte, només cal Node 22):
//     node tests/course-static.mjs
//
// Sense dependències. Revisa els fitxers de site/ i surt amb codi 1
// si troba algun problema:
//   1. cada pàgina HTML té <!DOCTYPE html>, <html lang="ca">,
//      <meta charset="UTF-8"> i <title>;
//   2. cap pàgina té atributs style="" ni gestors d'esdeveniments (on…="");
//   3. cap fitxer de site/ té tabulacions;
//   4. cada enllaç relatiu (href, src, url() del CSS) apunta a un fitxer
//      que existeix;
//   5. cada fitxer .js de site/ té una sintaxi vàlida (node --check);
//   6. cap fitxer publicat ni de llicència esmenta CC BY-NC-ND
//      (la llicència és CC BY-NC-SA 4.0 + MIT).
//
// Quan hi hagi capítols (fase 4) s'hi afegiran les comprovacions del curs:
// dades ↔ fitxers, data-id i data-goal-id únics, blocs de codi, etc.
// (docs/BLUEPRINT.md §8.2).
// ════════════════════════════════════════════════════════

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.svg', '.txt', '.md']);

const problems = [];
const report = (file, message) => problems.push(`${relative(ROOT, file)}: ${message}`);

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

// Etiquetes d'obertura amb els seus atributs (només per als fitxers del
// projecte, que controlem; no és un analitzador d'HTML general).
function startTags(html) {
  // Els blocs <script type="text/plain"> són codi de l'alumne (es revisaran
  // a part, fase 4): les seves etiquetes no són de la pàgina
  const withoutComments = html
    .replace(/<script type="text\/plain"[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const tags = [];
  for (const match of withoutComments.matchAll(/<([a-zA-Z][\w-]*)(\s[^<>]*?)?\/?>/g)) {
    const attrs = {};
    for (const attr of (match[2] || '').matchAll(/([^\s=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g)) {
      attrs[attr[1].toLowerCase()] = (attr[2] || '').replace(/^["']|["']$/g, '');
    }
    tags.push({ name: match[1].toLowerCase(), attrs });
  }
  return tags;
}

function checkUrl(file, url) {
  if (!url || /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(url)) return;   // externs, àncores, data:
  const path = url.split(/[?#]/)[0];
  if (!path) return;
  const target = path.startsWith('/') ? join(SITE, path) : join(dirname(file), path);
  const exists = existsSync(target) &&
    (statSync(target).isFile() || existsSync(join(target, 'index.html')));
  if (!exists) report(file, `l'enllaç «${url}» no apunta a cap fitxer`);
}

function checkHtml(file, html) {
  if (!/^<!DOCTYPE html>/i.test(html)) report(file, 'falta <!DOCTYPE html> al principi');
  const tags = startTags(html);
  const htmlTag = tags.find((t) => t.name === 'html');
  if (!htmlTag || htmlTag.attrs.lang !== 'ca') report(file, 'falta <html lang="ca">');
  if (!tags.some((t) => t.name === 'meta' && (t.attrs.charset || '').toLowerCase() === 'utf-8')) {
    report(file, 'falta <meta charset="UTF-8">');
  }
  if (!/<title>[^<]+<\/title>/.test(html)) report(file, 'falta un <title> amb text');

  for (const tag of tags) {
    if ('style' in tag.attrs) report(file, `<${tag.name}> té un atribut style="" (fes servir classes)`);
    for (const name of Object.keys(tag.attrs)) {
      if (name.startsWith('on')) report(file, `<${tag.name}> té un gestor ${name}="" (afegeix-lo des del JS)`);
    }
    checkUrl(file, tag.attrs.href);
    checkUrl(file, tag.attrs.src);
  }
}

function checkCss(file, css) {
  for (const match of css.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)) checkUrl(file, match[2]);
}

function checkJsSyntax(file) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) report(file, 'error de sintaxi:\n' + result.stderr.trim());
}

// ── Fitxers de site/ ──
const siteFiles = listFiles(SITE);
for (const file of siteFiles) {
  const ext = extname(file);
  if (!TEXT_EXTENSIONS.has(ext)) continue;
  const text = readFileSync(file, 'utf8');
  if (text.includes('\t')) report(file, 'conté tabulacions (fes servir 2 espais)');
  if (/nc-nd/i.test(text)) report(file, 'esmenta CC BY-NC-ND (la llicència és CC BY-NC-SA 4.0)');
  if (ext === '.html') checkHtml(file, text);
  if (ext === '.css') checkCss(file, text);
  if (ext === '.js') checkJsSyntax(file);
}

// ── Llicència coherent fora de site/ ──
for (const name of ['README.md', 'LICENSE', 'LLICENCIA.md']) {
  const file = join(ROOT, name);
  if (/nc-nd/i.test(readFileSync(file, 'utf8'))) report(file, 'esmenta CC BY-NC-ND');
}

if (problems.length) {
  console.error(`❌ ${problems.length} problema(es):\n` + problems.map((p) => '  · ' + p).join('\n'));
  process.exit(1);
}
console.log(`✅ Tot correcte (${siteFiles.length} fitxers revisats a site/)`);
