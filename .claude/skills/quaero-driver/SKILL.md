---
name: quaero-driver
description: "Use when creating or updating a Quaero database driver plugin in C. Covers the vtable contract, modular plugin layout, capability honesty, feature-coverage targets, and validation (build + ctest + smoke). Adapt the SQLite reference driver."
---

# Quaero Driver

Use this skill to build or extend a Quaero database driver. A driver is a shared
library (`.dll`/`.so`/`.dylib`) that implements the vtable and is loaded at
runtime by `libdbcore`.

Always follow `AGENTS.md`, `.rules/drivers.md`, `.rules/c-core.md`,
`.rules/testing.md`, and the current contract in `docs/DRIVER_API.md`.

## Goals

- Implement the C vtable (`dbc_driver_t`) and the `dbc_driver_entry` export.
- Keep the plugin modular — never concentrate logic in the entry file.
- Reach feature coverage comparable to the SQLite/PostgreSQL reference drivers
  where the target engine supports it.
- Be honest about capabilities; fail explicitly on unsupported operations.
- Unit-test every pure helper.

## Default plugin layout

```text
drivers/<engine>/
├── CMakeLists.txt
├── README.md
├── src/
│   ├── entry.c          # thin: dbc_driver_entry + vtable wiring + dispatch
│   ├── connection.c     # connect/disconnect, DSN(JSON) parse, last_error
│   ├── query.c          # execute, result iteration, rows_affected
│   ├── metadata.c       # databases/schemas/tables/columns/indexes/FKs/views
│   ├── ddl.c            # CREATE/ALTER/DROP generation
│   └── utils/
│       ├── identifiers.c # quoting/escaping
│       ├── types.c       # engine type -> dbc_type
│       ├── values.c      # value -> text/JSON
│       └── pagination.c  # LIMIT/OFFSET math
└── tests/
    ├── identifiers_test.c
    ├── types_test.c
    └── query_test.c
```

Keep `entry.c` thin: build the vtable, verify ABI, dispatch to handlers.

## Required research before coding

1. The contract: `docs/DRIVER_API.md` and the real `driver.h` header.
2. The loader: how `libdbcore` discovers plugins and validates `abi_version`.
3. A reference driver with broad coverage (SQLite first; later PostgreSQL).
4. The neutral type set (`dbc_type`) and how the core serializes result sets.

## Implementation workflow

### 1. Scope the capabilities
From the engine + its client library, decide which `features` are truly backed:
schemas, views, routines, file-based, connection-string, identifier quoting,
alter column/PK, foreign keys, transactions, readonly, SSL/SSH. Do not advertise
what you cannot implement.

### 2. Implement the vtable in priority order
- `connect` / `disconnect` / `last_error`
- `query` / result iteration (`col_count`, `col_name`, `col_type`, `next_row`,
  `cell_text`) / `free_result` / `rows_affected`
- introspection: `list_databases`, `list_schemas`, `list_tables`,
  `describe_table`
- transactions: `begin` / `commit` / `rollback`
- DDL generation
Classify each area `supported` / `partially_supported` / `unsupported`. For
`unsupported`, return `DBC_ERR_UNSUPPORTED` — never fake success.

### 3. Push pure logic into `utils/`
Identifier quoting, type mapping, value serialization and pagination math are
pure functions and are where the tests live.

## Testing strategy

Unit-test (CTest): identifier quoting, SQL builders, type normalization,
pagination, value serialization. Add a smoke test that opens a real connection
and runs a `SELECT` plus a DDL/DML round-trip where feasible.

## Validation checklist

Before finishing — see [references/vtable-checklist.md](./references/vtable-checklist.md):

- [ ] `cmake --build build` clean (no warnings, `-Werror`)
- [ ] `ctest --output-on-failure` green
- [ ] smoke: a real query round-trips through the driver
- [ ] every advertised `feature` has a backing handler
- [ ] unsupported operations return clear errors
- [ ] entry file is thin; logic is split by responsibility
- [ ] proprietary client (if any) builds as a standalone plugin, not linked into the core

## Common mistakes

- Advertising a capability with no handler behind it.
- Returning empty success for an operation that should be unsupported.
- Putting connection, query, metadata and DDL in one file.
- Skipping tests for identifier quoting and SQL generation.
- Linking a proprietary client library into the GPL core.
