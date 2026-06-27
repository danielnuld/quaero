# General Rules

1. **Language:** Use **English** for all code, comments, identifiers, technical
   documentation under `docs/`, and commit messages. User-facing product strings
   are localized (Spanish-first is fine for the maintainer-facing README/ROADMAP).
2. **Build tooling:**
   - C core and drivers → **CMake** (out-of-source build in `build/`).
   - Frontend → **pnpm** (never npm or yarn).
3. **Architecture invariants (non-negotiable):**
   - The C core (`libdbcore`) **never** imports anything from the UI.
   - Drivers interact with the core **only** through the vtable in `driver.h`.
   - The frontend talks to the core **only** through the IPC contract.
   - Every value crossing core → frontend is **JSON**; the frontend never sees
     native C or database types.
4. **No silent truncation.** Any limit (pagination, top-N, sampling) is explicit
   and reported to the caller/UI.
5. **Honest failure over fake success.** Unsupported operations return a clear
   error, never an empty "ok".
