# C Core Rules

Conventions for `libdbcore` and any C code. Adapted from the same philosophy
Tabularis applies to its Rust backend: thin orchestration, pure testable helpers.

1. **Standard & flags:** C11. Build with `-Wall -Wextra -Werror` (MSVC: `/W4 /WX`).
   No new warnings.
2. **Keep entry/orchestration files thin.** A module's top-level file
   (`*.c` that owns a subsystem) holds public orchestration and wiring. Extract
   parsers, identifier quoting, SQL string helpers, value conversion and
   pagination math into focused sibling modules.
3. **Preserve public APIs during refactors.** When moving a public function,
   keep its declared header path stable so call sites don't change. Do not mix
   behavioural changes with structural refactors in the same commit.
4. **Prefer pure helper modules.** Small functions with no global state and no
   I/O are the default unit of logic — they are what tests target.
5. **Memory ownership is documented.** Every function that allocates states who
   frees. Use opaque handles (`dbc_conn`, `dbc_result`) across boundaries.
6. **Error handling:** return `dbc_status`; never `abort()` or `exit()` in
   library code. Human-readable detail goes through `last_error`.
7. **No UI knowledge in the core.** If logic needs UI state, it belongs in the
   frontend, not here.
8. **Tests are mandatory** for every extracted helper — see `testing.md`.
