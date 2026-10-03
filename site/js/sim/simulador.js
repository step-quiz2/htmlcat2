// ════════════════════════════════════════════════════════
// sim/simulador.js — El simulador: editor + previsualització en directe
//
// Converteix un <div class="simulador"> en un simulador. La definició
// es llegeix del mateix element (docs/BLUEPRINT.md §5.2):
//
//   <div class="simulador" data-id="c03-llista" data-mode="fragment">
//     <script type="text/plain" data-file="index.html"> …HTML… </script>
//     <script type="text/plain" data-file="estils.css" data-readonly> …CSS… </script>
//   </div>
//
// Els blocs <script type="text/plain"> conserven el codi exactament
// (entitats, cometes, errors fets expressament); dedent() en treu la
// indentació de la pàgina.
//
// Atributs: data-id (obligatori si és editable: clau per desar el codi),
// data-mode (fragment | document), data-readonly (tot l'exemple),
// data-forms (permet formularis), data-height (alçada en px),
// data-goal-id (exercici validat, amb un <script type="application/json"
// data-checks> a dins: docs/STATE.md §2.7).
//
// Sota l'editor i el resultat, el panell ⚠ Problemes (sim/problems-panel.js)
// mostra el que troba el revisor de codi (lint/lint.js) quan l'alumne
// s'atura d'escriure, i les línies amb problemes es marquen a l'editor.
// Els exercicis tenen, a més, el botó «✓ Comprova» i el panell
// ✓ Comprovacions (sim/checks-panel.js): les comprovacions s'avaluen en
// un iframe ocult (sim/check-frame.js) i, si se superen totes, l'exercici
// queda superat (course/progress.js).
//
// API pública:
//   mountSimulator(el, { fileActions, chapter }) → { getFiles() }
//   fileActions: true afegeix els botons Obre / Desa (editor lliure)
//   chapter: capítol de la pàgina; el revisor només aplica les regles del
//            que ja s'ha ensenyat. Sense (editor lliure): totes.
// ════════════════════════════════════════════════════════

import { dedent } from '../util/text.js';
import { load, save } from '../util/storage.js';
import { t } from '../i18n/ca.js';
import { createEditor } from '../editor/editor.js';
import { buildSrcdoc } from '../preview/srcdoc.js';
import { createPreview } from '../preview/preview.js';
import { lintStatic } from '../lint/lint.js';
import { runChecks } from '../checks/checks.js';
import { isGoalCompleted, saveGoalCompleted } from '../course/progress.js';
import { createTabList } from './tabs.js';
import { createProblemsPanel } from './problems-panel.js';
import { createChecksPanel } from './checks-panel.js';
import { renderForChecks } from './check-frame.js';

const ASSET_BASE = new URL('../../recursos/', import.meta.url).href;
const PREVIEW_DELAY = 300;
const LINT_DELAY = 400;
const SAVE_DELAY = 500;
const MESSAGE_TIME = 4000;

// El navegador mateix diu quines propietats i valors CSS són vàlids
const cssSupports = (property, value) => CSS.supports(property, value);

// Simuladors muntats a la pàgina: dona ids únics a les pestanyes (els
// exemples no editables no tenen data-id i n'hi pot haver molts)
let mountedCount = 0;

/**
 * Llegeix la definició d'un simulador del seu element.
 *
 * @param {HTMLElement} el
 */
export function readDefinition(el) {
  const files = {};
  const readonlyFiles = new Set();
  for (const block of el.querySelectorAll(':scope > script[type="text/plain"][data-file]')) {
    files[block.dataset.file] = dedent(block.textContent);
    if (block.hasAttribute('data-readonly')) readonlyFiles.add(block.dataset.file);
  }
  return {
    id: el.dataset.id || null,
    goalId: el.dataset.goalId || null,
    mode: el.dataset.mode === 'document' ? 'document' : 'fragment',
    readonly: el.hasAttribute('data-readonly'),
    forms: el.hasAttribute('data-forms'),
    height: Number(el.dataset.height) || null,
    files,
    readonlyFiles,
    checks: readChecks(el),
  };
}

// Les comprovacions de l'exercici, o null (si el JSON està mal escrit,
// l'exercici no es pot comprovar; el test estàtic ho detecta abans)
function readChecks(el) {
  const block = el.querySelector(':scope > script[type="application/json"][data-checks]');
  if (!block) return null;
  try {
    return JSON.parse(block.textContent);
  } catch {
    return null;
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, text, title) {
  const b = el('button', className, text);
  b.type = 'button';
  if (title) b.title = title;
  return b;
}

const langOf = (name) => (name.endsWith('.css') ? 'css' : 'html');

/**
 * @param {HTMLElement} host element .simulador
 * @param {{ fileActions?: boolean, chapter?: number }} [options]
 */
export function mountSimulator(host, { fileActions = false, chapter = Infinity } = {}) {
  const def = readDefinition(host);
  const initialFiles = { ...def.files };
  const storageKey = def.id && !def.readonly ? 'code:' + def.id : null;
  const saved = storageKey ? load(storageKey, null) : null;
  const files = { ...initialFiles };
  if (saved && saved.files) {
    for (const name of Object.keys(files)) {
      if (typeof saved.files[name] === 'string') files[name] = saved.files[name];
    }
  }
  const names = Object.keys(files);
  const idPrefix = `sim${++mountedCount}`;

  const hasChecks = Boolean(def.goalId && Array.isArray(def.checks));
  let checksPanel = null;   // només als exercicis (més avall)

  // ── Estructura ──
  host.textContent = '';
  host.classList.add('sim');
  if (def.height) host.style.setProperty('--sim-height', `${def.height}px`);
  const toolbar = el('div', 'sim-toolbar');
  const actions = el('div', 'sim-actions');

  const main = el('div', 'sim-main');
  const code = el('div', 'sim-code');
  const result = el('div', 'sim-result');
  const resultHeader = el('div', 'sim-result__header', t('sim.result'));
  const previewBox = el('div', 'sim-result__body');
  result.append(resultHeader, previewBox);
  main.append(code, result);

  const panels = el('div', 'sim-panels');
  const message = el('div', 'sim-message');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  host.append(toolbar, main, panels, message);

  // ── Missatges breus (enllaços, formularis, desar…) ──
  let messageTimer = null;
  function showMessage(text, { sticky = false } = {}) {
    clearTimeout(messageTimer);
    message.textContent = text;
    message.classList.toggle('sim-message--visible', Boolean(text));
    if (text && !sticky) messageTimer = setTimeout(() => showMessage(''), MESSAGE_TIME);
  }

  // ── Previsualització ──
  const preview = createPreview(previewBox, {
    title: t('sim.result.title'),
    forms: def.forms,
    onLink(href, doc) {
      if (href.startsWith('#')) {
        const id = decodeURIComponent(href.slice(1));
        if (id && !doc.getElementById(id)) showMessage(t('sim.link.anchor.missing', { id }));
      } else {
        showMessage(t('sim.link', { href }));
      }
    },
    onSubmit(entries) {
      showMessage(entries.length
        ? t('sim.form', { data: entries.map(([k, v]) => `${k} = «${v}»`).join(', ') })
        : t('sim.form.empty'));
    },
  });

  let previewTimer = null;
  let lintTimer = null;
  function updatePreview() {
    const { html, missingFiles } = buildSrcdoc({ files, mode: def.mode, assetBase: ASSET_BASE });
    preview.render(html);
    if (missingFiles.length) {
      showMessage(t('sim.missing.css', { file: missingFiles[0], files: names.join(', ') }), { sticky: true });
    } else if (message.dataset.kind === 'missing') {
      showMessage('');
    }
    message.dataset.kind = missingFiles.length ? 'missing' : '';
  }

  // ── Desar al navegador ──
  let saveTimer = null;
  let warnedNoSave = false;
  function scheduleSave() {
    if (!storageKey) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const ok = save(storageKey, { files, savedAt: Date.now() });
      if (!ok && !warnedNoSave) {
        warnedNoSave = true;
        showMessage(t('sim.saved.none'), { sticky: true });
      }
    }, SAVE_DELAY);
  }

  // ── Pestanyes i editors (un editor per fitxer) ──
  const filePanels = names.map(() => el('div', 'sim-code__panel'));
  const fileTabs = createTabList({
    label: t('sim.files'),
    idPrefix: `${idPrefix}-file`,
    tabClass: 'sim-tab',
    items: names.map((name, i) => ({ label: name, panel: filePanels[i] })),
  });
  fileTabs.element.className = 'sim-tabs';
  toolbar.append(fileTabs.element, actions);
  code.append(...filePanels);
  const selectTab = (index) => fileTabs.select(index);
  const activeName = () => names[fileTabs.selected()];

  const editors = {};
  names.forEach((name, i) => {
    editors[name] = createEditor(filePanels[i], {
      value: files[name],
      lang: langOf(name),
      readonly: def.readonly || def.readonlyFiles.has(name),
      label: t('sim.editor.label', { file: name }),
      onChange(value) {
        files[name] = value;
        clearTimeout(previewTimer);
        previewTimer = setTimeout(updatePreview, PREVIEW_DELAY);
        clearTimeout(lintTimer);
        lintTimer = setTimeout(updateProblems, LINT_DELAY);
        checksPanel?.stale();
        scheduleSave();
      },
    });
  });

  // ── Botons ──
  const editable = !def.readonly && names.some((name) => !def.readonlyFiles.has(name));
  if (editable && storageKey && !fileActions) {
    const restore = button('sim-button', t('sim.restore'), t('sim.restore.title'));
    restore.addEventListener('click', () => {
      if (names.every((name) => files[name] === initialFiles[name])) return;
      if (!window.confirm(t('sim.restore.confirm'))) return;
      for (const name of names) editors[name].setValue(initialFiles[name], { undoable: true });
    });
    actions.append(restore);
  }
  if (fileActions) actions.append(...createFileActions());

  function createFileActions() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.htm,.css';
    input.hidden = true;
    const open = button('sim-button', t('sim.open'), t('sim.open.title'));
    const download = button('sim-button', t('sim.save'), t('sim.save.title'));

    open.addEventListener('click', () => {
      input.value = '';
      input.click();
    });
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      const target = /\.css$/i.test(file.name) ? names.find((n) => n.endsWith('.css'))
        : /\.html?$/i.test(file.name) ? 'index.html' : null;
      if (!target || !editors[target]) {
        showMessage(t('sim.open.unknown'));
        return;
      }
      selectTab(names.indexOf(target));
      editors[target].setValue(await file.text(), { undoable: true });
      showMessage(t('sim.opened', { file: file.name }));
    });
    download.addEventListener('click', () => {
      const name = activeName();
      const type = langOf(name) === 'css' ? 'text/css' : 'text/html';
      const url = URL.createObjectURL(new Blob([files[name]], { type: type + ';charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    });
    return [input, open, download];
  }

  // ── Panells: ⚠ Problemes (i, als exercicis, ✓ Comprovacions) ──
  const problemsBox = el('div', 'sim-panels__panel');
  let panelTabs = null;
  if (hasChecks) {
    const checksBox = el('div', 'sim-panels__panel');
    panelTabs = createTabList({
      label: t('sim.panels'),
      idPrefix: `${idPrefix}-panels`,
      tabClass: 'sim-panel-tab',
      items: [{ label: t('sim.problems'), panel: problemsBox }, { label: t('sim.checks'), panel: checksBox }],
    });
    panelTabs.element.className = 'sim-panels__tabs';
    panels.append(panelTabs.element, problemsBox, checksBox);
    checksPanel = createChecksPanel(checksBox);
    checksPanel.idle(isGoalCompleted(def.goalId));
    actions.prepend(createCheckButton());
  } else {
    panels.append(problemsBox);
  }

  const problemsPanel = createProblemsPanel(problemsBox, {
    showTitle: !hasChecks,
    onSelect(problem) {
      selectTab(names.indexOf(problem.file));
      editors[problem.file].goTo(problem.start);
    },
  });

  // «✓ Comprova»: les comprovacions s'avaluen en un iframe ocult amb una
  // còpia del codi d'aquest moment
  function createCheckButton() {
    const check = button('sim-button sim-button--check', t('sim.check'), t('sim.check.title'));
    check.addEventListener('click', async () => {
      check.disabled = true;
      panelTabs.select(1);
      checksPanel.running();
      const snapshot = { ...files };
      const { html } = buildSrcdoc({ files: snapshot, mode: def.mode, assetBase: ASSET_BASE });
      const { doc, dispose } = await renderForChecks(html, { forms: def.forms });
      try {
        const results = runChecks({ doc, files: snapshot, mode: def.mode, chapter, checks: def.checks, env: { supports: cssSupports } });
        if (results.every((r) => r.passed)) saveGoalCompleted(def.goalId);
        checksPanel.show(results);
      } finally {
        dispose();
        check.disabled = false;
      }
    });
    return check;
  }

  function updateProblems() {
    const problems = lintStatic({ files, mode: def.mode, chapter, env: { supports: cssSupports } });
    problemsPanel.update(problems);
    for (const name of names) {
      const lines = new Map();      // línia → 'error' | 'warning' (l'error mana)
      for (const p of problems) {
        if (p.file !== name || p.severity === 'info' || lines.get(p.line) === 'error') continue;
        lines.set(p.line, p.severity);
      }
      editors[name].setMarks([...lines].map(([line, kind]) => ({ line, kind })));
    }
  }

  updatePreview();
  updateProblems();

  return { getFiles: () => ({ ...files }) };
}
