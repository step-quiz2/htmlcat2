# HANDOFF — start here (for a Claude session with no prior context)

Last updated: 2026-10-02, after the project moved to `step-quiz2/htmlcat2` and the files
lost in that move were restored. Phases 0–2 were built by an earlier Claude session. Keep it short and current:
when you finish a phase, rewrite the "Where we are" and "Next task" sections.

## 1. What this is

HTMLCat: a static, build-free course (HTML + CSS + clean code) for 15-year-olds,
in Catalan, deployed by Cloudflare Pages from `main` (output dir `site/`,
`htmlcat.pages.dev`). Sibling projects: `step-quiz/pycat`, `step-quiz/jscat`.

Canonical repository: **`step-quiz2/htmlcat2`** (confirmed by the owner, 2026-10-02).
The history of phases 0–2 (PRs #1–#4) lives in the old repository; the code was
copied here by a GitHub web upload, which dropped every dot-file (see §6).

## 2. Read in this order

1. `CLAUDE.md` — constraints and the working agreement with the owner (short).
2. `docs/STATE.md` — single source of truth: files, module contracts (§2.1–2.5),
   decisions (§3, incl. pending D3, D4, D6–D12), tests (§4), deploy (§5), task list (§6).
3. `docs/BLUEPRINT.md` — design for everything not built yet. Phase 3 = §4.7 + Appendix C
   (lint rule catalogue); phase 4 = §4.8–4.13, §5, §8.
4. `docs/CURRICULUM.md` — only when writing content.

## 3. Where we are

- Phase 0 ✅ repo, licence, CI (`.github/workflows/ci.yml`, restored after the move).
- Phase 1 ✅ `site/js/lang/` (HTML tokenizer, source tree with structural problems,
  tolerant CSS parser) + `site/js/editor/highlight.js`.
- Phase 2 ✅ editor (`editor/editor.js`, `editing.js`), sandboxed preview
  (`preview/preview.js`, `srcdoc.js`), simulator component (`sim/simulador.js`),
  free editor at `site/editor/`, asset pack `site/recursos/`.
- 93 unit tests + static checks + browser checks (incl. an end-to-end editor test), all green.
- Still pending from phase 0 (owner's job): confirm Cloudflare Pages deploys
  `step-quiz2/htmlcat2` (it was connected to the old repo); confirm `/tests/` and `/docs/`
  return 404 on the deployed site; add custom domain `htmlcat.step-quiz.net`.

## 4. Next task: phase 3 — linter v1 + "⚠ Problemes" panel

Follow BLUEPRINT §4.7 and Appendix C. Concretely:

1. `site/js/lint/messages.ca.js`: Catalan `{ text, hint }` per rule id (tone: warm,
   2nd person singular, explain what the browser silently did and how to fix it).
2. `site/js/lint/rules-html.js`, `rules-css.js`, `lint.js`: map the existing problem
   codes of `html-model.js` and `css-parser.js` (STATE §2.1–2.2) to rule ids
   (`html/unclosed-element`, `css/missing-semicolon`, …) and add the source-only rules
   of Appendix C with `since <= 9` (uppercase, indentation, unquoted attribute,
   doctype/lang/charset/title in document mode, unknown element, heading order,
   single h1, br spacing, deprecated element, list structure, inline style,
   unknown property / invalid value via an injected `supports(prop, value)` —
   browser: `CSS.supports`; Node tests: a stub). Each rule has `since` (chapter),
   `severity`, `phase: 'static'`. The free editor enables all rules.
3. Panel in `sim/simulador.js`: list (max 10, errors first), click → caret to line,
   gutter marks via the existing `editor.setMarks([{ line, kind }])`, short
   `aria-live` status line ("2 errors, 1 avís"), debounce ≈ 400 ms.
4. Unit tests for every rule (positive + negative) and a test that every rule id has
   a message; extend the browser e2e test (type a broken tag → panel shows it →
   click → caret on that line). Update `docs/STATE.md` in the same PR.

Phase 4 after that: course shell, checks DSL, chapter 1 end-to-end (BLUEPRINT §9.1).

## 5. How to work (owner's rules — see also CLAUDE.md)

- Reply to the owner in **Catalan**; give copy-paste steps when they must act.
- Branch → commit (Catalan, descriptive) → push → **open the PR yourself** → owner merges.
  If the session's assigned branch was already merged, restart it from `origin/main`.
- Never put `[skip ci]`, `[ci skip]` or `[cf-pages-skip]` in a commit message.
- Before pushing, run (from repo root):
  ```bash
  node --test tests/unit/*.test.mjs        # a directory argument does NOT work on Node 22
  node tests/course-static.mjs
  cd tests && npm ci && node course-browser.mjs
  ```
  In a Claude Code cloud container Chromium is preinstalled: do not run `playwright install`.

## 6. Lessons learned in phases 0–2 (avoid repeating)

- **Never move or update files through the GitHub web UI** (BLUEPRINT A2). Moving the
  project to `htmlcat2` by web upload silently dropped `.github/workflows/ci.yml`,
  `.editorconfig` and `.gitignore`, so CI stopped running and STATE.md was wrong.
  `tests/course-static.mjs` now fails if any of them is missing.

- **Verify that doc edits really landed.** In phase 1 a `grep -c` returning 0 stopped an
  `&&` chain, so the STATE.md update silently never ran and the PR description was wrong.
  After editing docs, `git diff --stat` and re-read the section.
- **Security has two independent layers** in the preview: `sandbox="allow-same-origin"`
  (never `allow-scripts`) and a CSP meta with `default-src 'none'`. The CSP alone also blocks
  scripts, so a behavioural test cannot detect a sandbox regression: the e2e test asserts
  the `sandbox` attribute and the CSP content directly. Keep both assertions.
- Playwright reports CSP-blocked requests as `requestfailed` with `errorText === 'csp'`;
  they never reach the network.
- Nodes inside the preview iframe belong to another realm: `x instanceof Element` is false;
  use feature checks (`typeof x.closest === 'function'`).
- `Element.append()` returns `undefined` (a phase 2 bug caught by the browser test).
- The static check strips `<script type="text/plain">` blocks before scanning tags
  (they are student code, checked separately in phase 4).
- Test the tests: break something on purpose and confirm the test fails, then restore.
