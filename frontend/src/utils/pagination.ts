// Engine-aware row cap for the "open table" preview SELECT.
//
// The core paginates by fetching rows and truncating (it never rewrites SQL, see
// core/src/query/materialize.c), so the cap baked into this SELECT is only an
// optimization: it stops the driver from buffering an entire (possibly huge)
// table before the core trims it. That cap must use each engine's own syntax —
// most speak `LIMIT n`, but Informix uses `SELECT FIRST n ...` (LIMIT is a
// syntax error there). Pure and unit-tested; the caller supplies the already-
// quoted, fully-qualified table reference.

import { engineFamily } from "./engineFamily";

/**
 * A capped `SELECT *` over `qualified` for a data preview, in the dialect of
 * `engine`. Informix emits `SELECT FIRST n * FROM t`; every other engine emits
 * `SELECT * FROM t LIMIT n`. `limit` is floored and treated as at least 1.
 */
export function previewSelect(qualified: string, engine: string, limit: number): string {
  const n = Math.max(1, Math.floor(limit));
  if (engineFamily(engine) === "informix") {
    return `SELECT FIRST ${n} * FROM ${qualified};`;
  }
  return `SELECT * FROM ${qualified} LIMIT ${n};`;
}
