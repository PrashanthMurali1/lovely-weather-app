import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { safeGet, safeSet } from "../src/lib/storage";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("safeGet/safeSet", () => {
  it("round-trips values", () => {
    safeSet("k", { a: 1 });
    expect(safeGet("k", null)).toEqual({ a: 1 });
  });
  it("returns fallback when missing", () => {
    expect(safeGet("nope", 5)).toBe(5);
  });
  it("returns fallback when getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(safeGet("k", "fb")).toBe("fb");
  });
  it("returns fallback on invalid JSON", () => {
    localStorage.setItem("k", "{not json");
    expect(safeGet("k", "fb")).toBe("fb");
  });
  it("swallows setItem exceptions", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => safeSet("k", 1)).not.toThrow();
  });
});
