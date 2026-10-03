# HTMLCat — Build Blueprint (cold-start brief for Claude)

> **Audience:** a Claude instance that starts with zero context in the new `step-quiz/htmlcat` repository. *(Note 2026-10-02: the canonical repository is now `step-quiz2/htmlcat2`; see `docs/STATE.md` §3.)*
> **Origin:** written on 2026-10-02 after a full code review of `step-quiz/pycat` (HEAD `4af142f`) and `step-quiz/jscat` (HEAD `9c328c1`), plus browser experiments in Chromium (Appendix A).
> **Lifetime:** this is a *kickoff* document. `docs/STATE.md` is the single source of truth for *what exists*; this file is the design reference for what is not built yet, and the rationale (*why*) for what is. When a decision here is reversed, record it in `docs/STATE.md` §Decisions and add a one-line note next to the affected section here. Never let this file silently rot (see §3.2, anti-pattern A1).

---

## 0. TL;DR — read this if you read nothing else

1. **HTMLCat** is the next course of the *Cat family (KarelCat → PyCat → JSCat). It teaches **HTML + CSS and clean, well-structured code** to 15-year-olds, in **Catalan**, as a **100 % static, vanilla, build-free** site deployed to **Cloudflare Pages** from GitHub.
2. **The browser never reports HTML/CSS errors — it silently repairs them.** HTMLCat's core value is to make the invisible visible:
   - a **Catalan linter** with line-precise explanations and hints (HTMLCat's equivalent of PyCat's `js/errors.js`);
   - a **🌳 DOM tree view** that shows what the browser actually built (HTMLCat's equivalent of PyCat's "👣 Pas a pas");
   - **declarative exercise checks** evaluated against the real rendered DOM and computed styles.
3. **The architecture deliberately differs from PyCat/JSCat.** There is no "simulator page loaded in an iframe and configured through base64 URL parameters". The simulator is an **ES-module component mounted directly in the page**; only the *preview* is an iframe: `<iframe sandbox="allow-same-origin" srcdoc="…">`. Student code cannot execute any script, and the parent page can inspect the preview's DOM, CSSOM and computed styles. Verified in Chromium (Appendix A).
4. **Starter code is authored in `<script type="text/plain">` blocks** (byte-for-byte verbatim), never inside HTML attributes and never in `<template>` (which silently "repairs" the student's HTML — Appendix A).
5. **Reuse** PyCat's pedagogy, course-data model, page-shell injection, progress model, editor technique and test philosophy. **Avoid** doc drift, web-UI uploads, copy-fork drift, globals and inline handlers, code in attributes, index- or URL-derived identities, inline styles, hidden-content flags, service workers, COOP/COEP headers, and publicly deploying tests/solutions.
6. **Tests from day 1:** zero-dependency Node unit tests and static course checks; Playwright browser checks in CI. Invariants: *reference solution passes, starter code fails, ids are unique, data is consistent*.
7. **Workflow:** small branch → descriptive commits → push → **Claude opens the PR automatically** → the owner merges on GitHub → Cloudflare deploys. **Never** write `[skip ci]`, `[ci skip]` or `[cf-pages-skip]` in any commit message (Cloudflare Pages would not deploy that commit).

---

## 1. Context

### 1.1 The family

| Project | Runtime | Right-hand panel | Validation | Status |
|---|---|---|---|---|
| KarelCat | Custom JS interpreter (tokenizer → parser → generators) | Grid world | Final grid state | Published |
| PyCat | CPython 3.12 via Pyodide 0.27.7 in a Web Worker | Console (+ turtle canvas) | stdout vs expected, `data-requires`, `data-testcode` | Published, 13 chapters, 15 reptes, Python test script (its CI workflow is documented but missing) |
| JSCat | `eval` in a Web Worker (console mode) / sandboxed iframe (DOM mode) | Console, or live page + small console | stdout vs expected | 12 chapters written, only 1–10 visible (flags); reptes 2–13 not written; no tests |
| **HTMLCat** | **None: the browser renders the student's document** | **Live preview + Problems + Checks + DOM tree** | **Declarative checks on rendered DOM/CSSOM + source lint** | **To build** |

All sites live under `*.step-quiz.net`. Material by **David Arso Civil** for the Maths Department of **INS Miquel Tarradell**. Licence: content **CC BY-NC-SA 4.0**, code **MIT** (copy `LICENSE` and `LLICENCIA.md` from PyCat verbatim, and the README attribution block delimited by `<!-- atribucio-centre:inici -->` / `<!-- atribucio-centre:final -->`; keep those markers intact).

### 1.2 Audience and learning goals

- Students aged ~15 (3r–4t ESO). No prior HTML/CSS. Some will have done KarelCat/PyCat.
- By the end, a student can:
  1. explain the difference between **structure/meaning (HTML)** and **presentation (CSS)**;
  2. write a **valid, semantic, accessible** HTML document from scratch;
  3. style it with an **external stylesheet**, using selectors, the cascade, the box model and flexbox;
  4. apply **clean-code habits**: indentation that mirrors nesting, meaningful names, separation of concerns, consistency, no repetition, useful comments;
  5. read a linter message, locate the line and fix it without help.
- Position in the family: HTMLCat teaches selectors and the DOM tree, which JSCat Part B (chapters 9–12) assumes. Cross-link both courses once HTMLCat exists.

### 1.3 Owner profile and working agreement (applies to every session)

- Talk to the owner **in Catalan**. (This document is in English because it is for you.)
- The owner is a mathematics graduate and secondary-school teacher who programs in C and understands algorithm design; HTML/CSS/JS level ≈ 4/10; **limited experience with Git, GitHub and Codespaces**.
- Whenever the owner must do something (Git, Codespaces, Cloudflare settings, merging), give **numbered steps with copy-paste blocks**, and say what each command does.
- **Claude creates the pull request automatically** after pushing. The owner reviews and merges from github.com.
- Cloudflare Pages does **not** deploy commits whose message contains `[skip ci]`, `[ci skip]` or `[cf-pages-skip]`. Never use these tokens — not in your commits, not in commits made by GitHub workflows.
- The owner protects 23:00–07:00 as rest time. Do not schedule reminders, check-ins or "do this tonight" requests in that window.

---

## 2. Non-negotiable constraints

1. **Static and vanilla.** HTML, CSS and JavaScript only. No framework, no bundler, no transpiler, no build step, no runtime dependencies, no CDN scripts. The deployed site must work when served by `python3 -m http.server` from `site/`.
2. **Native ES modules** (`<script type="module">`), no global namespace object. (PyCat's own `TODO.md` lists "migrate to ES modules" as future work; start there instead of migrating later.)
3. **Catalan** for everything the student sees: UI, prose, messages, hints, example class names/ids/text. HTML/CSS keywords stay as they are.
4. **Students never write JavaScript in HTMLCat.** The preview never runs scripts.
5. **Privacy by default** (users are minors): no analytics, no cookies, no third-party requests at all (self-host fonts and images), no accounts, no server.
6. **Works on a 360 px wide phone** and on school desktops; no horizontal page scroll; keyboard-operable; WCAG 2.2 AA contrast.
7. **One source of truth** for each fact: course data, vocabulary, UI strings, design tokens, project state.
8. **Tests and CI exist before content** (Phase 0), and every PR keeps them green.

---

## 3. What PyCat and JSCat teach us

### 3.1 Keep (and how to adapt it)

| # | What | Where it lives today | How HTMLCat uses it |
|---|---|---|---|
| K1 | Pedagogy: *show, then tell*; every concept first as a runnable example; one concept per simulator; "Errors típics" section; one validated "Exercici" per chapter; "Resum" bullet list; warm 2nd-person-singular Catalan; Catalan identifiers in examples | `pycat/PYCAT-CURRICULUM-PLAN.md` §3–§4 | Same rules (§5.5). Example class names, ids and texts in Catalan. |
| K2 | Single course-data array; sidebar, index cards and prev/next navigation computed from it | `pycat/curs/capitols.js` (`CAPITOLS_DATA`, `REPTES_DATA`, `_chapterNavLinks`) | `site/js/course/data.js` exports the arrays; nothing else hard-codes chapter lists or nav links. |
| K3 | Page shell injected at runtime: each page contains only its `<main>` and declares itself with `<body data-pagina="capitol" data-num="4">` | `pycat/curs/capitols.js` → `initCursPage()` | Same contract, as an ES module (`site/js/course/shell.js`). JSCat never adopted it and duplicates the header/sidebar in every page — do not repeat that. |
| K4 | Progress model `{ goalId: true }` in `localStorage`, ✓ in the sidebar | `pycat/curs/capitols.js` (`saveGoalCompleted`, `renderSidebar`) | Same model, versioned keys (§4.12). Refresh the sidebar from `body[data-*]`, never from the URL (see A9). |
| K5 | Zero-dependency code editor: `<textarea>` over a highlighted `<pre>`, line numbers, per-line background layer for error/active marks, autocomplete dropdown | `pycat/js/editor.js`, `jscat/js/editor.js` | Same technique, with HTML and CSS tokenizers. Rewrite rather than copy (see A3). |
| K6 | Undo-safe programmatic edits: `editText()` uses `document.execCommand('insertText')` so Ctrl+Z keeps working, with a fallback | `pycat/js/editor.js:233` | Port it. Every programmatic edit (indent, restore starter code, quick-fixes) must go through it. |
| K7 | Error explanations as a rule table: pattern → `{ text, hint }` in Catalan, original message still shown | `pycat/js/errors.js` (`ERROR_RULES`) | Lint rules + a separate Catalan message table (`site/js/lint/messages.ca.js`), same `{ text, hint }` shape. |
| K8 | Never render student-derived text with `innerHTML` | Comment in `pycat/curs/capitols.js` `_renderDiff` | Mandatory everywhere (`textContent`, `createElement`). |
| K9 | Rich failure feedback (PyCat's line-by-line diff table) instead of a single "wrong" message | `pycat/curs/capitols.js` `_renderDiff` | A **checklist** of all checks with ✓/✗ and a Catalan message per check (§4.8). |
| K10 | Activities: Parsons problems with a **seeded** shuffle (same order every visit) and quizzes with `data-correcta`; loaded only when a page needs them | `pycat/curs/activitats.js` | Port both. For HTML, Parsons indentation = nesting depth (2 spaces). |
| K11 | Test philosophy: reference solution passes; **starter code must fail**; goal ids unique and consistent with course data; the test mimics the runtime exactly; runs on every push | `pycat/tests/comprova-curs.py`, `pycat/tests/solutions.js` | Same invariants (§8), plus HTML-specific static checks. |
| K12 | Lazy initialisation (PyCat loads Pyodide on the first click so a page with 20 simulators does not start 20 interpreters) | `pycat/js/main.js` §3 | Mount simulators and previews lazily with `IntersectionObserver`. |
| K13 | Fullscreen with a CSS fallback for iOS Safari (no Fullscreen API on iframes there) | `pycat/curs/capitols.js` `_enterFullscreen` / `_enterCssFullscreen` | Same strategy, applied to the simulator container (no iframe messaging needed). |
| K14 | Deterministic iframe reload by recreating the element | `jscat/js/domrunner.js` `_spawnIframe` | Keep as the fallback strategy for the preview (§4.4). |
| K15 | Read-only examples with a "No editable" toast; "⟲ Codi inicial" restore with confirmation; Open/Save file buttons (`FileReader`, `Blob` download) | `pycat/js/main.js`, `pycat/js/ui.js`, `jscat/js/ui.js` | Same features on the component. |
| K16 | Touch-device key bar with language-specific keys | `pycat/js/kbd-accessory.js` | Keys for HTML/CSS: `< > / = " ' { } : ; # . - !` and Tab. |
| K17 | Glossary modal | `pycat/curs/glossari-data.js` + `initGlossariCurs()` | Generated from the vocabulary data (§4.11), filtered to what has been taught so far. |
| K18 | File-header comment blocks stating responsibilities and public API | Every PyCat/JSCat JS file | Keep the style (`// ═══` banner, responsibilities, public API, gotchas), in Catalan. |

### 3.2 Avoid (with evidence)

| # | Anti-pattern | Evidence in the sibling repos | HTMLCat rule |
|---|---|---|---|
| A1 | **Documentation drift / too many overlapping docs** | PyCat has `ARCHITECTURE.md` (self-declared outdated), `CURRENT-STATE.md`, `TODO.md`, `CHANGES-PART-A.md`, `PYCAT-CURRICULUM-PLAN.md`, `PYCAT-REPTES-PLAN.md`. The curriculum/reptes plans still prescribe a page skeleton that `initCursPage()` replaced. `TODO.md` says ES/EN translations and a language selector were added; `js/i18n.js` is Catalan-only and `index.html` has no selector. `CURRENT-STATE.md` §9 and `tests/README.md` describe `.github/workflows/comprova-curs.yml`, but **the repo has no `.github/` directory**. JSCat's README lists chapters 11–12 as "Per escriure" although both files exist. | Exactly three living docs: `CLAUDE.md`, `docs/STATE.md`, `docs/CURRICULUM.md` (§10). State changes are documented **in the same commit**. Finished plans are deleted, not left to rot. |
| A2 | **Uploading files through the GitHub web UI** | 44 of 50 PyCat commits and 15 of 17 JSCat commits are "Add files via upload" (the rest are web-editor edits and the licence change): no history semantics, no reviewable diffs, and the CI workflow (a dot-directory) never reached the repo. | All changes go through Git (Claude Code or Codespaces), descriptive commit messages, PRs. |
| A3 | **Copy-fork drift between sibling repos** | `footer.js`, `editor.js`, `curs/capitols.js`, `curs.css` were copied from PyCat to JSCat and diverged: JSCat lacks `initCursPage`, per-simulator code saving, the diff table and the fullscreen fix. | Port *ideas and verified snippets*, then own the code. Record provenance in the file header ("Basat en pycat/js/editor.js, 2026-10"). |
| A4 | **Licence inconsistency** | JSCat `LLICENCIA.md` and README footer block: CC BY-NC-SA + MIT; JSCat README "Llicència" section and `footer.js`: **CC BY-NC-ND**, with a placeholder "`[DAVID ARSO CIVIL]`" and a `cc-by-nc-nd.png` badge. | One licence text, referenced from README, footer and `LLICENCIA.md`. A static test greps for `nc-nd` and fails if found. |
| A5 | **Global namespace + `window.*` exports + inline `onclick`** | `P.*`/`J.*` namespaces with a documented mandatory script load order; JSCat `index.html` uses `onclick="handleRunClick()"` and `ui.js` re-exports to `window`. | ES modules with explicit `import`/`export`; listeners attached in JS; no inline event handlers — we teach separation of concerns, so our own markup must practise it. |
| A6 | **Code inside HTML attributes** | `data-code='…'` with quote hazards; PyCat's test needs a dedicated check for "cometa oblidada"; JSCat repeats a ~200-character `data-html` boilerplate on every DOM simulator of chapter 9. For an HTML course, HTML inside attributes would need `&lt;`/`&quot;` escaping — unreadable and error-prone. | Starter files in `<script type="text/plain" data-file="…">` children (§5.2). Static test forbids `</script` and `<script` inside them. |
| A7 | **Transporting configuration through base64 URL parameters** | `btoa(unescape(encodeURIComponent(code)))` / `decodeURIComponent(escape(atob(…)))` (deprecated `escape`/`unescape`); every simulator becomes an iframe of `index.html` with a long query string. | No URL transport. The component reads its configuration from the DOM it is mounted on. |
| A8 | **Storage keys derived from position** | PyCat saves code under `pycat-code:<page>:<index>`: inserting a new simulator above an existing one shifts every saved program to the wrong exercise. | Every editable simulator has a **stable, site-unique `data-id`**; storage keys use it (§4.12). |
| A9 | **Identity derived from the URL** | JSCat `_refreshSidebar()` matches `/capitol-(\d+)\.html/` on `location.pathname`. Cloudflare Pages serves `/x.html` at `/x` (and redirects), so the regex does not match in production; PyCat's `_saveKey` also yields different keys locally (`capitol-4.html`) and in production (`capitol-4`). PyCat later switched the sidebar to `body[data-pagina]`. | Never derive identity from `location`. Use `body[data-pagina][data-num]` and `data-id`. Links are relative and keep `.html` (they work both locally and on Pages). |
| A10 | **Inline styles in content pages** | 17 `style="…"` attributes across the course pages (e.g. JSCat chapter 9 warning box, badge colours); PyCat's reptes plan *prescribes* inline styles for badges and hints. | Zero `style=""` in `site/**/*.html` (enforced by a static test). Use classes (`.avis`, `.badge--facil`, …). Dynamic sizes go through CSS custom properties set from JS (`el.style.setProperty('--sim-height', …)`). |
| A11 | **Theming by scattered overrides** | PyCat `style.css`: `:root` tokens plus dozens of `body.light .x { … }` overrides. | Themes redefine **tokens only**. Components never reference a theme class. |
| A12 | **Hidden content via feature flags and commented-out code** | JSCat `VISIBLE_MAX_CHAPTER = 10`, `SHOW_REPTES = false`; `REPTES_DATA` lists 13 reptes but only `repte-1.html` exists; `capitol-10.html` has a commented-out "next" link. | Course data lists only pages that exist (static test: data ↔ files bijection). Unfinished work lives in branches/PRs, not behind flags. |
| A13 | **Parallel, unused pipelines** | PyCat `tools/generate-pages.js` + two sample JSON pages, while all real pages are hand-written and use `initCursPage()`: two competing sources of truth for the skeleton. | One authoring path (§5). Add a generator only if it fully replaces hand-written pages. |
| A14 | **Service worker** | PyCat's SW caused `ERR_FAILED` in production; `sw.js` and `js/sw-register.js` must now remain forever as kill-switches. | No service worker, no offline mode, no `Cache-Control` tricks. |
| A15 | **Copying headers that serve another runtime** | PyCat `_headers` sets COOP/COEP (`require-corp`) for `SharedArrayBuffer`. HTMLCat does not need it, and `require-corp` would block cross-origin resources lacking CORP headers. | Do not copy `_headers`; use the minimal security headers of §4.16. |
| A16 | **Deploying the whole repository** | With the Pages output directory at the repo root, `tests/solutions.js`, `docs/` and the planning files are publicly downloadable. | Deploy only `site/` (Cloudflare "Build output directory" = `site`). Solutions live in `tests/`. |
| A17 | **Tests added late, or never** | PyCat's tests were written after the content (and several exercises needed fixing); JSCat has no tests. | Phase 0 sets up the test harness and CI before any content. |
| A18 | **Readability issues the teacher already noticed** | PyCat `TODO.md`: prose set in a monospace font (`curs.css` sets `body { font-family: var(--mono); font-size: 14px }`), fixed footer that covers content, Google Fonts from a CDN. | Sans-serif prose ≥ 17 px, monospace only for code; footer in normal flow; self-hosted fonts. |
| A19 | **Mixed code style** | `var`/`const`/`let`, functions vs arrows mixed (PyCat `TODO.md`: "Unificar l'estil JS"). Footer CSS built as an array of strings in JS. | One style (§6.1), `.editorconfig`, CSS in `.css` files only. |
| A20 | **Weak `postMessage` hygiene** | JSCat DOM mode posts with `'*'` and accepts any message carrying `__jscat: true`; its comment claims `e.source` is unreliable for sandboxed frames, but `e.source === iframe.contentWindow` works for opaque origins. | HTMLCat needs no `postMessage` at all (same-origin preview, §4.4). If you ever add one, check `e.source` and use an explicit target origin. |
| A21 | **Typos slipping into content** | e.g. PyCat chapter 4: `<strong>atenció</strong>dos signes d'igual` (missing ": "). | Proofreading step in the per-chapter checklist (§9.3). |

---

## 4. Architecture

### 4.1 Repository layout

```
htmlcat/
├── CLAUDE.md                 Agent rules (short) + pointers to docs/
├── README.md                 Catalan, for humans; ends with the attribution block
├── LICENSE  LLICENCIA.md     Copied verbatim from PyCat
├── .editorconfig
├── .github/workflows/ci.yml  Unit + static + browser tests on push and PR
├── docs/
│   ├── BLUEPRINT.md          This document (kickoff rationale)
│   ├── STATE.md              Single source of truth: what exists, contracts, decisions, pending work
│   └── CURRICULUM.md         Chapter/repte plan with status (content source of truth)
├── tests/
│   ├── package.json          { "private": true, "type": "module", devDependencies: playwright (pinned) }
│   ├── package-lock.json
│   ├── unit/*.test.mjs       node:test, zero deps (pure modules)
│   ├── course-static.mjs     Zero-dep structural checks of site/ (§8.2)
│   ├── course-browser.mjs    Playwright: solutions vs checks, starters fail, smoke (§8.3)
│   ├── harness.html          Loaded by course-browser.mjs; imports the real modules from ../site/js/
│   └── solutions/<goal-id>/index.html (+ estils.css)
└── site/                     ← the ONLY deployed directory (Cloudflare output dir)
    ├── index.html            Landing: course cards + progress + "Continua on ho vas deixar"
    ├── editor/index.html     Free editor (the "simulador lliure")
    ├── curs/capitol-N.html   Chapters (content only, §5.1)
    ├── curs/repte-N.html     Challenges (content only)
    ├── 404.html
    ├── _headers
    ├── LICENSE.txt           Copy of ../LICENSE so the footer link works inside site/
    ├── css/
    │   ├── tokens.css        Design tokens (colours, spacing, fonts) + themes
    │   ├── base.css          Reset, typography, layout primitives
    │   ├── course.css        Page shell, sidebar, prose components (.avis, .resum, badges…)
    │   └── simulador.css     Component styles (all classes prefixed `sim-`)
    ├── fonts/                Self-hosted WOFF2 (OFL) + licence files
    ├── recursos/             Asset pack students reference from their code (images, CC0/own), with CREDITS.md
    ├── img/                  Site images (logo, favicon)
    └── js/                   ES modules (§4.3)
```

### 4.2 Runtime model

```
 course page (capitol-N.html)                         same origin
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ shell.js: topbar, sidebar, prev/next, footer, glossary                   │
 │                                                                          │
 │ <div class="simulador" data-id=… data-goal-id=…>   ← mountSimulator(el)  │
 │  ┌─ editor (textarea + highlighted pre) ─┐  ┌─ preview ──────────────┐   │
 │  │ [index.html] [estils.css]   tabs      │  │ <iframe sandbox=        │   │
 │  │                                       │──▶   "allow-same-origin"   │   │
 │  │ lint (static, live, debounced)        │  │  srcdoc=buildSrcdoc()>  │   │
 │  └───────────────────────────────────────┘  │  no scripts can run     │   │
 │  ┌─ ⚠ Problemes ─┐ ┌─ ✓ Comprovacions ─┐ ┌─ 🌳 Arbre ─┐               │   │
 │  └───────────────┘ └───────────────────┘ └────────────┘  parent reads  │   │
 │                                              contentDocument, CSSOM,   │   │
 │                                              getComputedStyle, layout  │   │
 └──────────────────────────────────────────────────────────────────────────┘
```

- **Static lint** runs on the source text on every pause in typing (debounce ≈ 400 ms).
- **Preview** re-renders on every pause (debounce ≈ 300 ms).
- **Rendered lint** (rules that need the rendered document: selector matches nothing, image not found, low contrast, link to a missing `#id`) runs after each preview `load`.
- **Checks** run only when the student presses **✓ Comprova** (constant red marks while typing are discouraging), in a hidden *check frame* of fixed size so results do not depend on the student's window width.

### 4.3 Module map

Rule: modules under `lang/`, `lint/` (except the browser adapter), `checks/schema.js`, `preview/srcdoc.js` and `util/` are **pure**: no access to `document`, `window` or `localStorage` at import time or inside their functions. They are importable from Node for unit tests. Browser-only APIs (e.g. `CSS.supports`) are **injected** as parameters.

| Module (`site/js/…`) | Pure | Responsibility | Public API (indicative) |
|---|---|---|---|
| `util/text.js` | ✓ | `dedent`, `normalizeNewlines`, `lineColAt(source, offset)` | |
| `util/storage.js` | — | Namespaced, versioned, exception-safe `localStorage` | `load(key, fallback)`, `save(key, value)`, `remove(key)` |
| `i18n/ca.js` | ✓ | Every UI string | `t(key, params)` |
| `lang/html-tokenizer.js` | ✓ | HTML5-subset tokenizer with offsets/lines/cols (doctype, comments, start/end tags, attributes quoted/unquoted, text, raw-text `style`/`script`, RCDATA `title`/`textarea`, char references) | `tokenizeHtml(src) → Token[]` |
| `lang/html-model.js` | ✓ | Stack-based *source tree* + structural diagnostics (unclosed, stray end tag, misnesting, void with end tag, `<p>` implicitly closed by a block, duplicate attributes) | `buildSourceTree(tokens) → { root, problems }` |
| `lang/css-parser.js` | ✓ | Tolerant CSS parser with positions: rules, selectors, declarations, at-rules (`@media`), comments, unbalanced braces, missing `;` | `parseCss(src) → { rules, problems }` |
| `lang/html-spec.js` | ✓ | Known elements, void elements, per-element/global attributes, deprecated elements | data |
| `lint/rules-html.js`, `lint/rules-css.js` | ✓ | Rule objects (§4.7) | `RULES` |
| `lint/messages.ca.js` | ✓ | Catalan `{ text, hint }` per rule id | `MESSAGES` |
| `lint/lint.js` | ✓ | Runs enabled rules; returns sorted problems | `lintStatic({ files, mode, chapter, env })`, `lintRendered({ doc, files, model, chapter })` |
| `checks/schema.js` | ✓ | Validates `data-checks` JSON (used by tests and in dev mode) | `validateChecks(json) → errors[]` |
| `checks/checks.js` | — | Evaluates checks against a rendered `Document` + source model | `runChecks({ doc, files, model, checks, env }) → Result[]` |
| `preview/srcdoc.js` | ✓ | Builds the preview document string from virtual files (§4.5) | `buildSrcdoc({ files, mode, assetBase, csp })` |
| `preview/preview.js` | — | Iframe lifecycle, debounce, scroll restore, link/form interception, resource-error capture | `createPreview(container, opts)` |
| `editor/highlight.js` | ✓ | Tokens → highlighted HTML string (escaped) | `highlight(src, lang)` |
| `editor/editor.js` | — | Textarea overlay, line numbers, marks, `editText`, Tab/Shift+Tab, Enter auto-indent | `createEditor(container, { value, lang, readonly })` |
| `editor/autocomplete.js` | — | Progressive vocabulary (only what has been taught) | |
| `sim/simulador.js` | — | The component: tabs, toolbar, panels, persistence, lazy mount | `mountSimulator(el, { chapter })` |
| `sim/tree-view.js` | — | DOM tree panel (§4.10) | |
| `course/data.js` | ✓ | `CAPITOLS`, `REPTES` | |
| `course/vocabulary.js` | ✓ | Every tag/attribute/property/value taught, with the chapter that introduces it | |
| `course/shell.js` | — | Topbar, sidebar, prev/next, footer, glossary; reads `body[data-pagina][data-num]` | `initCoursePage()` |
| `course/progress.js` | — | Goal completion, export/import | |
| `course/activities/parsons.js`, `quiz.js` | — | Activities (dynamically imported only if present) | |
| `pages/course-page.js`, `pages/editor-page.js`, `pages/landing-page.js` | — | Entry points (one `<script type="module">` per page) | |

Identifier language: **JS identifiers, CSS class names of the engine and file names in English**; **comments in Catalan** (as in PyCat/JSCat; the maintainer is Catalan). Content-page `data-*` attributes keep the family's names (`data-pagina`, `data-num`, `data-goal-id`, `data-correcta`) so authors feel at home across projects.

### 4.4 The preview sandbox (security-critical)

```html
<iframe class="sim-preview" title="Resultat" sandbox="allow-same-origin"></iframe>
```

- **`allow-same-origin` without `allow-scripts`**: the student's `<script>`, inline `on*` handlers and `<meta http-equiv="refresh">` are all blocked; the parent can access `iframe.contentDocument`, `document.styleSheets[n].cssRules`, `getComputedStyle()` and `getBoundingClientRect()`. **Never add `allow-scripts` while `allow-same-origin` is present** (that combination lets framed code remove its own sandbox).
- `allow-forms` is added only for simulators with `data-forms` (form chapter). Without it, submission is blocked *before* the `submit` event fires; with it, a parent-registered `submit` listener can `preventDefault()` and show the `FormData` ("Això és el que s'enviaria al servidor"). Verified.
- **Rendering:** set `iframe.srcdoc = buildSrcdoc(…)` after a 300 ms debounce, only if the string changed. On `load`: restore `scrollX/scrollY` saved before the update, re-install listeners, run rendered lint. If a browser proves unreliable at firing `load` (JSCat observed this when re-assigning an identical `srcdoc`), recreate the element (`jscat/js/domrunner.js` `_spawnIframe` pattern).
- **Navigation:** install a capturing `click` listener on `contentDocument` from the parent (it fires even though the frame cannot run scripts — verified). For `<a href="#id">`, scroll the target into view inside the preview (or report "no hi ha cap element amb id=…"); for any other URL, `preventDefault()` and show a toast "Aquest enllaç portaria a: …". Nothing ever navigates the preview away.
- **External requests:** inject `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; media-src 'self'">` as the first element of `<head>` (decision D5). *(Note 2026-10-02: in `document` mode it is inserted right after the doctype, not after the student's `<head>`: with text before `<html>`, the browser put it in `<body>` and ignored it — STATE §3.)* Students use the local asset pack. *Verify* in Playwright that an external `<img>` is blocked and that a parent listener for `securitypolicyviolation` on the preview document fires, so the Problems panel can explain it.
- **Images not found:** after `load`, report every `img` with `complete && naturalWidth === 0` ("No s'ha trobat la imatge `gat.jpg`. Comprova el nom i la carpeta.").

### 4.5 Virtual files and resource resolution

A simulator holds a small virtual file system: `{ 'index.html': '…', 'estils.css': '…' }` (file names: decision D2).

`buildSrcdoc({ files, mode, assetBase, csp })`:

- **`mode="fragment"`** (default for focused examples): the student edits only body content. The engine wraps it in a standard skeleton (`<!DOCTYPE html>`, `<html lang="ca">`, `<meta charset="UTF-8">`, viewport, title) and includes every CSS file.
- **`mode="document"`**: the student writes the whole document, including `<link rel="stylesheet" href="estils.css">`. Document-level lint rules (doctype, `lang`, charset, title, viewport) apply only in this mode.
- `<link rel="stylesheet" href="X">` pointing at a virtual file is replaced by `<style data-file="X">…</style>` — located with the tokenizer, **not with regular expressions** (attribute order and quoting vary). A link to a file that does not exist produces a Problems entry ("El fitxer `estil.css` no existeix. Els fitxers d'aquest exercici són: …").
- A `<base href="{assetBase}">` is injected first in `<head>`, where `assetBase = new URL('../../recursos/', import.meta.url).href` (computed in the browser adapter, passed in). The srcdoc document's base URL is otherwise the *parent page* URL (verified), which would make `img/gat.jpg` resolve differently on `/editor/` and `/curs/`. Consequence: fragment links `#id` would resolve against the base — irrelevant because all clicks are intercepted (§4.4).
- Injected markup changes no line numbers that students see: lint and the editor work on the original sources; only the preview receives the composed string.

### 4.6 Language core

- The **HTML tokenizer** and **CSS parser** are the heart of the project: highlighting, linting, the source tree, Parsons validation, `uses-html`/`uses-css` checks and quick-fixes all consume them. Write them first, with exhaustive unit tests (well-formed input, every error class, Catalan accents, CRLF, empty files, very long lines, unterminated comments/strings at EOF).
- Positions: every token carries `start`, `end` (UTF-16 offsets, matching `textarea.selectionStart`), `line`, `col` (1-based).
- Do **not** try to replicate the HTML5 tree-construction algorithm. The source tree is a simple stack machine designed to *diagnose*; the browser's DOM (read from the preview) is the ground truth of what was built. Comparing both is what powers the tree view's "afegit pel navegador" markers.
- Performance budget: tokenizing + highlighting + static lint of a 300-line file < 5 ms on a school laptop. Re-tokenize the whole file on each input; do not optimise prematurely.

### 4.7 The linter — "el navegador perdona, HTMLCat t'ho explica"

Rule object:

```js
// site/js/lint/rules-html.js
export const unclosedElement = {
  id: 'html/unclosed-element',
  lang: 'html',
  since: 1,              // chapter where the concept is taught → enabled from then on
  severity: 'error',     // 'error' | 'warning' | 'info'
  phase: 'static',       // 'static' (source only) | 'rendered' (needs the preview Document)
  check(ctx, report) {
    for (const el of ctx.model.unclosed) report({ at: el.startTag, data: { tag: el.name } });
  },
};
```

Message table (separate from logic, mirrors PyCat's `ERROR_RULES` output):

```js
// site/js/lint/messages.ca.js
export const MESSAGES = {
  'html/unclosed-element': ({ tag }) => ({
    text: `L'element <${tag}> no està tancat.`,
    hint: `Escriu </${tag}> on s'acaba el seu contingut. El navegador l'ha tancat per tu, però potser no on volies.`,
  }),
};
```

Principles:

1. **Progressive rules:** a rule is active when `rule.since <= chapter` (page `data-num`; for a repte, its `afterChapter` field in `REPTES`). Students are never criticised for things not yet taught. The free editor enables everything.
2. **Few and clear:** show at most 10 problems, errors first; group duplicates ("i 4 més com aquest"). Each entry: line, icon, Catalan text, 💡 hint, rule id in small type (useful for the teacher). Clicking an entry moves the caret to the line.
3. **Errors vs warnings:** *error* = the browser had to repair or ignore something (unclosed/misnested tags, unknown property, invalid value, missing brace). *warning* = valid but unclean (indentation, inline `style`, `!important`, heading levels skipped). *info* = suggestions.
4. **Severity drives the gutter:** red line background for errors, amber for warnings (PyCat's `markErrorLine` layer).
5. **CSS validity uses the browser itself:** `CSS.supports(prop, 'initial')` tells whether a property exists; `CSS.supports(prop, value)` whether a value is valid (verified: `colr` → false, `width: 100` → false, `background-color: vermell` → false; custom properties `--x` → always true). Inject `supports` into the pure linter; unit tests pass a stub.
6. **Quick-fixes** (later phase): only for unambiguous cases (add missing `</li>`, add `;`), applied through `editText` so Ctrl+Z undoes them.

The initial rule catalogue is in Appendix C.

### 4.8 Exercise validation — the checks DSL

Each validated simulator carries a JSON array of checks:

```html
<script type="application/json" data-checks>
[
  { "type": "count", "selector": "ul > li", "min": 3,
    "msg": "La llista ha de tenir almenys 3 elements <li> dins d'un <ul>." },
  { "type": "text", "selector": "h1", "includes": "compra",
    "msg": "El títol <h1> ha de parlar de la compra." },
  { "type": "style", "selector": "h1", "prop": "color", "equals": "teal",
    "msg": "El títol ha de ser de color teal (fes-ho a estils.css)." },
  { "type": "uses-css", "selector": "h1", "prop": "color",
    "msg": "El color s'ha de posar amb una regla CSS que seleccioni h1." },
  { "type": "lint", "maxErrors": 0,
    "msg": "El codi no pot tenir errors (mira el panell ⚠ Problemes)." }
]
</script>
```

| Type | Fields | Semantics |
|---|---|---|
| `exists` | `selector` | `doc.querySelector(selector) !== null` |
| `count` | `selector`, one of `eq` / `min` / `max` | `querySelectorAll(selector).length` |
| `text` | `selector`, one of `equals` / `includes` / `matches`, optional `all`, `ci` | Whitespace-normalised `textContent` of the first match (or every match if `all`) |
| `attr` | `selector`, `name`, one of `present` / `nonEmpty` / `equals` / `includes` / `matches` | Attribute of the first match (or `all`) |
| `style` | `selector`, `prop`, `equals`, optional `all` | Computed value of the target vs the computed value of a **probe** element inserted as the target's sibling with `probe.style.setProperty(prop, equals)` — authors write natural values (`teal`, `2em`) and the browser normalises both sides. Prefer non-geometric properties; use `layout` for geometry. |
| `uses-html` | `tag` and/or `attr` | Present in the **source tree** (not the DOM: the DOM contains elements the browser invented, e.g. `<tbody>`) |
| `uses-css` | `selector` (exact or `matches`), `prop`, optional `value` | A declaration exists in the student's CSS files. Use it to forbid "cheating" with inline styles or to require a technique (`display: flex`). |
| `lint` | `maxErrors`, optional `maxWarnings`, optional `rules` | Static + rendered lint results at the exercise's chapter level |
| `layout` *(Phase 5)* | `selector`, `kind`: `row` / `column` / `centered-x` / `fits-width`, `tolerance` | `getBoundingClientRect()` predicates (all matches share `top` ± tolerance with increasing `left`, etc.) |
| `viewport` *(Phase 5)* | `width`, `checks` | Re-run the nested checks with the check frame resized (responsive chapter) |

Rules:

- **Pass** = every check passes. The panel shows *all* checks with ✓/✗, not just the first failure.
- Every check has a Catalan `msg` written as a *requirement* ("La llista ha de tenir…"), never as a reproach.
- Checks are evaluated in a hidden **check frame** (same sandbox flags, fixed 800 × 600 px), never in the visible preview.
- `checks/schema.js` validates the JSON; the static test runs it on every page; in development (`?dev=1`), schema errors are shown in red above the simulator.
- On success: `saveGoalCompleted(goalId)`, update the sidebar ✓, show "✓ Molt bé! Has complert les N comprovacions."

### 4.9 The simulator component (UX)

- Layout ≥ 760 px: editor left, preview right; panels below (tabs: **⚠ Problemes (n)** · **✓ Comprovacions** · **🌳 Arbre**). < 760 px: stacked editor → preview → panels.
- Toolbar: file tabs (`role="tablist"`), **✓ Comprova** (only with `data-goal-id`), **⟲ Codi inicial** (editable sims), **⛶ Pantalla completa**, and in the free editor **Obre** / **Desa** (download `.html`; later a zip of all files).
- There is no "▶ Executa": the preview is live. (Decision: live preview teaches the edit→see loop instantly; checks remain an explicit action.)
- Read-only examples (`data-readonly` on the simulator, or on a single `data-file` block so e.g. HTML is fixed and only CSS is editable) show the "No editable" toast.
- Persistence: on every input (debounced 500 ms) save `{ files, savedAt }` under the simulator's `data-id`. Restore on mount. "⟲ Codi inicial" restores through `editText` (undoable) after `confirm()`.
- Editor details: 2-space indentation; Tab/Shift+Tab indent/dedent lines or selections; Enter keeps the indentation and adds one level after an opening tag or `{`; **no auto-closing tags by default** (decision D4); `font-size ≥ 16px` on the textarea (iOS Safari zooms into smaller inputs); `Esc` then `Tab` leaves the editor (keyboard users must not be trapped by Tab-indentation; say so in the help tooltip).
- Lazy mount via `IntersectionObserver` (`rootMargin: '200px'`). Before mounting, the placeholder shows the starter code in a plain `<pre>` (progressive enhancement).
- `aria-live="polite"` only on a short status line ("2 errors, 1 avís"), updated after typing pauses — never on the full list.

### 4.10 The 🌳 DOM tree view

- Renders `contentDocument.documentElement` as a collapsible nested list: element names, `id`/`class`, text nodes abbreviated, comments shown in grey.
- **v1:** plain tree. **v2:** compare with the source tree; nodes absent from the source are marked "afegit pel navegador" (e.g. `<tbody>`, implied `<head>`, the second `<i>` the parser creates for `<b><i></b></i>` — verified in Appendix A). This is the most powerful way to show *why* clean nesting matters.
- Hovering a node outlines the element in the preview (parent sets a temporary outline via an injected `<style>`; no scripts needed).

### 4.11 Course shell and data

```js
// site/js/course/data.js
export const CAPITOLS = [
  { num: 1, titol: 'Hola, HTML!', arxiu: 'capitol-1.html', goalId: 'cap-1-ex', part: 'HTML' },
  // …
];
export const REPTES = [
  { num: 1, titol: 'La targeta de presentació', arxiu: 'repte-1.html', goalId: 'repte-1',
    afterChapter: 3, dificultat: 'facil' },
  // …
];
```

- `initCoursePage()` builds topbar, sidebar (with ✓), prev/next links, glossary and footer from this data and `body[data-pagina][data-num]`, then mounts simulators and dynamically imports activities only if the page has any.
- `course/vocabulary.js` lists every tag, attribute, CSS property and keyword value taught, with `since` chapter and a one-line Catalan definition. It feeds the glossary (filtered to `since <= current chapter`), autocomplete (same filter) and the static test "an example uses a tag not yet taught" (warning only).
- The footer is a normal-flow element rendered by the shell (no `position: fixed`, no CSS-in-JS strings).

### 4.12 Storage

```js
// site/js/util/storage.js
const PREFIX = 'htmlcat:v1:';
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }   // private mode, quota, corrupted JSON
}
export function save(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
  catch { return false; }
}
```

| Key (after prefix) | Value |
|---|---|
| `code:<data-id>` | `{ files: { 'index.html': '…', … }, savedAt }` |
| `code:editor` | Free editor files |
| `progress` | `{ goals: { '<goal-id>': <timestamp> } }` |
| `prefs` | `{ theme }` |

- School computers are shared and often wiped: provide **"📋 Exporta el meu progrés" / "Importa"** (a JSON file with progress and code) on the landing page — PyCat's `TODO.md` asks for this too.
- Bump `v1` → `v2` only with a migration function; never silently discard students' work.

### 4.13 Activities

- **Parsons** (port `pycat/curs/activitats.js`): the `<pre class="parsons-codi">` holds the solution, indented with 2 spaces per nesting level; lines are shown shuffled (seeded by goal id) and unindented; the student orders and indents. Validation = exact order and indentation.
- **Quiz** (port): "Què es veurà?", "Quina etiqueta és la més adequada?", "Quin selector selecciona…?". `data-correcta` = 1-based index.
- **Troba l'error:** a normal simulator whose starter code renders "fine" but has lint errors; checks = content checks + `{"type": "lint", "maxErrors": 0}`.
- **Copia el disseny** *(later)*: a reference image of the target plus `style`/`layout` checks.

### 4.14 Styling and theming

- `tokens.css` defines all colours, spacing, radii, font stacks and sizes as custom properties on `:root`; a dark theme redefines the **same tokens** under `[data-theme="dark"]` and under `@media (prefers-color-scheme: dark)` when no explicit choice exists. No component rule mentions a theme.
- Prose: self-hosted sans-serif (OFL licensed, e.g. Atkinson Hyperlegible) ≥ 17 px, line-height ≈ 1.6, measure ≈ 70ch. Code: self-hosted Space Mono (family identity). Keep the PyCat/JSCat visual identity (topbar, sidebar, cards) but cleaner.
- Engine classes are prefixed `sim-` (component) and use BEM-style modifiers (`sim-tab--active`), so course CSS and component CSS never collide.
- Respect `prefers-reduced-motion`.

### 4.15 Security and privacy checklist

- Preview: `sandbox="allow-same-origin"` (+ `allow-forms` only with `data-forms`), never `allow-scripts`.
- All student-derived strings rendered with `textContent`. Highlighting escapes `&`, `<`, `>` before wrapping tokens in spans.
- No third-party requests from the site or from previews (CSP meta in previews; self-hosted fonts; local asset pack with `CREDITS.md`).
- No analytics, no cookies, no `postMessage` channels.

### 4.16 Deployment (Cloudflare Pages)

- Production branch `main`; framework preset **None**; build command **empty**; build output directory **`site`**. Custom domain `htmlcat.step-quiz.net` (decision D8). The owner configures this; give them click-by-click steps in Catalan.
- `site/_headers`:

  ```
  /*
    X-Content-Type-Options: nosniff
    Referrer-Policy: strict-origin-when-cross-origin
    Permissions-Policy: camera=(), microphone=(), geolocation=()
  ```

- No COOP/COEP, no long `Cache-Control` on unversioned JS/CSS (Pages revalidates by default, so updates propagate without cache-busting).
- Pages serves `/curs/capitol-1.html` at `/curs/capitol-1`. Relative links with `.html` work in both environments; nothing may depend on `location.pathname` (A9).
- Verify after the first deploy that `/tests/` and `/docs/` return 404 (A16).

---

## 5. Authoring format (content contract)

### 5.1 Page skeleton

```html
<!DOCTYPE html>
<html lang="ca">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Capítol 3 — Llistes | HTMLCat</title>
  <link rel="stylesheet" href="../css/tokens.css">
  <link rel="stylesheet" href="../css/base.css">
  <link rel="stylesheet" href="../css/course.css">
  <link rel="stylesheet" href="../css/simulador.css">
  <script type="module" src="../js/pages/course-page.js"></script>
</head>
<body data-pagina="capitol" data-num="3">

<main class="curs-content">
  <header class="chapter-header">
    <h1>Llistes</h1>
    <p class="chapter-lead">Una frase que diu què sabrà fer l'alumne en acabar.</p>
  </header>

  <section class="chapter-section">
    <h2>…</h2>
    …
  </section>
</main>

</body>
</html>
```

Module scripts are deferred, so the DOM is ready when `course-page.js` runs. The shell injects everything else (A13: one authoring path).

### 5.2 Simulator markup

```html
<div class="simulador" data-id="c03-llista-compra" data-goal-id="cap-3-ex">
  <script type="text/plain" data-file="index.html">
    <h1>La llista de la compra</h1>
    <ul>
      <li>Pomes</li>
    </ul>
  </script>
  <script type="text/plain" data-file="estils.css" data-readonly>
    h1 {
      color: teal;
    }
  </script>
  <script type="application/json" data-checks>
    [{ "type": "count", "selector": "ul > li", "min": 3,
       "msg": "La llista ha de tenir almenys 3 elements <li>." }]
  </script>
</div>
```

- Block contents are passed through `dedent()` (remove the common leading indentation and the first/last blank lines), so authors can indent blocks naturally inside the page.
- Why `<script type="text/plain">`: it is raw text — entities (`&copy;`), quotes, `<!DOCTYPE>`, `<html>`, `<head>` and even deliberately broken nesting survive verbatim. `<template>` parses its content as HTML and destroys exactly what we need to teach (Appendix A). Constraint: the content must not contain `</script` or `<script` (students do not write scripts anyway); the static test enforces it.
- No tabs in content (static test); 2-space indentation.

| Attribute (on `.simulador`) | Meaning |
|---|---|
| `data-id` | **Required** on editable simulators; site-unique, stable forever (storage key). Convention `c<NN>-<slug>` / `r<NN>-<slug>`. |
| `data-goal-id` | Validated exercise; enables ✓ Comprova and progress. `cap-N-ex`, `cap-N-bug`, `repte-N` (family convention). |
| `data-mode` | `fragment` (default) or `document` (§4.5). |
| `data-readonly` | Whole example read-only (no `data-id` needed). On a `data-file` block: that file only. |
| `data-height` | Preview/editor height in px (default 360), applied through `--sim-height`. |
| `data-forms` | Adds `allow-forms` + submit interception (form chapter). |
| `data-panel` | Panel open by default: `problemes` (default), `comprovacions`, `arbre`. |

### 5.3 Activities markup

```html
<div class="parsons" data-goal-id="cap-3-parsons">
  <p class="parsons-enunciat">Ordena i indenta el codi perquè sigui una llista niada.</p>
  <pre class="parsons-codi">&lt;ul&gt;
  &lt;li&gt;Fruita
    &lt;ul&gt;
      &lt;li&gt;Pomes&lt;/li&gt;
    &lt;/ul&gt;
  &lt;/li&gt;
&lt;/ul&gt;</pre>
</div>

<div class="quiz" data-goal-id="cap-2-quiz">
  <div class="quiz-q" data-correcta="2">
    <p>Quina etiqueta fa servir per a un text important?</p>
    <ol class="quiz-opcions"><li>&lt;b&gt;</li><li>&lt;strong&gt;</li><li>&lt;big&gt;</li></ol>
    <p class="quiz-explica">&lt;strong&gt; indica importància; &lt;b&gt; només canvia l'aspecte.</p>
  </div>
</div>
```

(Parsons `<pre>` content is HTML-escaped here because it is shown as text; the activity module reads `textContent`.)

### 5.4 Prose components

Use classes from `course.css` only: `.avis` (warning box), `.nota`, `.resum`, `.chapter-badge`, `.badge--facil|intermedi|dificil`, `details.pista`, `pre.code-example` (static, highlighted by `highlight.js`). No `style=""` (A10).

### 5.5 Content rules

1. Show, then tell. One concept per simulator.
2. Every example renders exactly what the prose says it renders — check it in the browser.
3. All example content in Catalan: texts, `alt`, `class`, `id` (ASCII kebab-case, no accents: `.menu-principal`, `#contacte`).
4. Every chapter has an **"Errors típics"** section built with read-only simulators whose preview looks *almost* right while the Problems panel explains what the browser silently repaired.
5. One validated **"Exercici"** (`cap-N-ex`), optionally a **"Troba l'error"** (`cap-N-bug`), a **"Resum"** (4–6 bullets), and a short **"Codi net"** box naming the clean-code habit of the chapter.
6. Never introduce in a repte a concept not taught before its `afterChapter`.
7. Images only from `site/recursos/` (with credits).

---

## 6. Clean-code standards

### 6.1 For HTMLCat's own code

- ES modules, one responsibility per module; **functional core, imperative shell**: parsing/linting/check logic pure and unit-tested; DOM code thin.
- `const`/`let` only; `===`; early returns; functions ≲ 40 lines; no dead code; no commented-out code; no feature flags for unfinished content.
- No inline event handlers, no inline styles in markup, no CSS inside JS strings.
- JSDoc on every exported function (types documented without TypeScript).
- Errors: never swallowed silently except in the storage wrapper (documented); no `console.log` left in production code.
- `.editorconfig`: UTF-8, LF, 2 spaces, final newline, trim trailing whitespace. Quotes: single in JS, double in HTML attributes. Semicolons on.
- Accessibility: real `<button type="button">`s, visible focus, labelled controls, tabs with ARIA roles and arrow-key support.
- File header comment (Catalan) in every JS file: responsibilities, public API, gotchas, provenance if ported.

### 6.2 House style taught to students (all examples follow it; the linter enforces it progressively)

**HTML**
- Lowercase element and attribute names; attribute values in double quotes.
- **Indentation mirrors nesting**: 2 spaces per level; one block element per line; inline elements stay inside the line.
- Close every non-void element explicitly (`</p>`, `</li>` included). Void elements without a slash: `<br>`, `<img …>`.
- `<!DOCTYPE html>`, `<html lang="ca">`, `<meta charset="UTF-8">` first in `<head>`, viewport meta, meaningful `<title>`.
- Semantics first: headings in order with one `<h1>`; `<strong>`/`<em>` for meaning; landmarks (`header`, `nav`, `main`, `footer`); `div`/`span` only when nothing semantic fits; tables only for tabular data.
- Every `img` has `alt`; every form control has a `<label>`; `id`s unique.
- No `style=""`, no deprecated presentational elements (`font`, `center`), no `<br>` for spacing.
- Comments mark sections, not obvious lines.

**CSS**
- External stylesheet linked from `<head>`.
- One selector per line in a group; one declaration per line; `prop: value;` with a space after the colon and a semicolon after **every** declaration; 2-space indentation; blank line between rules.
- Style with **classes** named by meaning, not appearance (`.avis`, not `.vermell`); ids for anchors/labels, not for styling (warning, not error).
- No `!important`. Units always written (`0` excepted).
- From the colours chapter onward: palette in custom properties on `:root` (`--color-principal`).
- Group declarations consistently (layout → box → text → decoration) — taught as a habit, not linted.

---

## 7. Curriculum proposal (to be confirmed with the owner — D9)

| # | Títol | New concepts | Clean-code habit | Lint rules enabled (cumulative) |
|---|---|---|---|---|
| 1 | Hola, HTML! | elements, tags, content, nesting; skeleton (`doctype`, `html lang`, `head`, `meta charset`, `title`, `body`); `h1`, `p` | close what you open; indentation mirrors nesting | unclosed, stray end tag, misnesting, uppercase tags, indentation |
| 2 | Text amb significat | `h1`–`h6`, `strong`/`em`, `br`, comments, whitespace collapsing, entities | semantics over appearance | heading order, single `h1`, `br` for spacing, unknown element |
| 3 | Llistes | `ul`/`ol`/`li`, nested lists | nesting = indentation | `li` outside list, invalid list children |
| 4 | Enllaços | `a href`, absolute vs relative paths, `#id` anchors, `id` | meaningful link text | missing `href`, empty link, "clica aquí", duplicate id, missing anchor target (rendered) |
| 5 | Imatges | `img src alt width height`, folders, `figure`/`figcaption` | describe images for everyone | missing `alt`, unknown attribute (`scr`), image not found (rendered) |
| 6 | Estructura de la pàgina | `header`, `nav`, `main`, `section`, `article`, `aside`, `footer`, `div` | structure before style | one `main`, div-soup hints, document-level rules in `document` mode |
| 7 | Taules | `table`, `caption`, `thead`, `tbody`, `tr`, `th scope`, `td` | tables for data, not layout | table structure, `th` without `scope` |
| 8 | Formularis | `form`, `label for`, `input` types, `select`, `textarea`, `button` | every control has a label | control without label, label `for` mismatch |
| 9 | Hola, CSS! | rule syntax, `link rel="stylesheet"`, `color`, `background-color`, `font-size`, comments | separate content from presentation | unknown property, invalid value, missing `;`, unbalanced braces, inline `style` |
| 10 | Selectors i cascada | type, class, id, descendant, grouping; cascade, specificity, inheritance | name classes by meaning | selector matches nothing (rendered), `!important`, id selectors (warning), duplicate declarations |
| 11 | Colors, text i unitats | hex/rgb/hsl, `px`/`em`/`rem`/`%`, font stacks, `line-height`, `text-align`; custom properties | don't repeat yourself: variables | missing generic font family, low contrast (rendered), unit missing |
| 12 | El model de caixa | `margin`, `border`, `padding`, `width`, `box-sizing`, `display` block/inline | consistent spacing scale | conflicting/unused declarations (info) |
| 13 | Flexbox | `display:flex`, `flex-direction`, `justify-content`, `align-items`, `gap`, `flex-wrap` | layout with intent, not with hacks | — (layout checks) |
| 14 | Pàgines que s'adapten | viewport meta, `max-width`, `img {max-width:100%}`, `@media` | mobile first | missing viewport (document mode) |
| 15 | Projecte final | a small multi-section personal/club page | everything together | all |

Reptes (≈ 12, each with `afterChapter`): La targeta de presentació (3) · La recepta (3) · El viatge (5) · L'horari de classe (7) · La inscripció al club (8) · Arregla aquesta pàgina (8, multi-error "troba l'error") · La fitxa de l'animal (10) · El menú de navegació (13) · La galeria (13) · La targeta de producte (12) · La pàgina que s'adapta (14) · Copia el disseny (14).

Optional extras after 15: CSS Grid; transitions; a bridge chapter to JSCat Part B ("el DOM que ja coneixes").

---

## 8. Testing and CI

### 8.1 Unit tests (zero dependencies)

`node --test tests/unit/*.test.mjs` — tokenizer, CSS parser, source tree diagnostics, every lint rule (positive and negative cases, Catalan messages exist for every rule id), checks schema, `dedent`, `buildSrcdoc` (fragment/document, link inlining, base/CSP injection), storage wrapper (with a fake `localStorage`).

### 8.2 Static course checks (zero dependencies)

`node tests/course-static.mjs` fails (exit 1) on any of:

1. `CAPITOLS`/`REPTES` ↔ files in `site/curs/` are a bijection; numbering is contiguous.
2. Every page has `body[data-pagina][data-num]` consistent with its file name and data entry.
3. Every editable `.simulador` has a `data-id`; all `data-id`s and `data-goal-id`s are unique site-wide; every `goalId` in the data exists in its page.
4. Every `data-file` block: no `</script`, no `<script`, no tab characters; file names belong to the allowed set.
5. Every `data-checks` block parses as JSON and passes `validateChecks`.
6. Every `data-goal-id` has `tests/solutions/<goal-id>/`.
7. No `style=""` attribute in `site/**/*.html`; no `nc-nd` anywhere; no inline `on*=` attributes.
8. Every relative `href`/`src` in `site/` resolves to an existing file.
9. Quizzes: `data-correcta` within range; Parsons: 2-space indentation, at least 3 lines.
10. Every lint rule id has a Catalan message; every vocabulary entry has a valid `since`.

### 8.3 Browser checks (Playwright, CI and local)

`node tests/course-browser.mjs` serves `site/` and `tests/` on a local port, opens `tests/harness.html` (which imports the real modules), and for every exercise:

1. the **reference solution** passes all checks and has 0 lint errors at its chapter level;
2. the **starter code fails** at least one check (otherwise the exercise solves itself);
3. the solution's preview produces no "image not found" problems.

Then a smoke pass over every page at 360 px and 1280 px: no console errors, no failed requests, no horizontal overflow (`scrollWidth <= innerWidth`), every simulator mounts, and one end-to-end exercise per page (type the solution into the editor, click ✓ Comprova, read the checklist, reload, confirm the ✓ persisted).

### 8.4 CI workflow

```yaml
# .github/workflows/ci.yml
name: Comprova HTMLCat
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node --test tests/unit/*.test.mjs
      - run: node tests/course-static.mjs
      - run: npm ci
        working-directory: tests
      - run: npx playwright install --with-deps chromium
        working-directory: tests
      - run: node course-browser.mjs
        working-directory: tests
```

> **Note (2026-10-02):** the test commands in §8.1, §8.4 and §9.2 used to pass the directory `tests/unit/` to `node --test`; on Node 22 that fails ("Cannot find module"), so they now use the glob. The real workflow is `.github/workflows/ci.yml`: it was lost once when the project was moved by web upload (A2), and `tests/course-static.mjs` now fails if it is missing.

Notes: commit this file with Git (A2). In a Claude Code cloud container, Chromium is preinstalled (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`): do **not** run `playwright install` there. The deployed product never depends on Node.

---

## 9. Delivery workflow

### 9.1 Phases (each phase = one or more small PRs; every PR keeps CI green)

| Phase | Deliverable | Definition of done |
|---|---|---|
| **0 — Bootstrap** | Repo layout (§4.1), `LICENSE`, `LLICENCIA.md`, README (Catalan, attribution block), `CLAUDE.md`, `docs/STATE.md`, `docs/CURRICULUM.md`, `.editorconfig`, CI with placeholder tests, `site/index.html` "En construcció", `_headers`, Cloudflare instructions for the owner | Deployed URL serves `site/` only; CI green; `/tests/` returns 404 |
| **1 — Language core** | HTML tokenizer, CSS parser, source tree, highlighter + unit tests | Every token type and every diagnostic class has positive and negative unit tests; perf budget (§4.6) met |
| **2 — Editor + preview + free editor** | `editor.js`, `preview.js`, `srcdoc.js`, storage, `site/editor/` page | Manual check at 360/1280 px; Playwright smoke; no console errors |
| **3 — Linter v1 + Problems panel** | Rules for chapters 1–3 and 9 (Appendix C), Catalan messages, gutter marks | Unit tests per rule; panel usable with keyboard |
| **4 — Course vertical slice** | Shell, data, progress, simulator component with checks DSL v1, chapter 1 complete with exercise + solution, static + browser tests | A student can complete chapter 1 end-to-end on a phone; all §8 tests run in CI |
| **5 — Content** | One chapter per PR (§9.3), lint rules added just-in-time with each chapter; `layout`/`viewport` checks before chapters 13–14 | Per-chapter checklist |
| **6 — Activities & tools** | Parsons, quiz, tree view v1→v2, export/import progress, quick-fixes | Tests for each activity |
| **7 — Polish** | Landing cards with progress, glossary, accessibility audit, teacher guide (`site/professorat.html`), zip download in the free editor | Lighthouse a11y ≥ 95 on landing, a chapter and the editor |

Build the vertical slice (Phase 4) **before** writing many chapters: PyCat's history shows that content written before the validation and test machinery had to be revisited.

### 9.2 Per-PR conventions

- Branch per task (use the branch name the session assigns, if any).
- Commit messages in Catalan, imperative, descriptive ("Afegeix el tokenitzador d'HTML amb posicions de línia"); never the skip tokens of §1.3.
- Before pushing: `node --test tests/unit/*.test.mjs`, `node tests/course-static.mjs`, `node tests/course-browser.mjs`; re-read your own diff adversarially.
- Open the PR automatically. Body in Catalan with sections **Què canvia**, **Per què**, **Com comprovar-ho** (copy-paste steps for the owner: open the Cloudflare preview URL or `python3 -m http.server` in `site/`), **Tests** (commands and results), **Documentació** (what was updated in `docs/STATE.md`).
- Update `docs/STATE.md` in the same PR whenever behaviour, contracts, content or pending work change.

### 9.3 Per-chapter workflow

1. Read `docs/CURRICULUM.md` for chapter N and the previous chapter for tone and continuity.
2. Add vocabulary entries (`since: N`) and any lint rules the chapter introduces (with unit tests and Catalan messages).
3. Write `site/curs/capitol-N.html` with the skeleton (§5.1): sections, examples, "Errors típics", "Exercici", optional "Troba l'error", "Codi net", "Resum".
4. Add the entry to `CAPITOLS`; write `tests/solutions/cap-N-ex/…`.
5. Run all tests; open the page at 360 px and 1280 px; complete the exercise by hand; confirm the starter fails and the solution passes.
6. Proofread the Catalan prose (accents, apostrophes, typographic quotes « », consistent terminology with the glossary).
7. Update `docs/CURRICULUM.md` (status) and `docs/STATE.md`; open the PR.

---

## 10. Documentation discipline

| File | Audience | Content | Update rule |
|---|---|---|---|
| `CLAUDE.md` | Agents | ≤ 80 lines: constraints (§2), commands, conventions, "read `docs/STATE.md` first", owner agreement (§1.3) | When a rule changes |
| `docs/STATE.md` | Agents + owner | File map, module contracts, authoring format, storage keys, checks DSL, decisions log (date, decision, reason), pending work | **Same commit** as any change it describes |
| `docs/CURRICULUM.md` | Content work | Chapter/repte plan with status, `afterChapter`, goal ids | Same commit as content changes |
| `docs/BLUEPRINT.md` | Rationale | This document | Only to annotate reversed decisions |
| `README.md` | Humans (Catalan) | What it is, how to run locally, how to contribute, licence block | Rarely |

No other planning files. Delete plans once executed (Git history keeps them).

---

## 11. Open decisions — ask the owner once, at kickoff (recommended default first)

| Id | Question | Recommended default |
|---|---|---|
| D1 | What does `/` show? | Landing page with course cards and progress; free editor at `/editor/` |
| D2 | CSS file name in exercises | `estils.css` (Catalan, "full d'estils") |
| D3 | When do exercises switch from `fragment` to `document` mode? | Chapter 1 teaches the full skeleton; chapters 2–5 use fragments; from chapter 6 exercises are full documents |
| D4 | Auto-close tags in the editor? | Off (students must learn to close); offer a quick-fix from chapter 4 |
| D5 | Allow external images/fonts in student pages? | Blocked by CSP; local asset pack (privacy of minors, deterministic tests) |
| D6 | Theme | Light by default, dark via `prefers-color-scheme` + toggle, tokens only |
| D7 | Fonts | Self-hosted Space Mono (code/brand) + an OFL sans-serif for prose |
| D8 | Domain | `htmlcat.step-quiz.net` |
| D9 | Curriculum | The 15 chapters + ~12 reptes of §7 (Grid as optional extra) |
| D10 | Relationship with JSCat | HTMLCat recommended before JSCat Part B; cross-links both ways |
| D11 | Identifier language | English identifiers/classes in the engine, Catalan comments, Catalan in all student-facing content |
| D12 | Class/id naming taught to students | ASCII Catalan kebab-case without accents |

Record the answers in `docs/STATE.md` §Decisions.

---

## Appendix A — Verified browser behaviour (Chromium via Playwright 1.56, 2026-10-02)

Re-verify in Firefox and Safari (WebKit) during Phase 2 and add the results here.

| Experiment | Result |
|---|---|
| `<iframe sandbox="allow-same-origin" srcdoc>`: student `<script>` and `onclick` | Blocked ("Blocked script execution in 'about:srcdoc'…") |
| Same frame: parent reads `contentDocument`, `getComputedStyle(h1).color`, `styleSheets[0].cssRules` | Works: `rgb(255, 0, 0)`, `32px` |
| CSS `h1 { color: red; colr: blue; font-size: 32px }` → `cssRules[0].cssText` | `h1 { color: red; font-size: 32px; }` — invalid declarations are silently dropped (compare source vs CSSOM to detect them) |
| `CSS.supports('colr','initial')` / `('color','initial')` / `('width','100')` / `('width','100px')` / `('color','red font-size: 20px')` / `('background-color','vermell')` / `('--meu-color','red')` | `false` / `true` / `false` / `true` / `false` / `false` / `true` |
| `<p>text <b>negreta <i>cursiva</b> mal</i></p>` → `p.innerHTML` | `text <b>negreta <i>cursiva</i></b><i> mal</i>` — the parser silently creates a second `<i>`; source-level lint is mandatory |
| Relative `img src="img/gat.svg"` in srcdoc | Resolves against the **parent page URL** (`doc.baseURI` = parent URL); image loads |
| Parent-realm `click` listener on `contentDocument` (frame without `allow-scripts`) | Fires; `preventDefault()` on links works |
| Form submit without `allow-forms` | Blocked ("Blocked form submission … 'allow-forms' permission is not set"); **no `submit` event** |
| Form submit with `allow-forms` + parent `submit` listener + `preventDefault()` | Event fires, `FormData` readable (`nom=Ada`), frame stays on `about:srcdoc` |
| `<meta http-equiv="refresh">` in the sandboxed frame | Refused |
| Re-assigning an identical `srcdoc` value | `load` fired again in this Chromium run (JSCat reports it may not, depending on timing/browser) — never rely on it: skip identical updates, recreate the element if needed |
| `<script type="text/plain">` containing `<!DOCTYPE html>`, `&amp;`, `&copy;`, mis-nested tags, unclosed `<p>`, mixed quotes → `textContent` | **Byte-for-byte identical** to the source |
| Same content in `<template>` → `innerHTML` | Doctype, `<html>`, `<head>`, `<body>` removed; `&copy;` decoded to `©`; nesting "repaired"; unclosed `<p>` closed — **unusable** for an HTML course |

---

## Appendix B — Reference snippets

### B.1 `dedent`

```js
// site/js/util/text.js
export function dedent(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(cut)).join('\n') + '\n';
}
```

### B.2 Reading a simulator definition

```js
// site/js/sim/simulador.js (extract)
function readDefinition(el) {
  const files = {};
  const readonlyFiles = new Set();
  for (const block of el.querySelectorAll(':scope > script[type="text/plain"][data-file]')) {
    files[block.dataset.file] = dedent(block.textContent);
    if (block.hasAttribute('data-readonly')) readonlyFiles.add(block.dataset.file);
  }
  const checksBlock = el.querySelector(':scope > script[type="application/json"][data-checks]');
  return {
    id: el.dataset.id ?? null,
    goalId: el.dataset.goalId ?? null,
    mode: el.dataset.mode ?? 'fragment',
    readonly: el.hasAttribute('data-readonly'),
    forms: el.hasAttribute('data-forms'),
    height: Number(el.dataset.height ?? 360),
    files,
    readonlyFiles,
    checks: checksBlock ? JSON.parse(checksBlock.textContent) : [],
  };
}
```

### B.3 Preview update with scroll restore and interception

```js
// site/js/preview/preview.js (extract)
export function createPreview(frame, { onLoad, onLinkClick, onSubmit }) {
  let lastSrcdoc = null;
  let scroll = { x: 0, y: 0 };

  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    if (!doc) return;
    frame.contentWindow.scrollTo(scroll.x, scroll.y);
    doc.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      e.preventDefault();
      onLinkClick(link.getAttribute('href'), doc);
    }, true);
    doc.addEventListener('submit', (e) => {
      e.preventDefault();
      onSubmit(new FormData(e.target));
    }, true);
    onLoad(doc);
  });

  return {
    render(srcdoc) {
      if (srcdoc === lastSrcdoc) return;
      const win = frame.contentWindow;
      if (win) scroll = { x: win.scrollX, y: win.scrollY };
      lastSrcdoc = srcdoc;
      frame.srcdoc = srcdoc;
    },
  };
}
```

### B.4 Check result shape

```js
/**
 * @typedef {{ type: string, msg: string, [key: string]: unknown }} Check
 * @typedef {{ check: Check, passed: boolean, detail?: string }} CheckResult
 *   detail: optional Catalan precision, e.g. "N'hi ha 2, en calen almenys 3."
 */
```

---

## Appendix C — Initial lint rule catalogue

`since` = chapter of §7. Severity: E error, W warning, I info. Phase: S static, R rendered.

> **Note (2026-10-02):** the static rules up to chapter 9 are built; the real catalogue (with new ids and two `since` changes) is in `docs/STATE.md` §2.6, which wins over this table.

| Id | Since | Sev | Phase | Detects |
|---|---|---|---|---|
| `html/unclosed-element` | 1 | E | S | Non-void element never closed |
| `html/stray-end-tag` | 1 | E | S | `</x>` with no matching open element |
| `html/misnested` | 1 | E | S | `<b><i></b></i>` |
| `html/void-end-tag` | 1 | E | S | `</br>`, `</img>` |
| `html/p-closed-by-block` | 2 | E | S | Block element inside `<p>` (the browser closes the `<p>` early) |
| `html/duplicate-attribute` | 1 | E | S | Same attribute twice |
| `html/uppercase` | 1 | W | S | Uppercase tag/attribute names |
| `html/indentation` | 1 | W | S | Child not indented exactly one level (2 spaces) deeper than its parent block |
| `html/unquoted-attribute` | 1 | W | S | `class=titol` |
| `html/doctype` · `html/lang` · `html/charset` · `html/title` | 1 | E/W | S | Document-level requirements (document mode) |
| `html/unknown-element` | 2 | E | S | `<titel>`, `<parragraf>` |
| `html/heading-order` | 2 | W | S | `h1` → `h3` skipping a level |
| `html/single-h1` | 2 | W | S | More than one `h1` |
| `html/br-spacing` | 2 | W | S | Two or more consecutive `<br>` |
| `html/deprecated-element` | 2 | W | S | `font`, `center`, `big`, `marquee` |
| `html/list-structure` | 3 | E | S | `li` outside `ul`/`ol`; non-`li` child of a list |
| `html/missing-href` · `html/empty-link` · `html/vague-link-text` | 4 | E/W/I | S | Link quality |
| `html/duplicate-id` | 4 | E | S | Same `id` twice |
| `html/missing-anchor` | 4 | W | R | `href="#x"` with no `id="x"` |
| `html/unknown-attribute` | 5 | E | S | `scr`, `atl`, `hreff` (suggest the closest known name) |
| `html/img-alt` | 5 | E | S | `img` without `alt` |
| `html/image-not-found` | 5 | E | R | `naturalWidth === 0` after load |
| `html/single-main` | 6 | W | S | Zero or several `main` |
| `html/table-structure` · `html/th-scope` | 7 | E/I | S | Table rules |
| `html/control-label` | 8 | E | S | Form control without an associated `label` |
| `html/inline-style` | 9 | W | S | `style=""` |
| `css/unbalanced-braces` | 9 | E | S | Missing `}` or extra `}` |
| `css/missing-semicolon` | 9 | E | S | Declaration not terminated (value swallows the next property) |
| `css/unknown-property` | 9 | E | S | `CSS.supports(prop, 'initial') === false` (suggest the closest known name) |
| `css/invalid-value` | 9 | E | S | `CSS.supports(prop, value) === false` (special messages: missing unit, Catalan colour name, comma decimal) |
| `css/selector-matches-nothing` | 10 | W | R | `querySelectorAll(selector).length === 0` in the preview |
| `css/important` | 10 | W | S | `!important` |
| `css/id-selector` | 10 | I | S | Styling through `#id` |
| `css/duplicate-declaration` | 10 | W | S | Same property twice in a rule |
| `css/generic-font-family` | 11 | W | S | `font-family` without `serif`/`sans-serif`/`monospace` fallback |
| `css/low-contrast` | 11 | W | R | Text/background contrast below 4.5:1 (computed colours) |
| `css/indentation` · `css/one-declaration-per-line` | 9 | W | S | House style (§6.2) |

---

## Appendix D — Where to look in the sibling repos

Both repos are public (`step-quiz/pycat`, `step-quiz/jscat`); add them to your session if you need to read code. Most useful files:

- `pycat/curs/capitols.js` — course data, `initCursPage`, progress, sidebar, diff table, fullscreen.
- `pycat/js/editor.js` — overlay editor, `editText`, indentation logic, autocomplete.
- `pycat/js/errors.js` — rule-table pattern for Catalan explanations.
- `pycat/curs/activitats.js` — Parsons and quizzes (seeded RNG).
- `pycat/tests/comprova-curs.py` — test invariants.
- `pycat/curs/capitol-4.html` — reference for content tone and structure.
- `jscat/js/domrunner.js` — iframe recreation pattern and the DOM-mode bootstrap.
- `pycat/docs/CURRENT-STATE.md` — a good *format* for `docs/STATE.md` (keep its "Regla d'or": an outdated state document is more dangerous than none).
