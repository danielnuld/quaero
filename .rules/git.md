# Git Rules

1. **Conventional Commits**, in English: `type(scope): subject`.
   Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`.
   Scope is the component: `core`, `sqlite`, `postgres`, `frontend`, `ipc`, `build`.
   Example: `feat(sqlite): implement describe_table introspection`.
2. **Never add a `Co-Authored-By` trailer**, and never include any
   Claude/Anthropic/AI attribution in commit messages. The history is the
   maintainer's authorship.
3. **Reference issues** in the body or subject (`refs #12`, `closes #12`).
4. **Branch per issue:** `feat/12-sqlite-driver`, `fix/30-csv-export`. Do not
   commit directly to `main` once the repo is public; open a PR.
5. **One concern per commit.** Keep structural refactors separate from behaviour
   changes (mirrors the C core rules).
6. **Green before commit:** build and tests pass locally first.
