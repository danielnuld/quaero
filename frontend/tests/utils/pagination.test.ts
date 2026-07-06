import { describe, it, expect } from "vitest";
import { previewSelect } from "../../src/utils/pagination";

describe("previewSelect", () => {
  it("uses LIMIT for LIMIT-dialect engines", () => {
    expect(previewSelect("`t`", "mysql", 1000)).toBe("SELECT * FROM `t` LIMIT 1000;");
    expect(previewSelect('"t"', "postgres", 500)).toBe('SELECT * FROM "t" LIMIT 500;');
    expect(previewSelect('"t"', "sqlite", 50)).toBe('SELECT * FROM "t" LIMIT 50;');
  });

  it("uses FIRST for Informix (LIMIT is a syntax error there)", () => {
    expect(previewSelect("stores.informix.customer", "informix", 1000)).toBe(
      "SELECT FIRST 1000 * FROM stores.informix.customer;",
    );
  });

  it("normalizes the engine name via engineFamily (mariadb → mysql)", () => {
    expect(previewSelect("`t`", "mariadb", 100)).toBe("SELECT * FROM `t` LIMIT 100;");
  });

  it("floors and clamps the limit to at least 1", () => {
    expect(previewSelect("t", "mysql", 10.9)).toBe("SELECT * FROM t LIMIT 10;");
    expect(previewSelect("t", "informix", 0)).toBe("SELECT FIRST 1 * FROM t;");
  });
});
