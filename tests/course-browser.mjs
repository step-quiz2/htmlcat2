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
//   4. té desplaçament horitzontal (no cap a l'amplada de la pantalla);
//   5. té ids repetits.
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
import { join, dirname, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
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
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`${where}: error a la consola: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`${where}: excepció: ${err.message}`));
    page.on('requestfailed', (req) => problems.push(`${where}: ha fallat ${req.url()}`));
    page.on('request', (req) => {
      if (!req.url().startsWith(origin) && !req.url().startsWith('data:')) {
        problems.push(`${where}: petició externa a ${req.url()}`);
      }
    });
    page.on('response', (res) => {
      if (res.status() >= 400 && res.url() !== url) problems.push(`${where}: ${res.status()} a ${res.url()}`);
    });

    await page.goto(url, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) problems.push(`${where}: desplaçament horitzontal de ${overflow} px`);
    const repeated = await page.evaluate(duplicateIds);
    if (repeated.length) problems.push(`${where}: ids repetits: ${repeated.join(', ')}`);
    await page.close();
    visits++;
  }
}

// ── Editor lliure: prova de punta a punta ──
await checkFreeEditor();
await checkProblemsPanel();
await checkSeveralSimulators();

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
  const sandbox = await page.locator('.sim-preview__frame').getAttribute('sandbox');
  if (sandbox !== 'allow-same-origin') fail(`l'iframe té sandbox="${sandbox}" (ha de ser "allow-same-origin")`);
  const csp = await preview.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  if (!/default-src 'none'/.test(csp) || /script-src/.test(csp)) fail('la CSP de la previsualització no bloqueja els scripts: ' + csp);
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

  // 2. Un <p> sense tancar a la línia 10: surt al panell i la línia es marca
  const lines = (await editor.inputValue()).split('\n');
  lines[9] = '    <p>Sense tancar';
  await editor.fill(lines.join('\n'));
  await page.waitForTimeout(700);
  const first = entries.first();
  if (!(await first.innerText()).includes('<p> no està tancat')) fail('no surt l\'error del <p>: ' + await first.innerText());
  if (!(await first.innerText()).includes('línia 10')) fail('l\'error no diu la línia 10');
  if ((await status.innerText()) !== '1 error') fail('la línia d\'estat diu: ' + await status.innerText());
  if (!(await page.locator('.sim-editor__mark--error').count())) fail('no es marca la línia amb l\'error');

  // 3. Clic a l'entrada: el cursor va a la línia 10
  await editor.evaluate((ta) => ta.setSelectionRange(0, 0));
  await first.locator('button').click();
  if (await caretLine() !== 10) fail(`el clic ha portat el cursor a la línia ${await caretLine()}, no a la 10`);
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
