// ════════════════════════════════════════════════════════
// editor/editor.js — Editor de codi amb ressaltat i números de línia
//
// Tècnica (la mateixa de PyCat i JSCat, sense dependències): un
// <textarea> transparent a sobre d'un <pre> amb el codi ressaltat.
// L'alumne escriu al textarea; a cada canvi es torna a pintar el <pre>.
// Una tercera capa (marks) pinta el fons de les línies amb errors.
//
// Totes les edicions programades passen per editText(), que fa servir
// document.execCommand('insertText') perquè Ctrl+Z les pugui desfer
// (basat en pycat/js/editor.js, 2026-10).
//
// Accessibilitat: Tab indenta; per sortir de l'editor amb el teclat,
// Esc i després Tab.
//
// API pública:
//   createEditor(container, { value, lang, readonly, label, onChange })
//     → { textarea, getValue(), setValue(text, { undoable }),
//         setMarks([{ line, kind }]), focus() }
//   kind: 'error' | 'warning'
// ════════════════════════════════════════════════════════

import { highlightLines } from './highlight.js';
import { newlineEdit, indentEdit, dedentEdit } from './editing.js';
import { t } from '../i18n/ca.js';

/**
 * Substitueix text[from..to) per `text` de manera que Ctrl+Z ho desfaci.
 *
 * @param {HTMLTextAreaElement} ta
 * @param {string} text
 * @param {number} from
 * @param {number} to
 */
export function editText(ta, text, from, to) {
  ta.focus();
  ta.setSelectionRange(from, to);
  let ok = false;
  try {
    ok = document.execCommand(text === '' ? 'delete' : 'insertText', false, text);
  } catch {
    ok = false;
  }
  if (!ok) {
    ta.value = ta.value.slice(0, from) + text + ta.value.slice(to);
    ta.setSelectionRange(from + text.length, from + text.length);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function applyEdit(ta, edit) {
  editText(ta, edit.insert, edit.from, edit.to);
  ta.setSelectionRange(edit.selStart, edit.selEnd);
}

function el(tag, className, attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

/**
 * @param {HTMLElement} container
 * @param {{ value?: string, lang: 'html'|'css', readonly?: boolean,
 *           label?: string, onChange?: (value: string) => void }} options
 */
export function createEditor(container, { value = '', lang, readonly = false, label = '', onChange }) {
  const root = el('div', 'sim-editor');
  const gutter = el('div', 'sim-editor__gutter', { 'aria-hidden': 'true' });
  const body = el('div', 'sim-editor__body');
  const marks = el('div', 'sim-editor__marks', { 'aria-hidden': 'true' });
  const pre = el('pre', 'sim-editor__highlight', { 'aria-hidden': 'true' });
  const ta = el('textarea', 'sim-editor__input', {
    spellcheck: 'false',
    wrap: 'off',
    autocapitalize: 'off',
    autocomplete: 'off',
    autocorrect: 'off',
    'aria-label': label,
    title: t('sim.help'),
  });
  ta.value = value;
  ta.readOnly = readonly;
  body.append(marks, pre, ta);
  root.append(gutter, body);
  container.append(root);

  let lineCount = 0;
  let markList = [];

  function render() {
    const lines = highlightLines(ta.value, lang);
    pre.innerHTML = lines.join('\n') + '\n';        // highlightLines ja escapa el text
    if (lines.length !== lineCount) {
      lineCount = lines.length;
      gutter.textContent = '';
      for (let i = 1; i <= lineCount; i++) {
        const number = el('div', 'sim-editor__line-number');
        number.textContent = String(i);
        gutter.append(number);
      }
      renderMarks();
    }
    syncScroll();
  }

  function renderMarks() {
    marks.textContent = '';
    for (const { line, kind } of markList) {
      if (line < 1 || line > lineCount) continue;
      const mark = el('div', `sim-editor__mark sim-editor__mark--${kind}`);
      mark.style.setProperty('--line', String(line - 1));
      marks.append(mark);
    }
  }

  function syncScroll() {
    const offset = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
    pre.style.transform = offset;
    marks.style.transform = `translateY(${-ta.scrollTop}px)`;
    gutter.scrollTop = ta.scrollTop;
  }

  ta.addEventListener('input', () => {
    render();
    onChange?.(ta.value);
  });
  ta.addEventListener('scroll', syncScroll);

  // Esc i després Tab: deixa sortir el focus de l'editor
  let escaped = false;
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { escaped = true; return; }
    const wasEscaped = escaped;
    escaped = false;
    if (ta.readOnly || e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Tab') {
      if (wasEscaped) return;
      e.preventDefault();
      const edit = e.shiftKey
        ? dedentEdit(ta.value, ta.selectionStart, ta.selectionEnd)
        : indentEdit(ta.value, ta.selectionStart, ta.selectionEnd);
      applyEdit(ta, edit);
    } else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (ta.selectionStart !== ta.selectionEnd) editText(ta, '', ta.selectionStart, ta.selectionEnd);
      applyEdit(ta, newlineEdit(ta.value, ta.selectionStart, lang));
    }
  });

  if (readonly) {
    const toast = el('div', 'sim-editor__toast', { role: 'status' });
    toast.textContent = t('sim.readonly');
    body.append(toast);
    let timer = null;
    ta.addEventListener('pointerdown', () => {
      clearTimeout(timer);
      toast.classList.add('sim-editor__toast--visible');
      timer = setTimeout(() => toast.classList.remove('sim-editor__toast--visible'), 1400);
    });
  }

  render();

  return {
    textarea: ta,
    getValue: () => ta.value,
    setValue(text, { undoable = false } = {}) {
      if (text === ta.value) return;
      if (undoable) {
        editText(ta, text, 0, ta.value.length);
        ta.setSelectionRange(0, 0);
        ta.scrollTop = 0;
      } else {
        ta.value = text;
        render();
      }
    },
    setMarks(list) {
      markList = list;
      renderMarks();
    },
    focus: () => ta.focus(),
  };
}
