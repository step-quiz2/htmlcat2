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
// data-forms (permet formularis). Les comprovacions (data-goal-id) i el
// panell de problemes arribaran a les fases 3 i 4.
//
// API pública:
//   mountSimulator(el, { fileActions }) → { getFiles() }
//   fileActions: true afegeix els botons Obre / Desa (editor lliure)
// ════════════════════════════════════════════════════════

import { dedent } from '../util/text.js';
import { load, save } from '../util/storage.js';
import { t } from '../i18n/ca.js';
import { createEditor } from '../editor/editor.js';
import { buildSrcdoc } from '../preview/srcdoc.js';
import { createPreview } from '../preview/preview.js';

const ASSET_BASE = new URL('../../recursos/', import.meta.url).href;
const PREVIEW_DELAY = 300;
const SAVE_DELAY = 500;
const MESSAGE_TIME = 4000;

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
    mode: el.dataset.mode === 'document' ? 'document' : 'fragment',
    readonly: el.hasAttribute('data-readonly'),
    forms: el.hasAttribute('data-forms'),
    files,
    readonlyFiles,
  };
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
 * @param {{ fileActions?: boolean }} [options]
 */
export function mountSimulator(host, { fileActions = false } = {}) {
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

  // ── Estructura ──
  host.textContent = '';
  host.classList.add('sim');
  const toolbar = el('div', 'sim-toolbar');
  const tablist = el('div', 'sim-tabs');
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', t('sim.files'));
  const actions = el('div', 'sim-actions');
  toolbar.append(tablist, actions);

  const main = el('div', 'sim-main');
  const code = el('div', 'sim-code');
  const result = el('div', 'sim-result');
  const resultHeader = el('div', 'sim-result__header', t('sim.result'));
  const previewBox = el('div', 'sim-result__body');
  result.append(resultHeader, previewBox);
  main.append(code, result);

  const message = el('div', 'sim-message');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  host.append(toolbar, main, message);

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
  const tabs = [];
  const editors = {};
  names.forEach((name, i) => {
    const tab = button('sim-tab', name);
    tab.id = `${idPrefix}-tab-${i}`;
    tab.setAttribute('role', 'tab');
    const panel = el('div', 'sim-code__panel');
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    code.append(panel);
    tablist.append(tab);
    tabs.push({ tab, panel, name });

    editors[name] = createEditor(panel, {
      value: files[name],
      lang: langOf(name),
      readonly: def.readonly || def.readonlyFiles.has(name),
      label: t('sim.editor.label', { file: name }),
      onChange(value) {
        files[name] = value;
        clearTimeout(previewTimer);
        previewTimer = setTimeout(updatePreview, PREVIEW_DELAY);
        scheduleSave();
      },
    });
    tab.addEventListener('click', () => selectTab(i));
  });

  function selectTab(index, { focus = false } = {}) {
    tabs.forEach(({ tab, panel }, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      panel.hidden = !active;
    });
    if (focus) tabs[index].tab.focus();
  }

  // Fletxes per canviar de pestanya (patró ARIA de pestanyes)
  tablist.addEventListener('keydown', (e) => {
    const current = tabs.findIndex(({ tab }) => tab === document.activeElement);
    if (current === -1) return;
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    selectTab((current + step + tabs.length) % tabs.length, { focus: true });
  });

  const activeName = () => tabs.find(({ tab }) => tab.getAttribute('aria-selected') === 'true')?.name;

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

  selectTab(0);
  updatePreview();

  return { getFiles: () => ({ ...files }) };
}
