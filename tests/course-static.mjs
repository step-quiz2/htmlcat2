#!/usr/bin/env node
// ════════════════════════════════════════════════════════
// tests/course-static.mjs — Comprovacions estàtiques del web
//
// Ús (des de l'arrel del projecte, només cal Node 22):
//     node tests/course-static.mjs
//
// Sense dependències. Revisa els fitxers de site/ (i l'index.html de
// l'arrel, el simulador) i surt amb codi 1 si troba algun problema:
//   1. cada pàgina HTML té <!DOCTYPE html>, <html lang="ca">,
//      <meta charset="UTF-8"> i <title>;
//   2. cap pàgina té atributs style="" ni gestors d'esdeveniments (on…="");
//   3. cap fitxer de site/ té tabulacions;
//   4. cada enllaç relatiu (href, src, url() del CSS) apunta a un fitxer
//      que existeix;
//   5. cada fitxer .js de site/ té una sintaxi vàlida (node --check);
//   6. cap fitxer publicat ni de llicència esmenta CC BY-NC-ND
//      (la llicència és CC BY-NC-SA 4.0 + MIT);
//   7. existeixen els fitxers ocults del projecte (.editorconfig,
//      .gitignore, .github/workflows/ci.yml): una pujada pel web de
//      GitHub no els inclou i es perden sense que ningú se n'adoni.
//
// I les del curs (docs/BLUEPRINT.md §8.2):
//   8. les dades del curs (site/js/course/data.js) i els fitxers de
//      site/curs/ coincideixen, i cada pàgina té el seu
//      <body data-pagina data-num>;
//   9. cada simulador editable té data-id; data-id i data-goal-id no es
//      repeteixen a tot el web; l'exercici principal de cada capítol
//      (goalId) és a la seva pàgina;
//  10. els blocs de codi (data-file) tenen un nom permès i no contenen
//      «<script»; les comprovacions (data-checks) són JSON ben escrit
//      (checks/schema.js);
//  11. cada exercici (data-goal-id) té la seva solució a
//      tests/solutions/<goal-id>/, amb fitxers que el simulador té;
//  12. la llista d'imatges lliures (site/js/preview/recursos.js) i les
//      imatges de site/recursos/ coincideixen, i cada imatge té la seva
//      fila a site/recursos/CREDITS.md.
// ════════════════════════════════════════════════════════

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildSourceTree } from '../site/js/lang/html-model.js';
import { CAPITOLS, REPTES, findPage } from '../site/js/course/data.js';
import { validateChecks } from '../site/js/checks/schema.js';
import { RULES } from '../site/js/lint/lint.js';
import { RECURSOS } from '../site/js/preview/recursos.js';

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
  // Els blocs <script type="text/plain"> (codi de l'alumne) i
  // <script type="application/json"> (comprovacions) es revisen a part:
  // les seves etiquetes no són de la pàgina
  const withoutComments = html
    .replace(/<script type="(?:text\/plain|application\/json)"[^>]*>[\s\S]*?<\/script>/g, '')
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

// ── Curs: dades, pàgines, simuladors i solucions ──

const FILE_NAMES = new Set(['index.html', 'estils.css']);
const CURS = join(SITE, 'curs');
const SOLUTIONS = join(ROOT, 'tests', 'solutions');

const attrsOf = (el) => Object.fromEntries(el.startTag.attrs.map((a) => [a.name, a.value ?? '']));
const textOf = (html, el) => el.children.filter((n) => n.type === 'text').map((n) => html.slice(n.token.start, n.token.end)).join('');

/** Els <div class="simulador"> d'una pàgina, amb els seus blocs <script>. */
function simulatorsOf(html) {
  const found = [];
  (function walk(node) {
    for (const child of node.children || []) {
      if (child.type !== 'element') continue;
      const attrs = attrsOf(child);
      if (child.name === 'div' && (attrs.class || '').split(/\s+/).includes('simulador')) {
        const blocks = child.children.filter((n) => n.type === 'element' && n.name === 'script')
          .map((script) => ({ attrs: attrsOf(script), text: textOf(html, script) }));
        found.push({ attrs, blocks, line: child.startTag.line });
      }
      walk(child);
    }
  })(buildSourceTree(html).root);
  return found;
}

const coursePages = existsSync(CURS) ? readdirSync(CURS).filter((name) => name.endsWith('.html')).sort() : [];
const expectedPages = [...CAPITOLS, ...REPTES].map((page) => page.arxiu).sort();
for (const name of expectedPages.filter((n) => !coursePages.includes(n))) report(join(CURS, name), 'és a course/data.js però el fitxer no existeix');
for (const name of coursePages.filter((n) => !expectedPages.includes(n))) report(join(CURS, name), 'no és a course/data.js (afegeix-lo a CAPITOLS o REPTES)');

const seenIds = new Map();
const seenGoals = new Map();
for (const file of siteFiles.filter((f) => extname(f) === '.html')) {
  const html = readFileSync(file, 'utf8');
  const where = (sim) => `${relative(ROOT, file)}:${sim.line}`;

  if (dirname(file) === CURS) {
    const match = /^(capitol|repte)-(\d+)\.html$/.exec(relative(CURS, file));
    const body = /<body\s+data-pagina="([^"]+)"\s+data-num="(\d+)">/.exec(html);
    if (!match || !body || body[1] !== match[1] || body[2] !== match[2]) {
      report(file, `ha de tenir <body data-pagina="…" data-num="…"> d'acord amb el nom del fitxer`);
    } else {
      const page = findPage(match[1], Number(match[2]));
      if (page && !html.includes(`data-goal-id="${page.goalId}"`)) report(file, `falta l'exercici principal (data-goal-id="${page.goalId}")`);
    }
  }

  for (const sim of simulatorsOf(html)) {
    const { attrs } = sim;
    const files = sim.blocks.filter((b) => b.attrs.type === 'text/plain' && 'data-file' in b.attrs);
    const editable = !('data-readonly' in attrs) && files.some((b) => !('data-readonly' in b.attrs));
    if (editable && !attrs['data-id']) problems.push(`${where(sim)}: un simulador editable necessita data-id`);
    if (!files.length) problems.push(`${where(sim)}: el simulador no té cap bloc data-file`);
    for (const block of files) {
      if (!FILE_NAMES.has(block.attrs['data-file'])) problems.push(`${where(sim)}: fitxer no permès «${block.attrs['data-file']}»`);
      if (/<script/i.test(block.text)) problems.push(`${where(sim)}: un bloc de codi no pot contenir «<script»`);
    }
    for (const [key, seen] of [['data-id', seenIds], ['data-goal-id', seenGoals]]) {
      if (!attrs[key]) continue;
      if (seen.has(attrs[key])) problems.push(`${where(sim)}: ${key}="${attrs[key]}" ja és a ${seen.get(attrs[key])}`);
      seen.set(attrs[key], where(sim));
    }

    const checksBlock = sim.blocks.find((b) => b.attrs.type === 'application/json' && 'data-checks' in b.attrs);
    const goal = attrs['data-goal-id'];
    if (Boolean(goal) !== Boolean(checksBlock)) problems.push(`${where(sim)}: data-goal-id i <script data-checks> van junts`);
    if (checksBlock) {
      let checks;
      try {
        checks = JSON.parse(checksBlock.text);
      } catch (error) {
        problems.push(`${where(sim)}: les comprovacions no són JSON vàlid (${error.message})`);
      }
      if (checks) for (const error of validateChecks(checks, { ruleIds: RULES.map((r) => r.id) })) problems.push(`${where(sim)}: ${error}`);
    }
    if (goal) {
      const dir = join(SOLUTIONS, goal);
      const names = new Set(files.map((b) => b.attrs['data-file']));
      const solution = existsSync(dir) ? readdirSync(dir) : [];
      if (!solution.length) problems.push(`${where(sim)}: falta la solució a tests/solutions/${goal}/`);
      for (const name of solution.filter((n) => !names.has(n))) problems.push(`${where(sim)}: la solució té ${name}, que el simulador no té`);
    }
  }
}

// ── Imatges lliures: llista ↔ fitxers ↔ crèdits ──
const RECURSOS_DIR = join(SITE, 'recursos');
const IMAGE_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);
const images = listFiles(RECURSOS_DIR).filter((f) => IMAGE_EXTENSIONS.has(extname(f).toLowerCase()))
  .map((f) => relative(RECURSOS_DIR, f).split('\\').join('/')).sort();
const listed = [...RECURSOS].sort();
const credits = readFileSync(join(RECURSOS_DIR, 'CREDITS.md'), 'utf8');
for (const name of images.filter((n) => !listed.includes(n))) report(join(RECURSOS_DIR, name), 'no és a site/js/preview/recursos.js (afegeix-la a RECURSOS)');
for (const name of listed.filter((n) => !images.includes(n))) report(join(RECURSOS_DIR, name), 'és a site/js/preview/recursos.js però el fitxer no existeix');
for (const name of images.filter((n) => !credits.includes('`' + n + '`'))) report(join(RECURSOS_DIR, name), 'falta la seva fila a site/recursos/CREDITS.md');

// ── index.html de l'arrel (el simulador, com a PyCat: docs/STATE.md §3) ──
const rootIndex = join(ROOT, 'index.html');
if (existsSync(rootIndex)) {
  const text = readFileSync(rootIndex, 'utf8');
  if (text.includes('\t')) report(rootIndex, 'conté tabulacions (fes servir 2 espais)');
  checkHtml(rootIndex, text);
}

// ── Llicència coherent fora de site/ ──
for (const name of ['README.md', 'LICENSE', 'LLICENCIA.md']) {
  const file = join(ROOT, name);
  if (/nc-nd/i.test(readFileSync(file, 'utf8'))) report(file, 'esmenta CC BY-NC-ND');
}

// ── Fitxers ocults del projecte ──
for (const name of ['.editorconfig', '.gitignore', '.github/workflows/ci.yml']) {
  const file = join(ROOT, name);
  if (!existsSync(file)) report(file, 'no existeix (puja\'l amb Git: el web de GitHub no puja els fitxers que comencen per punt)');
}

if (problems.length) {
  console.error(`❌ ${problems.length} problema(es):\n` + problems.map((p) => '  · ' + p).join('\n'));
  process.exit(1);
}
console.log(`✅ Tot correcte (${siteFiles.length} fitxers revisats a site/)`);
