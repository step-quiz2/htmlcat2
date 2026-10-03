// ════════════════════════════════════════════════════════
// checks/schema.js — Valida les comprovacions d'un exercici (mòdul pur)
//
// Cada exercici porta, en un <script type="application/json" data-checks>,
// una llista de comprovacions (docs/BLUEPRINT.md §4.8, docs/STATE.md §2.7):
//   [{ "type": "count", "selector": "body > p", "min": 2,
//      "msg": "Hi ha d'haver almenys dos paràgrafs <p>." }, …]
// Aquest mòdul diu si la llista està ben escrita: el fa servir el test
// estàtic de totes les pàgines. Un camp desconegut és un error (així es
// detecten les faltes d'ortografia, com «selecter»).
//
// API pública:
//   CHECK_TYPES
//   validateChecks(value, { ruleIds }) → string[] (errors; buit si està bé)
//   ruleIds: ids de les regles del revisor (per a les comprovacions «lint»)
// ════════════════════════════════════════════════════════

/** Camps de cada tipus: obligatoris, opcionals, «exactament un de» i «almenys un de». */
const SPEC = {
  exists: { required: ['selector'], optional: [] },
  count: { required: ['selector'], optional: [], atLeastOne: ['eq', 'min', 'max'] },
  text: { required: ['selector'], optional: ['all', 'ci'], oneOf: ['equals', 'includes', 'matches'] },
  attr: { required: ['selector', 'name'], optional: ['all', 'ci'], oneOf: ['present', 'nonEmpty', 'equals', 'includes', 'matches'] },
  style: { required: ['selector', 'prop', 'equals'], optional: ['all'] },
  'uses-html': { required: [], optional: [], atLeastOne: ['tag', 'attr'] },
  'uses-css': { required: ['prop'], optional: ['selector', 'matches', 'value'] },
  lint: { required: [], optional: ['maxErrors', 'maxWarnings', 'rules'] },
};

export const CHECK_TYPES = Object.keys(SPEC);

const STRING_FIELDS = new Set(['selector', 'equals', 'includes', 'matches', 'name', 'prop', 'value', 'tag', 'attr', 'msg']);
const TRUE_FIELDS = new Set(['present', 'nonEmpty']);   // només tenen sentit a true
const BOOLEAN_FIELDS = new Set(['all', 'ci']);
const COUNT_FIELDS = new Set(['eq', 'min', 'max', 'maxErrors', 'maxWarnings']);

function fieldErrors(check, name, where) {
  const value = check[name];
  if (STRING_FIELDS.has(name) && (typeof value !== 'string' || !value.trim())) return [`${where}: «${name}» ha de ser un text no buit`];
  if (TRUE_FIELDS.has(name) && value !== true) return [`${where}: «${name}» ha de ser true`];
  if (BOOLEAN_FIELDS.has(name) && typeof value !== 'boolean') return [`${where}: «${name}» ha de ser true o false`];
  if (COUNT_FIELDS.has(name) && !(Number.isInteger(value) && value >= 0)) return [`${where}: «${name}» ha de ser un enter no negatiu`];
  if (name === 'matches') {
    try { new RegExp(value); } catch { return [`${where}: «matches» no és una expressió regular vàlida`]; }
  }
  return [];
}

/**
 * @param {unknown} value  el JSON ja llegit
 * @param {{ ruleIds?: Iterable<string> }} [options]
 * @returns {string[]}
 */
export function validateChecks(value, { ruleIds = [] } = {}) {
  if (!Array.isArray(value) || !value.length) return ['les comprovacions han de ser una llista no buida'];
  const knownRules = new Set(ruleIds);
  const errors = [];

  value.forEach((check, i) => {
    const where = `comprovació ${i + 1}`;
    if (!check || typeof check !== 'object' || Array.isArray(check)) {
      errors.push(`${where}: ha de ser un objecte`);
      return;
    }
    const spec = SPEC[check.type];
    if (!spec) {
      errors.push(`${where}: tipus desconegut «${check.type}» (tipus: ${CHECK_TYPES.join(', ')})`);
      return;
    }
    const allowed = new Set(['type', 'msg', ...spec.required, ...spec.optional, ...(spec.atLeastOne || []), ...(spec.oneOf || [])]);

    for (const name of Object.keys(check)) {
      if (!allowed.has(name)) errors.push(`${where}: camp desconegut «${name}»`);
      else if (name !== 'type' && name !== 'rules') errors.push(...fieldErrors(check, name, where));
    }
    if (!('msg' in check)) errors.push(`${where}: falta «msg» (el requisit, en català)`);
    for (const name of spec.required) {
      if (!(name in check)) errors.push(`${where}: falta «${name}»`);
    }
    if (spec.oneOf && spec.oneOf.filter((name) => name in check).length !== 1) {
      errors.push(`${where}: ha de tenir exactament un de ${spec.oneOf.join(', ')}`);
    }
    if (spec.atLeastOne && !spec.atLeastOne.some((name) => name in check)) {
      errors.push(`${where}: ha de tenir almenys un de ${spec.atLeastOne.join(', ')}`);
    }
    if (check.type === 'count' && 'eq' in check && ('min' in check || 'max' in check)) {
      errors.push(`${where}: «eq» no es pot combinar amb «min» ni «max»`);
    }
    if ('rules' in check) {
      if (!Array.isArray(check.rules) || !check.rules.length) errors.push(`${where}: «rules» ha de ser una llista no buida`);
      else for (const id of check.rules.filter((r) => !knownRules.has(r))) errors.push(`${where}: regla desconeguda «${id}»`);
    }
  });
  return errors;
}
