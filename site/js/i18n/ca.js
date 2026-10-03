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
  'course.menu': '☰ Capítols',
  'course.menu.label': 'Capítols del curs',
  'course.editor': 'Editor lliure',
  'course.chapter': 'Capítol {num}',
  'course.repte': 'Repte {num}',
  'course.done': 'Superat',
  'course.home': 'Inici',
  'course.nav.label': 'Capítol anterior i següent',
  'course.prev': '← {title}',
  'course.next': '{title} →',
  'course.footer.content': 'Contingut:',
  'course.footer.code': 'Codi:',
  'course.footer.mit': 'llicència MIT',
  'sim.panels': 'Panells del simulador',
  'sim.check': '✓ Comprova',
  'sim.check.title': 'Comprova si el teu codi compleix tots els requisits de l\'exercici',
  'sim.checks': '✓ Comprovacions',
  'sim.checks.idle': 'Quan acabis, prem ✓ Comprova.',
  'sim.checks.done.before': 'Ja has superat aquest exercici ✓. Si vols, el pots tornar a comprovar.',
  'sim.checks.running': 'Comprovant…',
  'sim.checks.summary': 'Has complert {passed} de les {total} comprovacions.',
  'sim.checks.success': '✓ Molt bé! Has complert les {total} comprovacions.',
  'sim.checks.stale': 'Has canviat el codi: torna a prémer ✓ Comprova.',
  'sim.checks.pass': 'Complerta:',
  'sim.checks.fail': 'Pendent:',
  'checks.detail.count': '(N\'hi ha {n}.)',
  'checks.detail.none': '(No n\'hi ha cap.)',
  'checks.detail.text': '(Ara hi diu: «{text}».)',
  'checks.detail.attr.missing': '(No té l\'atribut {name}.)',
  'checks.detail.attr.value': '(Ara hi diu: «{value}».)',
  'checks.detail.style': '(Ara és {value}.)',
  'checks.detail.lint': '(Al panell ⚠ Problemes, errors: {errors}; avisos: {warnings}.)',
  'checks.detail.invalid': '(Aquesta comprovació està mal escrita: avisa el professor.)',
  'sim.problems': '⚠ Problemes',
  'sim.problems.label': 'Problemes del codi',
  'sim.problems.none': 'Cap problema ✓',
  'sim.problems.error': '{n} error',
  'sim.problems.errors': '{n} errors',
  'sim.problems.warning': '{n} avís',
  'sim.problems.warnings': '{n} avisos',
  'sim.problems.info': '{n} suggeriment',
  'sim.problems.infos': '{n} suggeriments',
  'sim.problems.severity.error': 'Error',
  'sim.problems.severity.warning': 'Avís',
  'sim.problems.severity.info': 'Suggeriment',
  'sim.problems.where': '{severity} · {file}, línia {line}',
  'sim.problems.goto': 'Porta el cursor a la línia {line}',
  'sim.problems.more': 'i {n} més com aquest',
  'sim.problems.hidden': 'N\'hi ha més: arregla primer aquests.',
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
