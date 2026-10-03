// ════════════════════════════════════════════════════════
// lint/lines.js — Indentació de les línies (mòdul pur)
//
// Ajudes compartides per les regles html/indentation i css/indentation.
//
// API pública:
//   indentChecker(src, report) → { beginsLine(pos), width(pos),
//                                   expect(range, expected, data?) }
//   beginsLine(pos)  abans de pos, a la seva línia, només hi ha espais
//   width(pos)       espais a l'inici de la línia de pos (tabulador = 2)
//   expect(…)        si range comença una línia i la indentació no és
//                    `expected` espais, crida report(range, { expected,
//                    actual, …data }); amb tabuladors, { tab: true, …data }
// ════════════════════════════════════════════════════════

/**
 * @param {string} src
 * @param {(range: {start: number, end: number}, data: Object) => void} report
 */
export function indentChecker(src, report) {
  const lineStart = (pos) => src.lastIndexOf('\n', pos - 1) + 1;
  const leading = (pos) => {
    const re = /[ \t]*/y;
    re.lastIndex = lineStart(pos);
    return re.exec(src)[0];
  };
  const beginsLine = (pos) => lineStart(pos) + leading(pos).length === pos;
  const width = (pos) => leading(pos).replace(/\t/g, '  ').length;

  function expect(range, expected, data = {}) {
    if (!beginsLine(range.start)) return;
    const indent = leading(range.start);
    if (indent.includes('\t')) report(range, { tab: true, ...data });
    else if (indent.length !== expected) report(range, { expected, actual: indent.length, ...data });
  }

  return { beginsLine, width, expect };
}
