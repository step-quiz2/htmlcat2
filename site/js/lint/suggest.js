// ════════════════════════════════════════════════════════
// lint/suggest.js — «Potser volies dir…?» (mòdul pur)
//
// Troba, en una llista de noms vàlids, el més semblant al que ha escrit
// l'alumne (distància d'edició: quantes lletres cal afegir, treure,
// canviar o intercanviar amb la del costat; «titel» és a 1 de «title»).
// Si cap no s'hi assembla prou, no en suggereix cap: un suggeriment
// equivocat confon més que no ajuda.
//
// API pública:
//   editDistance(a, b)          → nombre d'operacions
//   closest(word, candidates)   → el nom més semblant, o null
// ════════════════════════════════════════════════════════

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function editDistance(a, b) {
  // d[i][j]: distància entre les i primeres lletres d'a i les j primeres de b
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const change = d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      d[i][j] = Math.min(change, d[i - 1][j] + 1, d[i][j - 1] + 1);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);   // dues lletres intercanviades
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * Noms curts (fins a 4 lletres): com a molt 1 canvi; la resta, 2.
 *
 * @param {string} word
 * @param {Iterable<string>} candidates
 * @returns {string|null}
 */
export function closest(word, candidates) {
  const limit = word.length <= 4 ? 1 : 2;
  let best = null;
  let bestDistance = limit + 1;
  for (const candidate of candidates) {
    const distance = editDistance(word, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}
