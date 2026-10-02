// ════════════════════════════════════════════════════════
// i18n/ca.js — Tots els textos de la interfície (català)
//
// API pública:
//   t(key, params?) → text; «{nom}» se substitueix per params.nom.
//   Si la clau no existeix, retorna la clau (es veu de seguida a la
//   pantalla i el test ho detectaria).
// ════════════════════════════════════════════════════════

const TEXTS = {
  'sim.files': 'Fitxers',
  'sim.result': 'Resultat',
  'sim.result.title': 'Resultat del teu codi',
  'sim.editor.label': 'Editor de {file}',
  'sim.readonly': 'No editable',
  'sim.restore': '⟲ Codi inicial',
  'sim.restore.title': 'Torna al codi inicial de l\'exercici',
  'sim.restore.confirm': 'Vols tornar al codi inicial? Ho podràs desfer amb Ctrl+Z.',
  'sim.open': 'Obre',
  'sim.open.title': 'Obre un fitxer .html o .css de l\'ordinador',
  'sim.save': 'Desa',
  'sim.save.title': 'Desa el fitxer actiu a l\'ordinador',
  'sim.open.unknown': 'Només es poden obrir fitxers .html i .css.',
  'sim.opened': 'S\'ha obert {file}.',
  'sim.saved.local': 'Desat en aquest navegador.',
  'sim.saved.none': 'Aquest navegador no deixa desar el codi: si tanques la pàgina, es perdrà.',
  'sim.link': 'Aquest enllaç portaria a: {href}',
  'sim.link.anchor.missing': 'No hi ha cap element amb id="{id}" a la pàgina.',
  'sim.form': 'Aquest formulari enviaria: {data}',
  'sim.form.empty': 'Aquest formulari no enviaria cap dada (els camps necessiten l\'atribut name).',
  'sim.missing.css': 'El fitxer «{file}» no existeix. Els fitxers d\'aquest exercici són: {files}.',
  'sim.help': 'Tab: indenta · Maj+Tab: desindenta · Esc i després Tab: surt de l\'editor',
};

/**
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
export function t(key, params = {}) {
  const text = TEXTS[key];
  if (text === undefined) return key;
  return text.replace(/\{(\w+)\}/g, (_, name) => (name in params ? String(params[name]) : `{${name}}`));
}

export const KEYS = Object.keys(TEXTS);
