# Driver vtable checklist

Use when implementing or reviewing a Quaero driver.

## Entry & ABI
- [ ] Exports `const dbc_driver_t *dbc_driver_entry(void)`
- [ ] Sets `abi_version = DBC_ABI_VERSION`
- [ ] `name`, `display_name` set; `features` bitmask matches reality

## Connection
- [ ] `connect` parses the JSON DSN (no engine-specific params leak to the core)
- [ ] `disconnect` frees all resources
- [ ] `last_error` returns a human-readable message after any failure
- [ ] credentials are never persisted by the driver

## Query & result set
- [ ] `query` handles SELECT, DDL and DML
- [ ] `col_count` / `col_name` / `col_type` correct; `col_type` returns `dbc_type`
- [ ] `next_row` returns 1/0; `cell_text` returns NULL for SQL NULL
- [ ] `rows_affected` correct for DML
- [ ] `free_result` releases everything

## Introspection
- [ ] `list_databases` / `list_schemas` / `list_tables` / `describe_table`
- [ ] returns empty (not error) when the engine genuinely has none

## Transactions
- [ ] `begin` / `commit` / `rollback`, or `DBC_ERR_UNSUPPORTED` if not supported

## Types
- [ ] every engine type maps to a `dbc_type`; unknown → TEXT
- [ ] NULL handled distinctly from empty string

## Tests
- [ ] identifier quoting (incl. names needing escaping)
- [ ] SQL builders (CREATE/ALTER/DROP)
- [ ] type mapping table
- [ ] pagination math (limit/offset boundaries)
- [ ] one real-connection smoke test

## Build
- [ ] `cmake --build build` clean with `-Werror`
- [ ] `ctest --output-on-failure` green
