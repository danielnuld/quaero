# Testing Conventions

Everything testable is tested. Tests run in CI and before any change is "done".

## C (core and drivers)

- **Framework:** CTest driving a lightweight unit framework (Unity or greatest).
- **Layout:** tests live in a parallel `tests/` tree mirroring the source:

  ```
  core/
    src/result.c
    src/sql/identifier.c
  tests/
    core/result_test.c
    core/sql/identifier_test.c
  drivers/sqlite/
    src/query.c
  drivers/sqlite/tests/
    query_test.c
  ```

- **What to test:** every extracted pure helper — identifier quoting, SQL
  builders, type mapping, pagination math, value/JSON serialization — with
  nominal, edge (NULL/empty/boundary), and unsupported-input cases.
- **Run:** `cmake --build build && ctest --test-dir build --output-on-failure`.

## Frontend

- **Framework:** vitest (`jsdom` for DOM-touching tests).
- **Layout:** `tests/` mirrors `src/`; test files named `[name].test.ts`;
  import from `../../src/...` (relative from `tests/`).
- **What to test:** every exported util in `src/utils/` — formatters, parsers,
  sort/filter logic, SQL generators (across multiple drivers where relevant) —
  including edge cases.
- **Run:** `pnpm test` (watch: `pnpm test --watch`; coverage: `pnpm test --coverage`).

## Organization

Mirror module structure with `describe` blocks (TS) / test groups (C). Name tests
by behaviour, not implementation.

## Coverage expectation

- All exported/public functions have tests.
- Edge and error conditions are covered.
- SQL generators are tested against more than one driver.
