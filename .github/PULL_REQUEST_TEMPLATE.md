<!-- Follow AGENTS.md and the files in .rules/ -->

## What & why

<!-- What does this change and which issue does it address? -->
Closes #

## Checklist

- [ ] Layers respected (core has no UI; drivers use only the vtable; frontend only via IPC)
- [ ] Pure logic extracted into focused modules
- [ ] Tests added/updated (nominal, edge, unsupported) and passing
- [ ] `ctest` and/or `pnpm test` green locally
- [ ] Docs updated if the IPC/vtable contract changed
- [ ] Conventional Commit, English, **no `Co-Authored-By` trailer**
- [ ] For drivers: every advertised capability has a backing handler
