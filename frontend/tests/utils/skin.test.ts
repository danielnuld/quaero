import { describe, it, expect } from "vitest";
import { loadSkin, saveSkin, applySkin, skinLabel, SKIN_KEY } from "../../src/utils/skin";

function memStore(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    _m: m,
  };
}

describe("skin (accent selection)", () => {
  it("defaults to the indigo brand", () => {
    expect(loadSkin(memStore())).toBe("indigo");
    expect(loadSkin(memStore({ [SKIN_KEY]: "bogus" }))).toBe("indigo");
    expect(loadSkin(undefined)).toBe("indigo");
  });

  it("loads a persisted navicat skin", () => {
    expect(loadSkin(memStore({ [SKIN_KEY]: "navicat" }))).toBe("navicat");
  });

  it("round-trips via save/load", () => {
    const s = memStore();
    saveSkin("navicat", s);
    expect(s._m.get(SKIN_KEY)).toBe("navicat");
    expect(loadSkin(s)).toBe("navicat");
  });

  it("stamps data-skin on the root (always, even for the default)", () => {
    let attr: [string, string] | null = null;
    const root = { setAttribute: (k: string, v: string) => (attr = [k, v]) };
    applySkin("navicat", root);
    expect(attr).toEqual(["data-skin", "navicat"]);
    applySkin("indigo", root);
    expect(attr).toEqual(["data-skin", "indigo"]);
  });

  it("labels both skins", () => {
    expect(skinLabel("navicat")).toMatch(/Navicat/);
    expect(skinLabel("indigo")).toMatch(/índigo|Quaero/);
  });
});
