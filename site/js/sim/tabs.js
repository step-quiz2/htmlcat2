// ════════════════════════════════════════════════════════
// sim/tabs.js — Pestanyes accessibles (patró ARIA «tabs»)
//
// Les fan servir el simulador per als fitxers (index.html, estils.css) i
// per als panells (⚠ Problemes, ✓ Comprovacions). Les fletxes esquerra i
// dreta canvien de pestanya; només la pestanya activa rep el focus amb Tab.
//
// API pública:
//   createTabList({ label, idPrefix, tabClass, items, onSelect })
//     → { element, select(index, { focus }), selected() }
//   items: [{ label, panel }]   panel: l'element que mostra la pestanya
// ════════════════════════════════════════════════════════

/**
 * @param {{ label: string, idPrefix: string, tabClass: string,
 *           items: Array<{ label: string, panel: HTMLElement }>,
 *           onSelect?: (index: number) => void }} options
 */
export function createTabList({ label, idPrefix, tabClass, items, onSelect }) {
  const element = document.createElement('div');
  element.setAttribute('role', 'tablist');
  element.setAttribute('aria-label', label);
  let current = 0;

  const tabs = items.map(({ label: text, panel }, i) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = tabClass;
    tab.textContent = text;
    tab.id = `${idPrefix}-tab-${i}`;
    panel.id = `${idPrefix}-panel-${i}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    tab.addEventListener('click', () => select(i));
    element.append(tab);
    return tab;
  });

  function select(index, { focus = false } = {}) {
    current = index;
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      items[i].panel.hidden = i !== index;
    });
    if (focus) tabs[index].focus();
    onSelect?.(index);
  }

  element.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    const index = tabs.indexOf(document.activeElement);
    if (!step || index === -1) return;
    e.preventDefault();
    select((index + step + tabs.length) % tabs.length, { focus: true });
  });

  select(0);
  return { element, select, selected: () => current };
}
