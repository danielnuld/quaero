---
name: quaero-feature
description: "Use when implementing any Quaero feature, issue, or bug fix. The single, consistent development workflow for the project: understand via CodeGraph, respect the layers, extract pure logic, test everything, build green, commit cleanly without co-author."
---

# Quaero Feature Workflow

The standard, repeatable way to land any change in Quaero so the codebase stays
consistent and fully tested. Use it for every issue. Follow `AGENTS.md` and the
files in `.rules/`.

## 1. Understand before editing
- Identify the milestone/issue and acceptance criteria.
- Use CodeGraph (`codegraph_search`, `codegraph_context`, `codegraph_impact`)
  to find symbols and assess blast radius **before** changing anything. Report
  HIGH/CRITICAL impact to the user. Do not re-verify CodeGraph results with grep.
- Re-read the relevant rule file(s): `c-core.md`, `drivers.md`, `frontend.md`,
  `ipc.md`.

## 2. Decide the layer
- Pure data/logic → C core (`libdbcore`), in a focused module.
- Engine-specific behaviour → a driver (use the `quaero-driver` skill).
- Presentation/interaction → frontend, talking to the core only via IPC.
- Touching the core↔frontend boundary? Update `docs/IPC.md` first and bump the
  protocol version (see `.rules/ipc.md`).

## 3. Implement
- Extract pure helpers (parsing, SQL building, quoting, value/type conversion,
  pagination) into small modules. Keep orchestration/entry files thin.
- Keep public APIs stable; do not mix structural refactors with behaviour
  changes in one commit.

## 4. Test (mandatory)
- C: add tests under the parallel `tests/` tree; cover nominal, edge, and
  unsupported cases. SQL generators tested across more than one driver.
- Frontend: add vitest tests under `tests/` mirroring `src/`.
- A change is not done until its tests exist and pass.

## 5. Build green
- Core: `cmake --build build && ctest --test-dir build --output-on-failure`
- Frontend: `pnpm test` (and `pnpm build` if assets/bundling changed)

## 6. Commit & PR
- Conventional Commit, English, scoped, referencing the issue
  (e.g. `feat(sqlite): add describe_table (refs #18)`).
- **Never** add a `Co-Authored-By` trailer or any AI attribution.
- Branch `type/<issue>-slug`; open a PR (once the repo is public).

## Definition of done
- [ ] Acceptance criteria of the issue met
- [ ] Layers respected (core has no UI; frontend only via IPC)
- [ ] Pure logic extracted and unit-tested
- [ ] Build + tests green
- [ ] Docs updated if the IPC/vtable contract changed
- [ ] Clean Conventional Commit, no co-author trailer
