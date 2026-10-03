# HTMLCat — Estat actual del projecte

> **Font única de veritat.** Aquest document descriu l'estat real del projecte.
> Qualsevol canvi que modifiqui l'arquitectura, el comportament, el contingut
> del curs o les tasques pendents ha d'actualitzar aquest document **en el mateix
> commit**.
>
> **Regla d'or:** un document d'estat obsolet és més perillós que no tenir-ne.

Darrera actualització: 2026-10-02.

---

## 1. Visió general

**HTMLCat** és un curs interactiu per aprendre **HTML i CSS** i a escriure
**codi net i ben estructurat**, en català, adreçat a alumnes d'ESO (≈ 15 anys).
És un web estàtic «vanilla» (sense pas de compilació ni dependències) que es
publicarà a Cloudflare Pages des d'aquest repositori.

El disseny complet és a [`BLUEPRINT.md`](BLUEPRINT.md). Mentre una part no
estigui construïda, el BLUEPRINT n'és la referència; quan ja existeix, mana
aquest document (i el codi).

---

## 2. Què hi ha ara

**Fase actual: 3 (revisor de codi i panell ⚠ Problemes) acabada.** Hi ha
l'editor lliure a `/editor/` amb previsualització en directe i el panell
⚠ Problemes, que explica en català els errors i els hàbits poc nets del codi,
sobre els analitzadors d'HTML i CSS de la fase 1. Encara no hi ha cap capítol
(fase 4).

```
README.md              Presentació del projecte (per a persones)
CLAUDE.md              Normes per a les IA que hi treballin
LICENSE                Text de les dues llicències (CC BY-NC-SA 4.0 i MIT)
LLICENCIA.md           Explicació de la llicència en català
.editorconfig          UTF-8, LF, 2 espais
.gitignore             node_modules/
.github/workflows/ci.yml  Executa tots els tests a cada push i PR

HANDOFF.md             Traspàs per a una sessió nova de Claude (en anglès): on som i què toca
docs/STATE.md          Aquest document
docs/BLUEPRINT.md      Disseny inicial i lliçons apreses de PyCat i JSCat (en anglès)
docs/CURRICULUM.md     Pla de capítols i reptes (proposta)

site/                  ← l'única carpeta que es publica
  index.html           Portada provisional «En construcció»: dos exemples ressaltats
                       i un botó cap a l'editor lliure
  editor/index.html    Editor lliure (simulador a pantalla completa, clau code:editor)
  404.html             Pàgina d'error (Cloudflare la fa servir sola)
  _headers             Capçaleres de seguretat per a Cloudflare Pages
  LICENSE.txt          Còpia de LICENSE (el peu hi enllaça)
  recursos/            Paquet d'imatges per als alumnes (ara: gat.svg) + CREDITS.md
  img/logo.svg         Logotip (també és la icona de la pestanya)
  css/tokens.css       Variables de disseny (colors, espais, tipografies, ressaltat) i tema fosc
  css/base.css         Reinici, tipografia i estructura (.pagina, .pantalla, .barra, .peu, .avis, .logo, .boto)
  css/highlight.css    Colors del ressaltat (.hl-*) i blocs pre.code-example
  css/simulador.css    Simulador i editor (classes sim-*)
  js/util/text.js            Mòdul pur: normalizeNewlines, dedent, lineColAt, makeLineIndex
  js/util/storage.js         localStorage amb prefix htmlcat:v1: i sense errors (§2.5)
  js/i18n/ca.js              Tots els textos de la interfície: t(clau, paràmetres)
  js/lang/html-spec.js       Dades de l'HTML (elements buits, coneguts, obsolets…)
  js/lang/html-tokenizer.js  Mòdul pur: tokenitzador d'HTML amb posicions (§2.1)
  js/lang/html-model.js      Mòdul pur: arbre del codi font i errors d'estructura (§2.1)
  js/lang/css-parser.js      Mòdul pur: analitzador de CSS tolerant (§2.2)
  js/lang/css-spec.js        Propietats CSS habituals (per suggerir «potser volies dir…»)
  js/lint/lint.js            Mòdul pur: revisor de codi, lintStatic i summarize (§2.6)
  js/lint/rules-html.js      Mòdul pur: regles d'HTML (§2.6)
  js/lint/rules-css.js       Mòdul pur: regles de CSS (§2.6)
  js/lint/messages.ca.js     Mòdul pur: què diu cada regla, en català
  js/lint/lines.js           Mòdul pur: indentació de les línies (per a les regles d'indentació)
  js/lint/suggest.js         Mòdul pur: el nom vàlid més semblant («titel» → title)
  js/editor/highlight.js     Mòdul pur: ressaltat d'HTML i CSS (§2.3)
  js/editor/editing.js       Mòdul pur: què fan Retorn, Tab i Maj+Tab
  js/editor/editor.js        Editor: textarea sobre un <pre> ressaltat, números de línia, marques
  js/preview/srcdoc.js       Mòdul pur: document de la previsualització (§2.4)
  js/preview/preview.js      Iframe de previsualització protegit (§2.4)
  js/sim/simulador.js        Component simulador: pestanyes, editors, resultat, desar (§2.4)
  js/sim/problems-panel.js   Panell ⚠ Problemes del simulador (§2.4)
  js/pages/landing-page.js   Punt d'entrada de la portada (ressalta els exemples)
  js/pages/editor-page.js    Punt d'entrada de l'editor lliure

tests/
  package.json         Només Playwright (versió fixada), per als tests
  package-lock.json
  unit/*.test.mjs      Tests unitaris dels mòduls purs (node:test)
  course-static.mjs    Comprovacions estàtiques de site/ (sense dependències)
  course-browser.mjs   Comprovacions amb Chromium a 360 i 1280 px + editor de punta a punta
```

Estructura completa prevista: BLUEPRINT §4.1.

### 2.1 HTML: `tokenizeHtml(src)` i `buildSourceTree(src)`

- Els tokens cobreixen tot el codi, sense forats: `doctype`, `comment`,
  `startTag` (amb `attrs`), `endTag`, `text` (`raw: true` dins de `<style>`,
  `<script>`, `<title>` i `<textarea>`). Cada token té `start`, `end`
  (exclusiu, en unitats UTF-16 com `textarea.selectionStart`), `line` i `col`
  (començant per 1). Detall a la capçalera de `html-tokenizer.js`.
- `buildSourceTree` retorna l'arbre que l'alumne ha escrit (no el que construeix
  el navegador) i la llista de problemes `{ code, start, end, line, col, data }`:

| `code` | Exemple | `data` |
|---|---|---|
| `unclosed-element` | `<p>Hola` sense `</p>`; `<li>` abans d'un altre `<li>` | `tag` |
| `stray-end-tag` | `</span>` sense cap `<span>` obert | `tag` |
| `mismatched-end-tag` | `<h1>Hola</h2>`, o a la mateixa línia `<em>…</strong>` | `open`, `close` |
| `misnested` | `<b><i>…</b></i>` | `outer`, `inner` |
| `void-end-tag` | `</br>`, `</img>` | `tag` |
| `p-closed-by-block` | `<p>…<ul>` (el navegador tanca el `<p>`) | `tag` |
| `duplicate-attribute` | `<p class="a" class="b">` | `tag`, `attr` |
| `unclosed-comment` | `<!--` sense `-->` | — |
| `unterminated-tag` | `<p class="a"` sense `>` | `tag` |
| `unterminated-attribute-value` | `<img src="gat.png>` | `attr` |

### 2.2 CSS: `parseCss(src)`

Retorna `{ rules, comments, problems, segments }` (format a la capçalera de
`css-parser.js`). Si falta la `}` d'una regla i en comença una altra, tanca la
primera i continua (millor diagnòstic que el navegador). Codis de problema:
`unclosed-block`, `unexpected-close-brace`, `missing-open-brace`, `missing-colon`,
`empty-value`, `missing-semicolon` (entre dues declaracions), `unclosed-comment`,
`unclosed-string`. Una última declaració sense `;` és vàlida: es marca amb
`semicolon: false` perquè el revisor de codi (fase 3) ho pugui avisar.

### 2.3 Ressaltat: `highlightLines(src, lang)` / `highlight(src, lang)`

Fa servir els mateixos analitzadors (el que es pinta i el que es revisa
coincideixen); el CSS de dins de `<style>` també es ressalta. Escapa tot el
text, retorna una cadena per línia i cap `<span>` no travessa un salt de línia.
Classes `hl-*`; colors a `highlight.css` i `tokens.css` (contrast mínim 4,87:1
en tema clar i 5,62:1 en fosc). Rendiment mesurat amb 300 línies: HTML ≈ 4,6 ms
i CSS ≈ 3,3 ms (anàlisi + ressaltat).

### 2.4 Simulador, editor i previsualització

**Marcatge** (llegit per `readDefinition` de `sim/simulador.js`):

```html
<div class="simulador" data-id="c03-llista" data-mode="fragment">
  <script type="text/plain" data-file="index.html">
    <ul>
      <li>Pomes</li>
    </ul>
  </script>
  <script type="text/plain" data-file="estils.css" data-readonly>
    li { color: teal; }
  </script>
</div>
```

| Atribut | Efecte |
|---|---|
| `data-id` | Clau per desar el codi (`code:<data-id>`). Obligatori si és editable; estable per sempre |
| `data-mode` | `fragment` (per defecte: l'alumne escriu el contingut del `<body>`) o `document` (document sencer) |
| `data-readonly` | Al simulador: exemple no editable. A un bloc `data-file`: només aquell fitxer |
| `data-forms` | Permet enviar formularis (es mostren les dades, no s'envien) |

Encara no implementats (fase 4 i següents): `data-goal-id`, `data-checks`,
`data-height`, `data-panel`, pantalla completa i autocompletat.

**Panell ⚠ Problemes** (`sim/problems-panel.js`): sota l'editor i el resultat,
mostra el que troba el revisor de codi (§2.6) 400 ms després que l'alumne
deixi d'escriure, i també en muntar el simulador. Com a molt 10 entrades,
primer els errors; cada entrada diu la gravetat, el fitxer i la línia, el text,
la pista (💡) i, en petit, l'id de la regla. Clicar-la (o prémer Retorn) obre
la pestanya del fitxer i porta el cursor a la línia. Les línies amb errors o
avisos es marquen a l'editor (vermell, ambre). Només la línia d'estat curta
(«2 errors, 1 avís») és `aria-live`. `mountSimulator(el, { chapter })`: el
revisor només aplica les regles fins a aquest capítol; sense (editor lliure),
totes. Colors de gravetat: `--color-error`, `--color-warning`, `--color-info`
a `tokens.css` (contrast ≥ 5,8:1 en els dos temes).

**Previsualització** (`preview/preview.js` + `preview/srcdoc.js`): dues
proteccions independents, que el test de navegador comprova per separat:

1. `<iframe sandbox="allow-same-origin">` (+ `allow-forms` amb `data-forms`):
   el codi de l'alumne no pot executar res i el curs pot llegir-ne el DOM i
   els estils. **Mai `allow-scripts`.**
2. Una CSP injectada al principi del `<head>`:
   `default-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; media-src 'self'`
   (bloqueja scripts i qualsevol petició externa: decisió D5). En mode
   `document` s'injecta just després del doctype (o al principi), no després
   del `<head>` de l'alumne: si l'alumne escriu alguna cosa abans de `<html>`,
   el navegador posaria la CSP dins del `<body>` i l'ignoraria.

També s'hi injecta `<base href=".../recursos/">`: `<img src="gat.svg">`
funciona igual a l'editor lliure i als capítols. En mode `document`, cada
`<link rel="stylesheet" href="estils.css">` que apunta a un fitxer virtual es
substitueix pel seu CSS; si el fitxer no existeix, el simulador ho avisa. Els
clics als enllaços i els enviaments de formularis s'intercepten: la
previsualització no navega mai enlloc.

**Editor** (`editor/editor.js`): Retorn manté la indentació i n'afegeix un
nivell després d'una etiqueta d'obertura o d'una `{`; Tab i Maj+Tab indenten i
desindenten (2 espais, també blocs de línies); Esc i després Tab surt de
l'editor; tot es pot desfer amb Ctrl+Z (`editText`). Lletra de 16 px perquè
Safari de l'iPhone no faci zoom.

### 2.5 Dades desades (`localStorage`)

| Clau | Contingut |
|---|---|
| `htmlcat:v1:code:<data-id>` | `{ files: { 'index.html': …, 'estils.css': … }, savedAt }` |
| `htmlcat:v1:code:editor` | El mateix, per a l'editor lliure |

Si el navegador no deixa desar, el simulador ho avisa una vegada.

### 2.6 Revisor de codi: `lintStatic({ files, mode, chapter, env })`

«El navegador perdona, HTMLCat t'ho explica.» Revisa els fitxers de l'alumne
(HTML i CSS, també el CSS de dins dels `<style>`) i retorna una llista de
problemes ordenada (errors, avisos, suggeriments; després per fitxer i línia):
`{ file, rule, severity, start, end, line, col, data, text, hint }`. `text` i
`hint` són en català (`messages.ca.js`): què passa i com arreglar-ho.

- **Per capítol:** una regla només s'activa des del capítol on s'ensenya el
  concepte (`since <= chapter`). Sense `chapter` (editor lliure), totes.
- **Per mode:** les regles de document sencer (`html/doctype`, `lang`,
  `charset`, `title`) només en mode `document`.
- **`env.supports(propietat, valor)`:** al navegador és `CSS.supports` (el
  navegador mateix diu què és vàlid); als tests, una imitació
  (`tests/unit/lint-helpers.mjs`). Sense, les regles de propietats i valors no fan res.
- **Indentació:** només es revisen les línies que comencen amb una etiqueta, un
  comentari, un selector, una declaració o una `}`, sempre respecte a la línia
  del pare tal com és (un error no se n'emporta d'altres). Si hi ha errors
  d'estructura (HTML) o claus desaparellades (CSS), no es revisa: primer cal
  arreglar els errors. El contingut de `<pre>` no es revisa mai.
- **`summarize(problems, max = 10)`** prepara la llista per al panell: els errors
  d'un en un; els avisos repetits (mateixa regla i fitxer) en una sola entrada
  («i 4 més com aquest»).
- Rendiment mesurat (Node, 300 línies): HTML ≈ 3,6 ms i CSS ≈ 1 ms.

Catàleg (E error, A avís). «Cap.» = capítol a partir del qual s'activa.

| Regla | Cap. | | Detecta |
|---|---|---|---|
| `html/unclosed-element` | 1 | E | Element que no es tanca (també `<li>` abans d'un altre `<li>`) |
| `html/stray-end-tag` | 1 | E | `</x>` sense cap `<x>` obert |
| `html/mismatched-end-tag` | 1 | E | `<h1>…</h2>` |
| `html/misnested` | 1 | E | `<b><i>…</b></i>` |
| `html/void-end-tag` | 1 | E | `</br>`, `</img>` |
| `html/p-closed-by-block` | 1 | E | Un bloc dins de `<p>` (el navegador tanca el `<p>`) |
| `html/duplicate-attribute` | 1 | E | El mateix atribut dues vegades |
| `html/unterminated-tag` | 1 | E | Etiqueta sense `>` |
| `html/unterminated-attribute-value` | 1 | E | Valor d'atribut sense la cometa de tancament |
| `html/unknown-element` | 1 | E | `<titel>`, `<parragraf>` (suggereix el nom correcte) |
| `html/uppercase` | 1 | A | Etiquetes o atributs en majúscules (no a l'SVG) |
| `html/unquoted-attribute` | 1 | A | `class=avis` |
| `html/indentation` | 1 | A | La indentació no reflecteix el niuament (2 espais), o tabuladors |
| `html/doctype` | 1 | E | Falta `<!DOCTYPE html>`, no és el primer o és antic (mode document) |
| `html/title` | 1 | E | Falta `<title>` o és buit (mode document) |
| `html/lang` | 1 | A | Falta `<html lang="…">` (mode document) |
| `html/charset` | 1 | A | Falta `<meta charset="UTF-8">` o no és UTF-8 (mode document) |
| `html/unclosed-comment` | 2 | E | `<!--` sense `-->` |
| `html/deprecated-element` | 2 | A | `<center>`, `<font>`, `<big>`… |
| `html/heading-order` | 2 | A | De `<h1>` a `<h3>` sense `<h2>` |
| `html/single-h1` | 2 | A | Més d'un `<h1>` |
| `html/br-spacing` | 2 | A | Dos o més `<br>` seguits |
| `html/list-structure` | 3 | E | `<li>` fora de llista; text o altres elements dins de `<ul>`/`<ol>` |
| `html/inline-style` | 9 | A | Atribut `style=""` |
| `css/unbalanced-braces` | 9 | E | Falta `{` o `}`, o sobra una `}` |
| `css/missing-semicolon` | 9 | E | Falta `;` entre dues declaracions |
| `css/missing-colon` | 9 | E | `color red;` |
| `css/empty-value` | 9 | E | `color: ;` |
| `css/unclosed-comment` | 9 | E | `/*` sense `*/` |
| `css/unclosed-string` | 9 | E | Cadena sense la cometa de tancament |
| `css/unknown-property` | 9 | E | `colr`, `color-de-fons` (suggereix el nom correcte) |
| `css/invalid-value` | 9 | E | Valor no vàlid; missatges propis per a color en català, coma decimal i número sense unitat |
| `css/last-semicolon` | 9 | A | L'última declaració sense `;` |
| `css/one-declaration-per-line` | 9 | A | Dues declaracions a la mateixa línia |
| `css/indentation` | 9 | A | Declaracions no indentades 2 espais, `}` mal alineada (no als `<style>`) |

Les regles que necessiten el document ja pintat (enllaç a un `#id` que no
existeix, imatge no trobada, selector que no selecciona res, contrast) i les dels
capítols 4–14 s'afegiran amb cada capítol (BLUEPRINT apèndix C).

---

## 3. Decisions preses

Decisions de base adoptades amb el BLUEPRINT (2026-10-02). No es desfan sense
motiu; si se'n canvia alguna, s'anota aquí amb la data i el motiu.

| Data | Decisió | Motiu |
|---|---|---|
| 2026-10-02 | HTML, CSS i JS «vanilla», sense pas de compilació ni dependències en temps d'execució | Coherència amb la sèrie; es pot provar amb `python3 -m http.server` |
| 2026-10-02 | Mòduls ES natius, sense objecte global | Dependències explícites; els mòduls purs es poden provar amb Node |
| 2026-10-02 | Només es publica `site/` | Les solucions i els tests no han de ser públics |
| 2026-10-02 | Previsualització en un `<iframe sandbox="allow-same-origin">` amb `srcdoc`, mai amb `allow-scripts` | El codi de l'alumne no pot executar res i el curs pot llegir el resultat (comprovat a Chromium, BLUEPRINT apèndix A) |
| 2026-10-02 | Codi inicial dels exercicis en blocs `<script type="text/plain">` | Conserven el codi exactament; `<template>` i els atributs no ho fan |
| 2026-10-02 | Llicència: contingut CC BY-NC-SA 4.0, codi MIT (igual que PyCat) | Coherència amb la sèrie |
| 2026-10-02 | Sense *service worker* ni capçaleres COOP/COEP | Lliçons de PyCat (BLUEPRINT §3.2, A14 i A15) |
| 2026-10-02 | D1: editor lliure a `/editor/`; la portada `/` serà la del curs | Opció recomanada; el propietari va dir «endavant» |
| 2026-10-02 | D2: el fitxer CSS dels exercicis es diu `estils.css` | Ídem |
| 2026-10-02 | D5: la previsualització bloqueja imatges i fonts externes (CSP); imatges a `site/recursos/` | Privacitat dels alumnes i tests deterministes |
| 2026-10-02 | `buildSrcdoc` retorna `{ html, missingFiles }` (el BLUEPRINT deia només el text) | Per poder avisar d'un `<link>` a un fitxer que no existeix |
| 2026-10-02 | En mode `document`, la CSP i el `<base>` s'injecten just després del doctype (abans: després del `<head>` de l'alumne) | Amb text abans de `<html>` la CSP quedava dins del `<body>`, el navegador la ignorava i les imatges externes es carregaven (comprovat a Chromium) |
| 2026-10-02 | Sense autocompletat de moment | Ha de ser progressiu (només el que ja s'ha ensenyat) i depèn del vocabulari del curs (fase 4) |
| 2026-10-02 | Revisor de codi: `html/p-closed-by-block` i `html/unknown-element` des del capítol 1 (el BLUEPRINT deia 2) | Al capítol 1 ja s'ensenyen `<p>` i `<h1>` (un títol dins d'un paràgraf és un error típic) i els noms d'etiqueta mal escrits són habituals des del primer dia |
| 2026-10-02 | Revisor de codi: regles noves que el BLUEPRINT no tenia (`html/mismatched-end-tag`, `unterminated-tag`, `unterminated-attribute-value`, `unclosed-comment`; `css/missing-colon`, `empty-value`, `unclosed-comment`, `unclosed-string`, `last-semicolon`) | Els analitzadors ja detectaven aquests errors; `css/last-semicolon` (avís) ensenya a posar `;` sempre, que evita l'error `css/missing-semicolon` |
| 2026-10-02 | Panell ⚠ Problemes: els errors es mostren tots; els avisos repetits s'agrupen | Cada error és diferent i important; els avisos d'estil (sobretot d'indentació) podrien omplir la llista |
| 2026-10-02 | El repositori definitiu és `step-quiz2/htmlcat2` | Ho ha confirmat el propietari. L'historial de les fases 0–2 (PR #1–#4) és a l'antic repositori; el codi es va copiar aquí amb una pujada pel web, que va perdre `.github/`, `.editorconfig` i `.gitignore` (restaurats amb Git el mateix dia) |

### Decisions confirmades pel propietari el 2026-10-03

El propietari va acceptar totes les opcions recomanades (BLUEPRINT §11).

| Id | Decisió | Estat |
|---|---|---|
| D3 | El cap. 1 ensenya l'esquelet (exercici en mode `document`); caps. 2–5, fragments; des del cap. 6, documents complets | Aplicada al cap. 1 |
| D4 | L'editor no tanca les etiquetes sol (cal aprendre a tancar-les); correcció ràpida des del cap. 4 | Correcció ràpida: fase 6 |
| D6 | Tema clar per defecte; fosc segons el sistema i amb un botó | Fet el tema segons el sistema; el botó, fase 7 |
| D7 | Space Mono per al codi i una sense serifa per al text, servides des del mateix web | Pendent (fase 7); ara, lletres del sistema |
| D8 | Domini `htmlcat.step-quiz.net` | Pendent de configurar a Cloudflare (§5) |
| D9 | Currículum: els 15 capítols i 12 reptes de [`CURRICULUM.md`](CURRICULUM.md) | Confirmat |
| D10 | HTMLCat abans de la part B de JSCat; enllaços en tots dos sentits | Enllaços quan els dos cursos els tinguin |
| D11 | Identificadors del motor en anglès, comentaris en català | Aplicada |
| D12 | Classes i ids que s'ensenyen: català en minúscules, sense accents, amb guions (`menu-principal`) | Aplicada |

---

## 4. Tests

Des de l'arrel del projecte:

```bash
node --test tests/unit/*.test.mjs     # tests unitaris (sense dependències)
node tests/course-static.mjs          # comprovacions estàtiques de site/ (sense dependències)
cd tests && npm ci && node course-browser.mjs   # navegador (Playwright + Chromium)
```

(Al contenidor de Claude Code al núvol Chromium ja hi és: no cal
`npx playwright install`. En un Codespace o a GitHub sí que cal.)

| Test | Què comprova |
|---|---|
| `unit/` | Cada mòdul pur de `site/js/` (152 tests): tokenitzador, arbre i errors d'estructura, analitzador de CSS, ressaltat (conserva el codi, escapa, una línia per entrada, rendiment), robustesa amb 500 codis aleatoris (també el revisor), edició (Retorn, Tab, Maj+Tab), `localStorage`, document de previsualització, textos de la interfície i revisor de codi: per a cada regla, un codi que la dispara i un que no (un test falla si una regla no en té), missatges sense buits, activació per capítol i mode, ordre, agrupació, rendiment, i que el codi d'exemple de l'editor lliure i de la portada no tingui cap problema |
| `course-static.mjs` | Cada pàgina té `<!DOCTYPE html>`, `lang="ca"`, `charset` i `<title>`; cap `style=""` ni `on…=""`; cap tabulació; tots els enllaços relatius existeixen; sintaxi de cada `.js`; cap menció de CC BY-NC-ND; existeixen `.editorconfig`, `.gitignore` i `.github/workflows/ci.yml` (una pujada pel web no els inclou) |
| `course-browser.mjs` | Cada pàgina, a 360 i 1280 px: cap error a la consola, cap petició fallida, cap petició a servidors externs, cap desplaçament horitzontal, cap id repetit. Dos exemples no editables a la mateixa pàgina no repeteixen els ids de les pestanyes. A més, prova l'editor lliure de punta a punta: escriure, indentació automàtica, resultat en directe, Ctrl+Z, `sandbox` i CSP correctes (també amb text abans de `<html>`), cap script ni imatge externa, enllaços interceptats, CSS aplicat i codi desat després de recarregar. I el panell ⚠ Problemes: «Cap problema» amb el codi inicial, un `<p>` sense tancar surt amb la seva línia i es marca, el clic i el teclat porten el cursor a la línia (i canvien de pestanya), i una propietat CSS mal escrita es detecta amb el `CSS.supports` del navegador |

La GitHub Action `.github/workflows/ci.yml` executa els tres a cada push i a
cada pull request (pestanya «Actions» de GitHub).

---

## 5. Publicació

Cloudflare Pages (projecte `htmlcat`, adreça `htmlcat.pages.dev`) estava
connectat a l'antic repositori. **Pendent:** comprovar que publica aquest
(`step-quiz2/htmlcat2`), la branca `main`, i que fa una previsualització de
cada PR. Configuració esperada: *framework preset* «None», ordre de compilació
buida, carpeta de sortida `site`. També pendent: comprovar que `/tests/` i
`/docs/` donen la pàgina 404 i afegir el domini `htmlcat.step-quiz.net` (D8).

`site/_headers` afegeix `X-Content-Type-Options`, `Referrer-Policy` i
`Permissions-Policy`. **No** s'hi han de posar COOP/COEP (BLUEPRINT §3.2, A15)
ni capçaleres de memòria cau llarga.

---

## 6. Tasques pendents

Fases del BLUEPRINT §9.1:

- [ ] **Fase 0 — Arrencada.** Fet: documentació, llicència, `site/` provisional,
      tests i GitHub Action. Falta: comprovar que Cloudflare Pages publica
      `step-quiz2/htmlcat2` (§5), que `/tests/` i `/docs/` donen 404 i el
      domini `htmlcat.step-quiz.net`.
- [x] Respondre les decisions pendents (§3): acceptades les recomanades (2026-10-03).
- [x] **Fase 1 — Nucli del llenguatge:** tokenitzador d'HTML, analitzador de CSS, arbre del codi font, ressaltat.
- [x] **Fase 2 — Editor, previsualització i editor lliure.**
- [x] **Fase 3 — Revisor de codi v1 i panell ⚠ Problemes** (35 regles fins al capítol 9, §2.6).
      Queda per a més endavant: les regles que necessiten el document pintat (fase 4 i
      capítols 4, 5, 10 i 11), les dels capítols 4–14 (amb cada capítol) i les correccions
      ràpides (fase 6). L'arbre del codi font encara no entén `<circle />` dins d'`<svg>`.
- [ ] **Fase 4 — Primer capítol complet** (esquelet del curs, progrés, comprovacions, tests).
- [ ] **Fase 5 — Continguts:** un capítol per PR.
- [ ] **Fase 6 — Activitats i eines:** Parsons, qüestionaris, 🌳 Arbre, exportar/importar el progrés.
- [ ] **Fase 7 — Acabats:** portada amb progrés, glossari, accessibilitat, guia del professorat.
