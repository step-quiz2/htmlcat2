#!/usr/bin/env node
// ════════════════════════════════════════════════════════
// tests/course-browser.mjs — Comprovacions amb navegador real
//
// Ús (des de tests/, després de «npm ci»):
//     node course-browser.mjs
//
// Serveix site/ amb un petit servidor HTTP i obre cada pàgina amb
// Chromium (Playwright) a dues amplades (mòbil 360 px i escriptori
// 1280 px). Falla (codi 1) si alguna pàgina:
//   1. escriu errors a la consola del navegador o llança excepcions;
//   2. té peticions que fallen (recurs inexistent, error de xarxa);
//   3. fa una petició a un servidor extern (privacitat dels alumnes);
//   4. no munta tots els simuladors en arribar-hi (es munten en acostar-s'hi);
//   5. té desplaçament horitzontal (no cap a l'amplada de la pantalla);
//   6. té ids repetits;
//   7. té algun simulador on les imatges que el navegador no pot mostrar
//      no coincideixen amb les que el panell ⚠ Problemes diu que no es
//      troben (html/image-not-found es fa sobre el codi font: aquí es
//      compara amb el que fa el navegador de debò).
// Les previsualitzacions dels «errors típics» mostren expressament imatges
// que no es troben (404 a recursos/) o d'Internet (la CSP les bloqueja):
// aquestes peticions no compten als punts 1–3, i el punt 7 les verifica.
//
// Per a cada exercici (data-goal-id) dels capítols, en un mòbil
// (checkExercise, docs/BLUEPRINT.md §8.3): el codi inicial NO el supera; la
// solució de tests/solutions/<goal-id>/ sí, sense cap error al panell
// ⚠ Problemes; queda desat (✓ al menú) i es manté després de recarregar.
//
// A més, prova de punta a punta l'editor lliure (checkFreeEditor):
// escriure, indentació, resultat en directe, seguretat (també amb text
// abans de <html>) i desar. Prova el panell ⚠ Problemes (checkProblemsPanel):
// detecta un error, el clic (o el teclat) porta el cursor a la línia, i el
// CSS es valida amb el CSS.supports del navegador. I munta dos exemples no
// editables a la mateixa pàgina, com als capítols (checkSeveralSimulators):
// cap id repetit.
//
// A la fase 4 s'hi afegiran les comprovacions dels exercicis: la solució
// de referència supera les comprovacions i el codi inicial no
// (docs/BLUEPRINT.md §8.3).
// ════════════════════════════════════════════════════════

import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { findPage } from '../site/js/course/data.js';
import { join, dirname, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const SOLUTIONS = join(dirname(fileURLToPath(import.meta.url)), 'solutions');
const VIEWPORTS = [
  { name: 'mòbil', width: 360, height: 740 },
  { name: 'escriptori', width: 1280, height: 800 },
];
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function listPages(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listPages(path);
    return extname(entry.name) === '.html' ? [path] : [];
  });
}

// Servidor estàtic semblant a Cloudflare Pages: carpeta → index.html,
// fitxer inexistent → 404.html amb codi 404.
function startServer() {
  const server = createServer((req, res) => {
    let path = join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.startsWith(SITE)) { res.writeHead(403).end(); return; }
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
    if (!existsSync(path)) {
      res.writeHead(404, { 'content-type': MIME['.html'] }).end(readFileSync(join(SITE, '404.html')));
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(readFileSync(path));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const server = await startServer();
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const problems = [];
let visits = 0;

for (const file of listPages(SITE)) {
  const url = origin + '/' + relative(SITE, file).split(sep).join('/');
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport });
    const where = `${relative(SITE, file)} (${viewport.name})`;
    const isExternal = (address) => !address.startsWith(origin) && !address.startsWith('data:');
    page.on('console', (msg) => {
      if (msg.type() !== 'error' || isPreviewImageMessage(msg)) return;
      problems.push(`${where}: error a la consola: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`${where}: excepció: ${err.message}`));
    page.on('requestfailed', (req) => {
      if (isPreviewImage(req) && req.failure()?.errorText === 'csp') return;   // bloquejada abans de sortir
      problems.push(`${where}: ha fallat ${req.url()}`);
    });
    page.on('request', (req) => {
      if (isExternal(req.url()) && !isPreviewImage(req)) problems.push(`${where}: petició externa a ${req.url()}`);
    });
    // Una imatge externa de la previsualització que no hagi bloquejat la CSP
    page.on('requestfinished', (req) => {
      if (isExternal(req.url()) && isPreviewImage(req)) problems.push(`${where}: petició externa a ${req.url()}`);
    });
    page.on('response', (res) => {
      if (res.status() === 404 && isPreviewImage(res.request()) && res.url().startsWith(`${origin}/recursos/`)) return;
      if (res.status() >= 400 && res.url() !== url) problems.push(`${where}: ${res.status()} a ${res.url()}`);
    });

    await page.goto(url, { waitUntil: 'networkidle' });
    // Els simuladors es munten quan s'hi acosta la pantalla
    for (const host of await page.locator('.simulador').all()) await host.scrollIntoViewIfNeeded();
    const mounted = await page.waitForFunction(
      () => [...document.querySelectorAll('.simulador')].every((host) => host.classList.contains('sim')),
      null, { timeout: 5000 }).then(() => true, () => false);
    if (!mounted) problems.push(`${where}: no s'han muntat tots els simuladors`);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) problems.push(`${where}: desplaçament horitzontal de ${overflow} px`);
    const repeated = await page.evaluate(duplicateIds);
    if (repeated.length) problems.push(`${where}: ids repetits: ${repeated.join(', ')}`);
    for (const mismatch of await brokenImagesMismatches(page)) problems.push(`${where}: ${mismatch}`);
    await page.close();
    visits++;
  }
}

// ── Imatges de les previsualitzacions ──

/** Petició d'una imatge des d'una previsualització (iframe srcdoc amb el codi de l'alumne). */
function isPreviewImage(req) {
  return req.resourceType() === 'image' && req.frame()?.url() === 'about:srcdoc';
}

// Els missatges que el navegador escriu a la consola per aquestes imatges:
// una imatge de recursos/ que no existeix (404) o una d'Internet (CSP)
function isPreviewImageMessage(msg) {
  const text = msg.text();
  if (text.startsWith('Failed to load resource') && (msg.location().url || '').startsWith(`${origin}/recursos/`)) return true;
  return /^Refused to load the image '[^']*' because it violates the following Content Security Policy directive: "img-src /.test(text);
}

/**
 * A cada simulador, les imatges (amb src) que el navegador no ha pogut
 * mostrar han de ser tantes com les entrades html/image-not-found del
 * panell ⚠ Problemes. I només n'hi pot haver als exemples no editables
 * (els «errors típics») i als exercicis (el codi de «Troba l'error»): un
 * exemple editable ha de funcionar. Retorna els problemes, en català.
 */
async function brokenImagesMismatches(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('.sim-preview__frame')]
    .every((frame) => frame.contentDocument?.URL === 'about:srcdoc' && frame.contentDocument.readyState === 'complete'),
  null, { timeout: 5000 }).catch(() => {});
  return page.evaluate(() => [...document.querySelectorAll('.sim')].flatMap((host, i) => {
    const doc = host.querySelector('.sim-preview__frame')?.contentDocument;
    const broken = doc ? [...doc.images].filter((img) =>
      (img.getAttribute('src') || '').trim() && img.complete && img.naturalWidth === 0).length : 0;
    const reported = [...host.querySelectorAll('.sim-problem__rule')]
      .filter((code) => code.textContent === 'html/image-not-found').length;
    const found = [];
    if (broken !== reported) found.push(`simulador ${i + 1}: ${broken} imatge(s) no es veuen i el panell ⚠ Problemes en diu ${reported}`);
    if (broken && host.dataset.id && !host.dataset.goalId) found.push(`simulador ${i + 1} (${host.dataset.id}): l'exemple té ${broken} imatge(s) que no es veuen`);
    return found;
  }));
}

// ── Editor lliure: prova de punta a punta ──
await checkFreeEditor();
await checkProblemsPanel();
await checkSeveralSimulators();
for (const file of listPages(join(SITE, 'curs'))) {
  for (const [, goal] of readFileSync(file, 'utf8').matchAll(/data-goal-id="([^"]+)"/g)) await checkExercise(file, goal);
}

await browser.close();
server.close();

if (problems.length) {
  console.error(`❌ ${problems.length} problema(es):\n` + problems.map((p) => '  · ' + p).join('\n'));
  process.exit(1);
}
console.log(`✅ Tot correcte (${visits} visites de pàgina)`);

async function checkFreeEditor() {
  const where = 'editor lliure';
  const fail = (msg) => problems.push(`${where}: ${msg}`);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const externalRequests = [];
  // La CSP de la previsualització bloqueja les peticions externes abans que
  // surtin a la xarxa (Chromium les registra com a fallides amb «csp»):
  // només compten les que acaben de debò.
  page.on('requestfinished', (req) => { if (req.url().includes('example.com')) externalRequests.push(req.url()); });
  page.on('requestfailed', (req) => {
    if (req.url().includes('example.com') && req.failure()?.errorText !== 'csp') externalRequests.push(req.url());
  });
  page.on('pageerror', (err) => fail(`excepció: ${err.message}`));
  page.on('dialog', (dialog) => { fail(`diàleg inesperat: ${dialog.message()}`); dialog.dismiss(); });

  await page.goto(origin + '/editor/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  const editor = page.locator('.sim-code__panel:not([hidden]) textarea');
  const preview = page.frameLocator('.sim-preview__frame');
  const previewText = () => preview.locator('body').innerText();

  // 1. El codi inicial es veu al resultat
  if (!(await previewText()).includes('Hola, món!')) fail('el resultat no mostra el codi inicial');

  // 2. Escriure HTML amb Retorn: indentació automàtica i resultat en directe
  await editor.click();
  await editor.press('Control+End');
  await editor.evaluate((ta) => {
    const pos = ta.value.indexOf('</body>');
    ta.setSelectionRange(pos, pos);
  });
  await page.keyboard.type('<ul>');
  await page.keyboard.press('Enter');
  await page.keyboard.type('<li>Pomes</li>');
  const value = await editor.inputValue();
  if (!value.includes('<ul>\n    <li>Pomes</li>')) fail('el Retorn no ha indentat la línia nova: ' + JSON.stringify(value.slice(value.indexOf('<ul>'), value.indexOf('<ul>') + 30)));
  await page.waitForTimeout(600);
  if (!(await previewText()).includes('Pomes')) fail('el resultat no s\'ha actualitzat');

  // 3. Ctrl+Z desfà
  await page.keyboard.press('Control+z');
  if ((await editor.inputValue()).includes('<li>Pomes</li>')) fail('Ctrl+Z no ha desfet el text');
  await page.keyboard.type('<li>Pomes</li>');

  // 4. Seguretat (dues proteccions independents, es comproven per separat):
  //    a) l'iframe no pot executar scripts (sandbox sense allow-scripts);
  //    b) la CSP del document bloqueja scripts i peticions externes.
  //    L'editor lliure permet formularis (data-forms): allow-forms, mai allow-scripts.
  const sandbox = await page.locator('.sim-preview__frame').getAttribute('sandbox');
  if (sandbox !== 'allow-same-origin allow-forms') fail(`l'iframe té sandbox="${sandbox}" (ha de ser "allow-same-origin allow-forms")`);
  const csp = await preview.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  if (!/default-src 'none'/.test(csp) || /script-src/.test(csp)) fail('la CSP de la previsualització no bloqueja els scripts: ' + csp);
  if (!/form-action 'none'/.test(csp)) fail('la CSP de la previsualització no bloqueja els enviaments de formularis: ' + csp);
  await page.keyboard.type('<script>parent.document.title = "PIRATEJAT"</script>');
  await page.keyboard.type('<img src="https://example.com/x.png" alt="x" onerror="parent.document.title = \'PIRATEJAT\'">');
  await page.waitForTimeout(800);
  if ((await page.title()).includes('PIRATEJAT')) fail('el codi de l\'alumne ha pogut executar JavaScript');
  if (externalRequests.length) fail('la previsualització ha fet una petició externa: ' + externalRequests[0]);

  // 5. Un clic a un enllaç no surt de la previsualització
  await page.keyboard.type('<a href="https://example.com">Enllaç</a>');
  await page.waitForTimeout(600);
  await preview.locator('a', { hasText: 'Enllaç' }).click();
  await page.waitForTimeout(200);
  const message = await page.locator('.sim-message').innerText();
  if (!message.includes('https://example.com')) fail('no s\'avisa de l\'enllaç: ' + JSON.stringify(message));
  if (!(await previewText()).includes('Pomes')) fail('l\'enllaç ha fet sortir la previsualització');

  // 5a. Un formulari no envia res: el simulador mostra les dades que enviaria
  //     (fins i tot amb action cap a un altre web). El clic d'abans ha deixat
  //     el focus a la previsualització: el cursor torna a l'editor, abans de </body>
  await editor.evaluate((ta) => {
    ta.focus();
    const pos = ta.value.indexOf('</body>');
    ta.setSelectionRange(pos, pos);
  });
  await page.keyboard.type('<form action="https://example.com/f"><input name="nom" value="Anna"><button>Envia</button></form>');
  await page.waitForTimeout(600);
  await preview.locator('button', { hasText: 'Envia' }).click();
  await page.waitForTimeout(300);
  const sent = await page.locator('.sim-message').innerText();
  if (!sent.includes('nom = «Anna»')) fail('no es mostren les dades del formulari: ' + JSON.stringify(sent));
  if (!(await previewText()).includes('Pomes')) fail('el formulari ha fet sortir la previsualització');
  if (externalRequests.length) fail('el formulari ha enviat dades fora: ' + externalRequests[0]);

  // 5b. La CSP protegeix encara que l'alumne escrigui alguna cosa abans de
  //     <html> (el navegador ignora una CSP que no és dins del <head>)
  const before = await editor.inputValue();
  await editor.fill('<!DOCTYPE html>\n<h1>Abans</h1>\n<html lang="ca">\n<head>\n<title>X</title>\n</head>\n' +
    '<body>\n<img src="https://example.com/y.png" alt="y">\n</body>\n</html>\n');
  await page.waitForTimeout(800);
  const cspParent = await preview.locator('meta[http-equiv="Content-Security-Policy"]')
    .evaluate((meta) => meta.parentElement.localName);
  if (cspParent !== 'head') fail(`la CSP ha quedat dins de <${cspParent}>: el navegador només la té en compte dins de <head>`);
  if (externalRequests.length) fail('amb text abans de <html>, la previsualització ha fet una petició externa: ' + externalRequests[0]);
  await editor.fill(before);

  // 6. Tab al CSS i canvi de pestanya
  await page.locator('.sim-tab', { hasText: 'estils.css' }).click();
  const css = page.locator('.sim-code__panel:not([hidden]) textarea');
  await css.click();
  await css.press('Control+End');
  await page.keyboard.type('\nli {');
  await page.keyboard.press('Enter');
  await page.keyboard.type('color: red;');
  if (!(await css.inputValue()).includes('li {\n  color: red;')) fail('el Retorn després de «{» no ha indentat');
  await page.waitForTimeout(600);
  const color = await preview.locator('li').first().evaluate((li) => getComputedStyle(li).color);
  if (color !== 'rgb(255, 0, 0)') fail('el CSS no s\'aplica al resultat (color: ' + color + ')');

  // 7. El codi es desa: després de recarregar hi continua
  await page.waitForTimeout(700);
  await page.reload({ waitUntil: 'networkidle' });
  if (!(await page.locator('.sim-code__panel textarea').first().inputValue()).includes('<li>Pomes</li>')) {
    fail('el codi no s\'ha desat al navegador');
  }
  await page.evaluate(() => localStorage.clear());
  await page.close();
  visits++;
}

// S'executa dins de la pàgina: ids que hi apareixen més d'una vegada
function duplicateIds() {
  const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}

// Dos exemples no editables (sense data-id) a la mateixa pàgina, com
// passarà als capítols: les pestanyes no poden repetir ids, i cada panell
// ha d'apuntar a la pestanya del seu simulador.
async function checkSeveralSimulators() {
  const where = 'diversos simuladors';
  const page = await browser.newPage();
  page.on('pageerror', (err) => problems.push(`${where}: excepció: ${err.message}`));
  await page.goto(origin + '/', { waitUntil: 'networkidle' });

  const brokenPanels = await page.evaluate(async () => {
    const { mountSimulator } = await import('/js/sim/simulador.js');
    for (let n = 0; n < 2; n++) {
      const host = document.createElement('div');
      host.className = 'simulador';
      host.setAttribute('data-readonly', '');
      for (const [file, code] of [['index.html', '<p>Hola</p>\n'], ['estils.css', 'p {\n  color: teal;\n}\n']]) {
        const block = document.createElement('script');
        block.type = 'text/plain';
        block.dataset.file = file;
        block.textContent = code;
        host.append(block);
      }
      document.body.append(host);
      mountSimulator(host);
    }
    return [...document.querySelectorAll('[role="tabpanel"]')].filter((panel) => {
      const tab = document.getElementById(panel.getAttribute('aria-labelledby'));
      return !tab || tab.closest('.simulador') !== panel.closest('.simulador');
    }).length;
  });
  const repeated = await page.evaluate(duplicateIds);
  if (repeated.length) problems.push(`${where}: ids repetits: ${repeated.join(', ')}`);
  if (brokenPanels) problems.push(`${where}: ${brokenPanels} panell(s) apunten a una pestanya d'un altre simulador`);
  await page.close();
}

// Panell ⚠ Problemes de l'editor lliure
async function checkProblemsPanel() {
  const where = 'panell de problemes';
  const fail = (msg) => problems.push(`${where}: ${msg}`);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (err) => fail(`excepció: ${err.message}`));
  await page.goto(origin + '/editor/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  const status = page.locator('.sim-problems__status');
  const entries = page.locator('.sim-problem');
  const editor = page.locator('.sim-code__panel:not([hidden]) textarea');
  const caretLine = () => editor.evaluate((ta) => ta.value.slice(0, ta.selectionStart).split('\n').length);

  // 1. El codi inicial no té cap problema; la línia d'estat és una regió aria-live
  if (!(await status.innerText()).includes('Cap problema')) fail('amb el codi inicial no diu «Cap problema»: ' + await status.innerText());
  if (await status.getAttribute('aria-live') !== 'polite') fail('la línia d\'estat no és aria-live');

  // 2. El paràgraf del codi inicial, sense tancar: surt al panell amb la
  //    seva línia i la línia es marca
  const lines = (await editor.inputValue()).split('\n');
  const index = lines.findIndex((line) => line.trim().startsWith('<p>'));
  const pLine = index + 1;
  lines[index] = lines[index].replace(/<p>.*$/, '<p>Sense tancar');
  await editor.fill(lines.join('\n'));
  await page.waitForTimeout(700);
  const first = entries.first();
  if (index === -1) fail('el codi inicial no té cap <p>');
  if (!(await first.innerText()).includes('<p> no està tancat')) fail('no surt l\'error del <p>: ' + await first.innerText());
  if (!(await first.innerText()).includes(`línia ${pLine}`)) fail(`l'error no diu la línia ${pLine}`);
  if ((await status.innerText()) !== '1 error') fail('la línia d\'estat diu: ' + await status.innerText());
  if (!(await page.locator('.sim-editor__mark--error').count())) fail('no es marca la línia amb l\'error');

  // 3. Clic a l'entrada: el cursor va a la línia del <p>
  await editor.evaluate((ta) => ta.setSelectionRange(0, 0));
  await first.locator('button').click();
  if (await caretLine() !== pLine) fail(`el clic ha portat el cursor a la línia ${await caretLine()}, no a la ${pLine}`);
  if (!(await editor.evaluate((ta) => ta === document.activeElement))) fail('després del clic, el focus no és a l\'editor');

  // 4. CSS validat pel navegador: «colr» no existeix (suggeriment: color)
  await page.locator('.sim-tab', { hasText: 'estils.css' }).click();
  await page.locator('.sim-code__panel:not([hidden]) textarea').fill('h1 {\n  colr: teal;\n}\n');
  await page.waitForTimeout(700);
  const cssEntry = entries.filter({ hasText: 'colr' });
  if (!(await cssEntry.count())) fail('no surt la propietat «colr»');
  else if (!(await cssEntry.innerText()).includes('Potser volies escriure color?')) fail('no suggereix «color»');

  // 5. Amb el teclat: des de la pestanya index.html, Retorn a l'entrada del CSS
  //    canvia de pestanya i porta el cursor a la línia 2
  await page.locator('.sim-tab', { hasText: 'index.html' }).click();
  await cssEntry.locator('button').focus();
  await page.keyboard.press('Enter');
  const activeTab = await page.locator('.sim-tab[aria-selected="true"]').innerText();
  if (activeTab !== 'estils.css') fail('l\'entrada del CSS no ha obert la pestanya estils.css');
  if (await caretLine() !== 2) fail(`el teclat ha portat el cursor a la línia ${await caretLine()}, no a la 2`);

  await page.evaluate(() => localStorage.clear());
  await page.close();
}

// Un exercici d'un capítol, de punta a punta, en un mòbil
async function checkExercise(file, goal) {
  const where = `${relative(SITE, file)} (${goal})`;
  const fail = (msg) => problems.push(`${where}: ${msg}`);
  const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
  page.on('pageerror', (err) => fail(`excepció: ${err.message}`));
  page.on('dialog', (dialog) => { fail(`diàleg inesperat: ${dialog.message()}`); dialog.dismiss(); });
  const url = origin + '/' + relative(SITE, file).split(sep).join('/');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  const sim = page.locator(`[data-goal-id="${goal}"]`);
  const check = sim.locator('.sim-button--check');
  await sim.scrollIntoViewIfNeeded();
  await check.waitFor();
  const failing = () => sim.locator('.sim-check--fail').allInnerTexts();

  // 1. El codi inicial no supera l'exercici (si no, l'exercici es resol sol)
  await check.click();
  await sim.locator('.sim-check').first().waitFor();
  if (!(await failing()).length) fail('el codi inicial ja supera totes les comprovacions');

  // 2. La solució les supera totes, sense cap error al panell ⚠ Problemes
  for (const name of readdirSync(join(SOLUTIONS, goal))) {
    await sim.locator('.sim-tab', { hasText: name }).click();
    await sim.locator('.sim-code__panel:not([hidden]) textarea').fill(readFileSync(join(SOLUTIONS, goal, name), 'utf8'));
  }
  await page.waitForTimeout(600);
  await sim.locator('.sim-panel-tab', { hasText: 'Problemes' }).click();
  const lintStatus = await sim.locator('.sim-problems__status').innerText();
  if (/error/.test(lintStatus)) fail(`la solució té errors al panell ⚠ Problemes: ${lintStatus}`);
  await check.click();
  const passed = await sim.locator('.sim-checks__status--pass').waitFor({ timeout: 5000 }).then(() => true, () => false);
  if (!passed) {
    fail('la solució no supera: ' + (await failing()).join(' | '));
    await page.close();
    return;
  }

  // 3. Queda desat: ✓ al menú (si és l'exercici principal) i després de recarregar
  const [, pagina, num] = /(capitol|repte)-(\d+)\.html$/.exec(file);
  const isMain = findPage(pagina, Number(num))?.goalId === goal;
  if (isMain && !(await page.locator('.course-menu__item--done').count())) fail('el menú no marca el capítol com a superat');
  await page.reload({ waitUntil: 'networkidle' });
  await sim.scrollIntoViewIfNeeded();
  const status = sim.locator('.sim-checks__status');   // (pot ser a la pestanya no visible)
  await status.waitFor({ state: 'attached' });
  if (!(await status.textContent()).includes('Ja has superat')) fail('després de recarregar no diu que ja està superat');
  await page.evaluate(() => localStorage.clear());
  await page.close();
}
