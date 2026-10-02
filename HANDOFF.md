# HANDOFF — start here (for a Claude session with no prior context)

Last updated: 2026-10-02, after phase 3 (linter + "⚠ Problemes" panel).
Keep it short and current: when you finish a phase, rewrite the "Where we are" and
"Next task" sections.

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
- Phase 3 ✅ linter (`site/js/lint/`: 35 rules up to chapter 9, Catalan messages, STATE §2.6)
  and the "⚠ Problemes" panel (`sim/problems-panel.js`, STATE §2.4).
- 152 unit tests + static checks + browser checks (end-to-end editor and panel tests), all green.
- Still pending from phase 0 (owner's job): confirm Cloudflare Pages deploys
  `step-quiz2/htmlcat2` (it was connected to the old repo); confirm `/tests/` and `/docs/`
  return 404 on the deployed site; add custom domain `htmlcat.step-quiz.net`.

## 4. Next task: phase 4 — course vertical slice (chapter 1 end-to-end)

Follow BLUEPRINT §9.1 (phase 4), §4.8–4.12, §5 and §8. Before writing chapter 1,
ask the owner to confirm D3 (fragment vs document), D9 (curriculum) and D12
(class/id naming): STATE §3. Concretely:

1. `site/js/course/data.js` (`CAPITOLS`, `REPTES`) and `course/shell.js`
   (`initCoursePage()`: topbar, sidebar with ✓, prev/next, footer) reading
   `body[data-pagina][data-num]` — never `location` (A9).
2. `course/progress.js` (`progress` key, STATE §2.5) and the checks DSL v1:
   `checks/schema.js` (pure) + `checks/checks.js`, evaluated in a hidden 800×600
   check frame; "✓ Comprova" button and "✓ Comprovacions" panel (`data-goal-id`,
   `data-checks`). The `lint` check type can reuse `lintStatic` (STATE §2.6).
3. Mount simulators with `mountSimulator(el, { chapter })` (page `data-num`) so the
   linter only applies what has been taught; lazy mount with `IntersectionObserver`.
4. `site/curs/capitol-1.html` + `tests/solutions/cap-1-ex/`; static checks of §8.2 and
   browser checks of §8.3 (solution passes, starter fails, every simulator mounts).

Linter follow-ups (later): rendered rules (`html/missing-anchor`, `image-not-found`,
`css/selector-matches-nothing`, `low-contrast`), rules for chapters 4–14 (one chapter
at a time), quick-fixes (phase 6).

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
