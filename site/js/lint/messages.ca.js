// ════════════════════════════════════════════════════════
// lint/messages.ca.js — Què diu el revisor de codi, en català
// (mòdul pur, separat de la lògica de les regles)
//
// Per a cada regla, una funció que rep les dades del problema i retorna
// { text, hint }: text diu QUÈ passa (i què ha fet el navegador en
// silenci); hint, COM arreglar-ho. To: proper, en segona persona del
// singular, sense retrets.
//
// API pública:
//   MESSAGES             { 'html/…': (data) => ({ text, hint }), … }
//   describe(id, data)   → { text, hint }
// ════════════════════════════════════════════════════════

const tag = (name) => `<${name}>`;
const espais = (n) => (n === 1 ? '1 espai' : `${n} espais`);

const INDENT_HINT_HTML = 'La indentació mostra el niuament: cada element que és dins d\'un altre va 2 espais més a la dreta que el seu pare.';
const INDENT_HINT_CSS = 'Les declaracions van 2 espais més a la dreta que el selector, i la } tanca la regla alineada amb el selector.';
const TAB_HINT = 'Fes servir espais: la tecla Tab de l\'editor ja n\'escriu 2.';

// subject: «Aquesta línia», «L'etiqueta </ul>» o «La }» (sempre femení)
function indentationText({ expected, actual, tab }, subject) {
  if (tab) return `${subject} està indentada amb tabuladors.`;
  if (expected === 0) return `${subject} no hauria d'estar indentada (té ${espais(actual)}).`;
  return `${subject} hauria de tenir ${espais(expected)} d'indentació (en té ${actual}).`;
}

const DEPRECATED_INSTEAD = {
  center: 'Per centrar, fes servir CSS (text-align: center).',
  font: 'Per al color i la lletra, fes servir CSS (color, font-family).',
  big: 'Per a la mida de la lletra, fes servir CSS (font-size).',
  strike: 'Per a un text ratllat, fes servir <s> o <del>.',
  tt: 'Per a codi, fes servir <code>.',
  marquee: 'Els textos que es mouen molesten i no són accessibles: treu-lo.',
  blink: 'Els textos que parpellegen molesten i no són accessibles: treu-lo.',
};

const OBSOLETE_ATTRIBUTE_INSTEAD = {
  align: 'Per alinear, fes servir CSS: text-align per al text, float per a una imatge.',
  bgcolor: 'Per al color de fons, fes servir CSS (background-color).',
  background: 'Per a una imatge de fons, fes servir CSS (background-image).',
  border: 'Per a la vora, fes servir CSS (border).',
  color: 'Per al color, fes servir CSS (color).',
  text: 'Per al color del text, fes servir CSS (color).',
  valign: 'Per a l\'alineació vertical, fes servir CSS (vertical-align).',
  width: 'Per a la mida, fes servir CSS (width).',
  height: 'Per a la mida, fes servir CSS (height).',
  hspace: 'Per separar la imatge del que té al costat, fes servir CSS (margin).',
  vspace: 'Per separar la imatge del que té a sobre i a sota, fes servir CSS (margin).',
  cellpadding: 'Per a l\'espai de dins de les cel·les, fes servir CSS (padding).',
  cellspacing: 'Per a l\'espai entre cel·les, fes servir CSS (border-spacing).',
  nowrap: 'Perquè el text no salti de línia, fes servir CSS (white-space: nowrap).',
  name: 'Per marcar un lloc on porti un enllaç, fes servir id.',
  type: 'Per canviar el pic o el número de la llista, fes servir CSS (list-style-type).',
  compact: 'Per a una llista més atapeïda, fes servir CSS (margin, padding).',
  scope: 'L\'atribut scope és per a les capçaleres <th>: si aquesta cel·la és una capçalera, canvia <td> per <th>.',
};

const columnes = (n) => (n === 1 ? '1 columna' : `${n} columnes`);

const FOSTER_HINT = 'El navegador l\'ha tret de la taula i l\'ha posat just abans. Dins d\'una taula, tot el contingut va dins de les cel·les <td> o <th>, o al títol, <caption>.';

const IMAGE_REASONS = {
  case: ({ src, suggestion }) => `Als noms dels fitxers, les majúscules compten: «${src}» i «${suggestion}» són fitxers diferents.`,
  extension: () => 'Fixa\'t en l\'extensió, el final del nom (.svg, .png, .jpg): ha de ser la del fitxer.',
  folder: ({ suggestion }) => (suggestion.includes('/')
    ? `La imatge és dins de la carpeta ${suggestion.slice(0, suggestion.lastIndexOf('/'))}: el nom de la carpeta va davant del del fitxer, amb una barra /.`
    : 'Aquesta imatge no és dins de cap carpeta: escriu només el nom del fitxer.'),
  typo: () => 'El nom ha de ser exactament el del fitxer, lletra per lletra.',
};

const VALUE_HINTS = {
  'catalan-colour': ({ fix }) => `Els noms dels colors s'escriuen en anglès: ${fix}.`,
  comma: ({ fix }) => `Els decimals s'escriuen amb punt, no amb coma: ${fix}.`,
  unit: ({ fix }) => `Els números necessiten una unitat (px, em, rem, %…), per exemple ${fix}. Només el 0 pot anar sense.`,
  generic: () => 'El navegador ignora tota la declaració. Revisa com s\'escriu el valor.',
};

export const MESSAGES = {
  // ── HTML: estructura ──
  'html/unclosed-element': ({ tag: name }) => ({
    text: `L'element ${tag(name)} no està tancat.`,
    hint: `Escriu </${name}> on s'acaba el seu contingut. El navegador l'ha tancat per tu, però potser no on volies.`,
  }),
  'html/stray-end-tag': ({ tag: name }) => ({
    text: `</${name}> no tanca res: no hi ha cap ${tag(name)} obert.`,
    hint: `Esborra'l, o obre el ${tag(name)} on toca. El navegador ho arregla a la seva manera, i potser no és el que volies.`,
  }),
  'html/mismatched-end-tag': ({ open, close }) => ({
    text: `Obres ${tag(open)} però el tanques amb </${close}>.`,
    hint: `L'etiqueta de tancament ha de tenir el mateix nom que la d'obertura: </${open}>.`,
  }),
  'html/misnested': ({ outer, inner }) => ({
    text: `${tag(outer)} i ${tag(inner)} estan encavalcats: tanques </${outer}> abans de </${inner}>.`,
    hint: `Tanca primer l'últim que has obert: ${tag(outer)}${tag(inner)}…</${inner}></${outer}>. El navegador ho ha arreglat afegint elements que tu no has escrit.`,
  }),
  'html/void-end-tag': ({ tag: name }) => ({
    text: `${tag(name)} no es tanca mai: </${name}> sobra.`,
    hint: `${tag(name)} és un element buit (no té contingut) i no té etiqueta de tancament. Esborra </${name}>.`,
  }),
  'html/p-closed-by-block': ({ tag: name }) => ({
    text: name === 'p'
      ? 'Un paràgraf no pot anar dins d\'un altre paràgraf.'
      : `Un ${tag(name)} no pot anar dins d'un paràgraf <p>.`,
    hint: `En trobar ${tag(name)}, el navegador ha tancat el <p> d'abans. Tanca el paràgraf amb </p> abans d'obrir ${tag(name)}.`,
  }),
  'html/duplicate-attribute': ({ tag: name, attr }) => ({
    text: `L'atribut ${attr} surt dues vegades a ${tag(name)}.`,
    hint: 'Deixa\'n només un: el navegador fa servir el primer i ignora els altres.',
  }),
  'html/unterminated-tag': ({ tag: name }) => ({
    text: `A l'etiqueta <${name} li falta el > del final.`,
    hint: 'Sense el >, el navegador llegeix el que ve després com si fos part de l\'etiqueta, i aquest text no es veu.',
  }),
  'html/unterminated-attribute-value': ({ attr }) => ({
    text: `Falta la cometa que tanca el valor de ${attr}.`,
    hint: `Els valors van entre cometes dobles: ${attr}="…". Sense la cometa de tancament, el navegador s'empassa el codi que ve després.`,
  }),
  'html/unclosed-comment': () => ({
    text: 'El comentari no està tancat: falta -->.',
    hint: 'Tot el que hi ha després de <!-- és comentari i no es veu, fins que escriguis -->.',
  }),

  // ── HTML: codi net ──
  'html/uppercase': ({ kind, name, end }) => ({
    text: kind === 'attr'
      ? `Escriu el nom de l'atribut en minúscules: ${name}.`
      : `Escriu el nom de l'etiqueta en minúscules: ${end ? `</${name}>` : tag(name)}.`,
    hint: 'Al navegador li és igual, però l\'HTML net s\'escriu sempre en minúscules.',
  }),
  'html/unquoted-attribute': ({ attr, value }) => ({
    text: `Posa el valor de ${attr} entre cometes: ${attr}="${value}".`,
    hint: 'Sense cometes funciona mentre el valor no tingui espais; amb cometes dobles funciona sempre i el codi és més clar.',
  }),
  'html/indentation': (data) => ({
    text: indentationText(data, data.close ? `L'etiqueta </${data.close}>` : 'Aquesta línia'),
    hint: data.tab ? TAB_HINT
      : data.close ? `L'etiqueta de tancament s'alinea amb la d'obertura (${tag(data.close)}, línia ${data.openLine}): així es veu d'un cop d'ull on comença i on acaba.`
        : INDENT_HINT_HTML,
  }),

  // ── HTML: document sencer ──
  'html/doctype': ({ kind }) => ({
    text: {
      missing: 'Falta <!DOCTYPE html> a la primera línia.',
      late: '<!DOCTYPE html> ha d\'anar al principi de tot.',
      old: 'Aquest doctype és antic: escriu només <!DOCTYPE html>.',
    }[kind],
    hint: kind === 'old'
      ? '<!DOCTYPE html> és el doctype de l\'HTML actual.'
      : 'Sense aquesta línia al principi, el navegador treballa en «mode antic» i alguns estils es veuen diferent.',
  }),
  'html/lang': ({ kind }) => ({
    text: kind === 'no-html' ? 'Falta l\'element <html lang="ca">.' : 'A <html> li falta l\'atribut lang.',
    hint: kind === 'no-html'
      ? 'Tota la pàgina va dins de <html lang="ca">…</html>.'
      : 'Escriu <html lang="ca">: així el navegador, els cercadors i els lectors de pantalla saben que la pàgina és en català.',
  }),
  'html/charset': ({ kind, value }) => ({
    text: kind === 'value'
      ? `La codificació ha de ser UTF-8, no «${value}».`
      : 'Falta <meta charset="UTF-8"> dins del <head>.',
    hint: 'Amb <meta charset="UTF-8">, les lletres com à, ç o l·l es veuen bé a tots els navegadors.',
  }),
  'html/title': ({ kind }) => ({
    text: kind === 'empty' ? 'El <title> és buit.' : 'Falta el <title> dins del <head>.',
    hint: 'El títol és el text de la pestanya del navegador i el que surt als cercadors.',
  }),

  // ── HTML: elements ──
  'html/unknown-element': ({ tag: name, suggestion }) => ({
    text: `L'element ${tag(name)} no existeix en HTML.`,
    hint: suggestion
      ? `Potser volies escriure ${tag(suggestion)}? El navegador l'accepta igualment, però no sap què vol dir.`
      : 'Revisa com s\'escriu. El navegador l\'accepta igualment, però no sap què vol dir.',
  }),
  'html/deprecated-element': ({ tag: name }) => ({
    text: `${tag(name)} és un element antic: ja no forma part de l'HTML.`,
    hint: DEPRECATED_INSTEAD[name] || 'L\'aspecte de la pàgina es controla amb CSS.',
  }),
  'html/heading-order': ({ from, to }) => ({
    text: `Passes de <h${from}> a <h${to}>: et saltes <h${from + 1}>.`,
    hint: `Els títols fan d'índex de la pàgina: després d'un <h${from}> ve un <h${from + 1}>. Si el vols més petit, la mida es canvia amb CSS.`,
  }),
  'html/single-h1': () => ({
    text: 'Hi ha més d\'un <h1> a la pàgina.',
    hint: 'El <h1> és el títol principal i només n\'hi ha d\'haver un. Per als apartats, fes servir <h2>.',
  }),
  'html/br-spacing': () => ({
    text: 'Fas servir diversos <br> seguits per separar.',
    hint: '<br> és per saltar de línia dins d\'un text (una adreça, un poema). Per separar blocs, comença un paràgraf <p> nou.',
  }),
  'html/list-structure': ({ kind, tag: name, list }) => ({
    text: {
      'li-outside': 'Un <li> ha d\'anar dins d\'una llista <ul> o <ol>.',
      'not-li': `Dins de ${tag(list)} només hi pot haver elements <li>, i hi ha un ${tag(name)}.`,
      text: `Dins de ${tag(list)} hi ha text fora de cap <li>.`,
    }[kind],
    hint: {
      'li-outside': 'Posa els <li> dins de <ul>…</ul> (llista amb pics) o d\'<ol>…</ol> (llista numerada).',
      'not-li': `Posa el ${tag(name)} dins d'un <li>.`,
      text: 'Cada element de la llista va dins de <li>…</li>.',
    }[kind],
  }),
  // ── HTML: enllaços ──
  'html/missing-href': ({ kind }) => ({
    text: kind === 'empty' ? 'L\'atribut href és buit.' : 'Aquest enllaç no té href: no porta enlloc.',
    hint: kind === 'empty'
      ? 'Escriu-hi l\'adreça o el fitxer on ha de portar l\'enllaç.'
      : 'Escriu on ha de portar: <a href="pagina.html">…</a>. Sense href, el navegador el mostra com a text normal i no es pot clicar.',
  }),
  'html/empty-link': () => ({
    text: 'Aquest enllaç no té cap text.',
    hint: 'Escriu entre <a> i </a> el text que es clica, i que digui on porta. Sense text, l\'enllaç no es veu.',
  }),
  'html/vague-link-text': ({ text }) => ({
    text: `«${text}» no diu on porta l'enllaç.`,
    hint: 'Escriu un text que s\'entengui tot sol, com «les fotos del refugi». Molta gent llegeix només els enllaços, i els lectors de pantalla els poden llegir tots seguits.',
  }),
  'html/missing-protocol': ({ href, fix }) => ({
    text: `A l'adreça «${href}» li falta https://.`,
    hint: `Sense https://, el navegador la llegeix com un fitxer del teu web. Escriu ${fix}.`,
  }),
  'html/duplicate-id': ({ id, firstLine }) => ({
    text: `L'id «${id}» ja surt a la línia ${firstLine}.`,
    hint: 'Cada id ha de ser únic a la pàgina: un enllaç a #… només pot portar a un lloc. Canvia\'n un.',
  }),
  'html/missing-anchor': ({ id, suggestion }) => ({
    text: `No hi ha cap element amb id="${id}".`,
    hint: suggestion
      ? `Potser volies dir #${suggestion}? Un enllaç a #… porta a l'element que té aquest id.`
      : `Posa id="${id}" a l'element on ha de portar l'enllaç, o corregeix el nom.`,
  }),
  // ── HTML: imatges i atributs ──
  'html/img-alt': () => ({
    text: 'A aquesta imatge li falta l\'atribut alt.',
    hint: 'Escriu a alt="…" què mostra la imatge: és el que llegeixen els lectors de pantalla i el que es veu si la imatge no es carrega. Si és només decorativa, posa-hi alt="".',
  }),
  'html/vague-alt': ({ alt, kind }) => ({
    text: kind === 'file'
      ? `L'alt «${alt}» és el nom del fitxer: no diu què es veu a la imatge.`
      : `L'alt «${alt}» no diu què es veu a la imatge.`,
    hint: 'Descriu-la com ho faries per telèfon, per exemple «Un gos marró que treu la llengua». Si és només decorativa, deixa-l\'hi buit: alt="".',
  }),
  'html/unknown-attribute': ({ attr, tag: name, suggestion, obsolete }) => ({
    text: `L'atribut ${attr} no existeix a ${tag(name)}.`,
    hint: suggestion
      ? `Potser volies escriure ${suggestion}? El navegador no fa cas dels atributs que no coneix.`
      : obsolete
        ? `És un atribut antic d'aspecte, i ${tag(name)} no el té. L'aspecte (colors, alineació, vores…) es controla amb CSS.`
        : 'Revisa com s\'escriu: el navegador no fa cas dels atributs que no coneix.',
  }),
  'html/obsolete-attribute': ({ attr, tag: name }) => ({
    text: `L'atribut ${attr} de ${tag(name)} és antic: ja no forma part de l'HTML.`,
    hint: OBSOLETE_ATTRIBUTE_INSTEAD[attr] || 'Esborra\'l. Si era per a l\'aspecte, fes servir CSS.',
  }),
  'html/img-size': ({ attr, value, kind, fix }) => ({
    text: {
      px: `${attr} s'escriu sense unitat: ${attr}="${fix}".`,
      percent: `${attr}="${value}": a l'HTML, la mida d'una imatge és un nombre de píxels.`,
      unit: `«${value}» no és una mida vàlida: ${attr} ha de ser un nombre enter de píxels, sense unitat.`,
      invalid: `«${value}» no és una mida: ${attr} ha de ser un nombre de píxels, com ${attr}="200".`,
    }[kind],
    hint: {
      px: 'Els atributs width i height sempre són en píxels i només porten el número. El navegador entén «px», però no és HTML correcte.',
      percent: `Els percentatges són cosa del CSS (${attr}: ${value}), que aprendràs més endavant. El navegador encara l'entén, però és HTML antic.`,
      unit: `El navegador només en llegeix el número del principi, i en píxels: «5cm» es converteix en 5 píxels. Escriu només el número de píxels: ${attr}="200".`,
      invalid: 'El navegador no entén el valor i no en fa cas.',
    }[kind],
  }),
  'html/image-not-found': ({ kind, src, suggestion, reason }) => ({
    text: {
      'no-src': 'Aquesta imatge no té src: no se sap quina imatge s\'ha de mostrar.',
      external: 'Les imatges d\'Internet no es mostren a HTMLCat.',
      computer: `«${src}» és un fitxer del teu ordinador: la pàgina no hi pot accedir.`,
      missing: `No s'ha trobat la imatge «${src}».`,
    }[kind],
    hint: {
      'no-src': 'Escriu a src="…" el nom del fitxer de la imatge, per exemple src="animals/gos.svg".',
      external: 'Per protegir la teva privacitat, el resultat no carrega res d\'Internet (en un web de debò, sí que es veuria). Fes servir una de les imatges del curs, com src="animals/gos.svg".',
      computer: 'Una pàgina web no pot agafar fitxers de l\'ordinador de qui la visita: les imatges han d\'estar al web, al costat de la pàgina. A HTMLCat, fes servir les imatges del curs, com src="animals/gos.svg".',
      missing: suggestion
        ? `Potser volies dir «${suggestion}»? ${IMAGE_REASONS[reason]({ src, suggestion })}`
        : 'Revisa el nom del fitxer, la carpeta i l\'extensió. Al capítol 5 hi ha la llista de les imatges que pots fer servir.',
    }[kind],
  }),
  // ── HTML: estructura de la pàgina ──
  'html/single-main': ({ kind, count, parent }) => ({
    text: {
      missing: 'Aquesta pàgina no té <main>.',
      several: `Hi ha ${count} elements <main>: només n'hi pot haver un.`,
      inside: `<main> no pot anar dins de ${tag(parent)}.`,
    }[kind],
    hint: {
      missing: 'Posa el contingut principal de la pàgina (el que la fa diferent de les altres) dins de <main>…</main>. Els lectors de pantalla hi poden saltar directament.',
      several: '<main> és el contingut principal i n\'hi ha un per pàgina. Per dividir-lo en parts, fes servir <section> o <article> a dins.',
      inside: '<main> va directament dins del <body>: és el contingut principal de tota la pàgina, no d\'una part.',
    }[kind],
  }),
  'html/head-in-body': () => ({
    text: 'El navegador no fa cas d\'aquest <head>: és dins del cos de la pàgina.',
    hint: '<head> és la informació sobre la pàgina (el títol, la codificació) i n\'hi ha un de sol, abans del <body>. Si volies la capçalera que es veu a dalt de la pàgina, l\'element és <header>.',
  }),
  'html/section-heading': ({ tag: name }) => ({
    text: `${name === 'article' ? 'Aquest' : 'Aquesta'} ${tag(name)} no té cap títol.`,
    hint: name === 'article'
      ? 'Un <article> s\'entén tot sol, i per això comença amb el seu títol (<h2>, <h3>…).'
      : 'Una <section> és una part del contingut amb el seu tema: comença-la amb un títol, com <h2>. Si només vols agrupar coses per donar-los estil, fes servir <div>.',
  }),
  'html/semantic-div': ({ attr, name, element }) => ({
    text: `Aquest <div ${attr}="${name}"> hauria de ser un ${tag(element)}.`,
    hint: `Fes servir ${tag(element)} en lloc de <div> (si vols, amb ${attr === 'class' ? 'la mateixa classe' : 'el mateix id'}). El navegador, els lectors de pantalla i els cercadors saben què és un ${tag(element)}; d'un <div>, no en saben res.`,
  }),
  // ── HTML: taules ──
  'html/table-structure': ({ kind, tag: name }) => ({
    text: {
      'row-outside': 'Aquesta fila <tr> no és dins de cap taula <table>.',
      'cell-no-row': `Aquesta cel·la ${tag(name)} no és dins de cap fila <tr>.`,
      'cell-outside': `Aquesta cel·la ${tag(name)} no és dins de cap taula.`,
      foster: `Aquest ${tag(name)} és dins de la taula, però fora de cap cel·la.`,
      'foster-text': 'Aquest text és dins de la taula, però fora de cap cel·la.',
    }[kind],
    hint: {
      'row-outside': 'Fora d\'una taula, el navegador no fa cas de les etiquetes <tr>, <td> i <th>: només en queda el text, tot seguit, com si fos un paràgraf. Posa les files dins de <table>…</table>.',
      'cell-no-row': 'Les cel·les van sempre dins d\'una fila: <tr><td>…</td></tr>. El navegador hi ha posat una fila pel seu compte, i potser no on volies.',
      'cell-outside': 'Fora d\'una taula, el navegador no fa cas de les etiquetes de les cel·les i el text queda solt. Posa-la dins d\'una fila <tr> d\'una taula <table>.',
      foster: FOSTER_HINT,
      'foster-text': FOSTER_HINT,
    }[kind],
  }),
  'html/table-columns': ({ columns, expected, firstLine }) => ({
    text: `Aquesta fila té ${columnes(columns)}, i la primera (línia ${firstLine}) en té ${expected}.`,
    hint: 'Totes les files d\'una taula han de tenir les mateixes columnes; si no, la taula queda desquadrada. Si una cel·la no té res, escriu-la igualment, buida: <td></td>.',
  }),
  'html/table-headers': () => ({
    text: 'Aquesta taula no té cap cel·la de capçalera <th>.',
    hint: 'Les capçaleres diuen què hi ha a cada columna (o a cada fila): escriu-les amb <th> en lloc de <td>. Si la taula només serveix per col·locar coses a la pàgina, no és una taula de dades: això es fa amb CSS.',
  }),
  'html/invalid-attribute-value': ({ attr, tag: name, value, values, suggestion }) => ({
    text: value
      ? `«${value}» no és un valor vàlid per a l'atribut ${attr}.`
      : `L'atribut ${attr} és buit.`,
    hint: (suggestion ? `Potser volies escriure ${attr}="${suggestion}"? ` : '') +
      (values.length > 10 ? `Alguns dels valors possibles: ${values.slice(0, 11).join(', ')}…` : `Els valors possibles són ${values.join(', ')}.`) +
      (name === 'input' && attr === 'type'
        ? ' El navegador no entén cap altre valor i en fa un camp de text normal.'
        : ' El navegador no entén cap altre valor i no en fa cas.'),
  }),
  'html/th-scope': () => ({
    text: 'Aquesta capçalera <th> no diu si és d\'una columna o d\'una fila.',
    hint: 'Afegeix-hi scope="col" (capçalera d\'una columna) o scope="row" (capçalera d\'una fila): així els lectors de pantalla saben a quina capçalera pertany cada cel·la.',
  }),
  // ── HTML: formularis ──
  'html/control-label': ({ kind, tag: name, id, suggestion }) => ({
    text: {
      missing: `Aquest camp ${tag(name)} no té cap etiqueta <label>.`,
      placeholder: 'Aquest camp només té un placeholder: li falta l\'etiqueta <label>.',
      'for-missing': id ? `L'etiqueta apunta a id="${id}", però no hi ha cap element amb aquest id.` : 'L\'atribut for de l\'etiqueta és buit.',
      'for-not-control': `L'etiqueta apunta a un ${tag(name)}, que no és cap camp del formulari.`,
    }[kind],
    hint: {
      missing: 'Escriu-li un <label for="…"> amb el mateix valor que l\'id del camp. Sense etiqueta, qui fa servir un lector de pantalla no sap què ha d\'escriure-hi, i clicar el text no porta al camp.',
      placeholder: 'El placeholder desapareix quan comences a escriure, i molts lectors de pantalla no el llegeixen: no és una etiqueta. Afegeix-hi un <label for="…">, i deixa el placeholder per a un exemple, si cal.',
      'for-missing': suggestion
        ? `Potser volies dir for="${suggestion}"? El for de l'etiqueta ha de ser igual que l'id del camp.`
        : 'El for de l\'etiqueta ha de ser igual que l\'id del camp: <label for="nom"> i <input id="nom">.',
      'for-not-control': 'Una etiqueta només va amb un camp (<input>, <select>, <textarea>…). Posa l\'id al camp, no a un altre element.',
    }[kind],
  }),
  'html/control-name': ({ tag: name, radio }) => ({
    text: `Aquest camp ${tag(name)} no té name.`,
    hint: radio
      ? 'Sense name, el navegador no sap que aquests botons d\'opció van junts: es poden marcar tots alhora, i la resposta no s\'envia. Posa el mateix name a tots els botons d\'una pregunta.'
      : 'Sense name, quan s\'envia el formulari la dada d\'aquest camp no s\'envia: el name és el nom amb què arriba la dada.',
  }),
  // ── HTML: fulls d'estil ──
  'html/stylesheet-link': ({ kind, href, suggestion, files = [], file }) => ({
    text: {
      'not-found': `No hi ha cap fitxer «${href}».`,
      external: 'Els fulls d\'estil d\'Internet no es carreguen a HTMLCat.',
      'no-rel': 'A aquest <link> li falta rel="stylesheet".',
      'no-href': 'A aquest <link> li falta href.',
      unlinked: `El fitxer ${file} no s'aplica a la pàgina: cap <link> no hi porta.`,
    }[kind],
    hint: {
      'not-found': suggestion
        ? `Potser volies dir «${suggestion}»? El nom ha de ser exactament el del fitxer. Sense el fitxer, la pàgina es veu sense estils.`
        : (files.length ? `Els fitxers de CSS d'aquí són: ${files.join(', ')}.` : 'En aquest simulador no hi ha cap fitxer de CSS.'),
      external: 'Per protegir la teva privacitat, el resultat no carrega res d\'Internet. Escriu els estils al fitxer de CSS del simulador.',
      'no-rel': 'Sense rel="stylesheet", el navegador no sap que el fitxer és un full d\'estil i no l\'aplica: <link rel="stylesheet" href="estils.css">.',
      'no-href': 'El href diu quin fitxer de CSS cal aplicar: <link rel="stylesheet" href="estils.css">.',
      unlinked: `Escriu <link rel="stylesheet" href="${file}"> dins del <head>. Sense aquesta línia, la pàgina es veu sense estils.`,
    }[kind],
  }),
  'html/inline-style': ({ tag: name }) => ({
    text: `L'atribut style de ${tag(name)} barreja l'estil amb el contingut.`,
    hint: 'Posa una classe a l\'element (class="…") i escriu les declaracions en una regla del fitxer CSS.',
  }),

  // ── CSS: errors ──
  'css/unbalanced-braces': ({ kind, selector }) => ({
    text: {
      'unclosed-block': `Falta la } que tanca la regla ${selector}.`,
      'unexpected-close-brace': 'Aquesta } no tanca res.',
      'missing-open-brace': `Falta la { després de ${selector}.`,
    }[kind],
    hint: {
      'unclosed-block': 'Cada { necessita la seva }. Sense ella, el navegador s\'empassa la regla següent.',
      'unexpected-close-brace': 'Sobra una clau de tancament: esborra-la, o comprova si falta una { abans.',
      'missing-open-brace': 'Una regla és selector { declaracions }. Sense la {, el navegador ignora tota la regla.',
    }[kind],
  }),
  'css/missing-semicolon': ({ next }) => ({
    text: `Falta el ; abans de ${next}.`,
    hint: 'Sense el punt i coma, el navegador llegeix les dues declaracions com si fossin una de sola, i les ignora totes dues.',
  }),
  'css/missing-colon': ({ text }) => ({
    text: `Falten els dos punts (:) a «${text}».`,
    hint: 'Cada declaració és propietat: valor; per exemple, color: teal;',
  }),
  'css/empty-value': ({ property }) => ({
    text: `${property} no té cap valor.`,
    hint: 'Escriu el valor després dels dos punts. Sense valor, el navegador ignora la declaració.',
  }),
  'css/unclosed-comment': () => ({
    text: 'El comentari no està tancat: falta */.',
    hint: 'Tot el que hi ha després de /* és comentari i el navegador no ho aplica, fins que escriguis */.',
  }),
  'css/unclosed-string': () => ({
    text: 'Falta la cometa que tanca aquest text.',
    hint: 'Un text entre cometes s\'ha de tancar a la mateixa línia, amb la mateixa cometa.',
  }),
  'css/unknown-property': ({ property, suggestion }) => ({
    text: `La propietat ${property} no existeix.`,
    hint: suggestion
      ? `Potser volies escriure ${suggestion}? El navegador ignora les propietats que no coneix.`
      : 'Revisa com s\'escriu: el navegador ignora les propietats que no coneix.',
  }),
  'css/invalid-value': (data) => ({
    text: `«${data.value}» no és un valor vàlid per a ${data.property}.`,
    hint: VALUE_HINTS[data.kind](data),
  }),

  'css/wrong-comment': ({ kind }) => ({
    text: kind === 'html' ? 'Al CSS, els comentaris no s\'escriuen amb <!-- -->.' : 'Al CSS, els comentaris no s\'escriuen amb //.',
    hint: kind === 'html'
      ? 'Escriu-los entre /* i */, així: /* Estils del títol */. El navegador no entén <!--: el text del comentari s\'enganxa a la regla següent, i aquesta regla deixa de funcionar.'
      : 'Escriu-los entre /* i */, així: /* vermell */. El navegador llegeix el // i el text que el segueix com si fossin codi, i la regla o la declaració següent deixa de funcionar.',
  }),
  'css/unknown-element-selector': ({ name, suggestion }) => ({
    text: `L'element <${name}> no existeix: aquesta regla no s'aplica a res.`,
    hint: (suggestion ? `Potser volies escriure ${suggestion}? ` : '') +
      'Un selector sense punt ni # davant és el nom d\'un element de l\'HTML (p, h1, body…). Si és el nom d\'una classe, porta un punt davant: .nom.',
  }),

  // ── CSS: codi net ──
  'css/last-semicolon': () => ({
    text: 'Posa ; també després de l\'última declaració.',
    hint: 'Si després hi afegeixes una línia i no te\'n recordes, les dues declaracions deixaran de funcionar.',
  }),
  'css/one-declaration-per-line': () => ({
    text: 'Hi ha més d\'una declaració en aquesta línia.',
    hint: 'Escriu cada declaració en una línia: el codi és més fàcil de llegir i de canviar.',
  }),
  'css/indentation': (data) => ({
    text: indentationText(data, data.close ? 'La }' : 'Aquesta línia'),
    hint: data.tab ? TAB_HINT : INDENT_HINT_CSS,
  }),
};

/**
 * @param {string} id
 * @param {Object} data
 * @returns {{ text: string, hint: string }}
 */
export function describe(id, data) {
  const message = MESSAGES[id];
  return message ? message(data) : { text: id, hint: '' };
}
