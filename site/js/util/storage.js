// ════════════════════════════════════════════════════════
// util/storage.js — localStorage amb espai de noms, versió i sense errors
//
// Totes les claus d'HTMLCat comencen per «htmlcat:v1:». Si el navegador
// no deixa desar (mode privat, quota plena, dades corruptes), les
// funcions no fallen: load() retorna el valor per defecte i save()
// retorna false. És l'únic lloc on s'ignoren errors expressament.
//
// API pública:
//   load(key, fallback)  → valor desat (JSON) o fallback
//   save(key, value)     → true si s'ha pogut desar
//   remove(key)
//   PREFIX
//
// Claus en ús (vegeu docs/STATE.md §2.5):
//   code:<data-id>   { files: { nom: text }, savedAt }
// ════════════════════════════════════════════════════════

export const PREFIX = 'htmlcat:v1:';

// localStorage pot no existir (Node) o llançar en accedir-hi (galetes bloquejades)
function storage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
export function load(key, fallback) {
  try {
    const raw = storage()?.getItem(PREFIX + key);
    return raw === null || raw === undefined ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {unknown} value
 * @returns {boolean}
 */
export function save(key, value) {
  try {
    const s = storage();
    if (!s) return false;
    s.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** @param {string} key */
export function remove(key) {
  try {
    storage()?.removeItem(PREFIX + key);
  } catch {
    // res a fer
  }
}
