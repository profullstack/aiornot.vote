import { describe, expect, it } from "vitest";
import { readBoundedInteger } from "./bounded-integer";

const options = { fallback: 3, min: 1, max: 10 };

describe("readBoundedInteger", () => {
  it("accepts decimal integer strings and numbers", () => {
    expect(readBoundedInteger("7", options)).toBe(7);
    expect(readBoundedInteger(8, options)).toBe(8);
  });

  it("clamps valid integers into the configured bounds", () => {
    expect(readBoundedInteger("0", options)).toBe(1);
    expect(readBoundedInteger("100", options)).toBe(10);
  });

  it("falls back for non-decimal or malformed values", () => {
    expect(readBoundedInteger("1e2", options)).toBe(3);
    expect(readBoundedInteger("0x10", options)).toBe(3);
    expect(readBoundedInteger("-1", options)).toBe(3);
    expect(readBoundedInteger("1.5", options)).toBe(3);
    expect(readBoundedInteger("", options)).toBe(3);
    expect(readBoundedInteger(null, options)).toBe(3);
  });

  it("falls back for unsafe or non-finite numbers", () => {
    expect(readBoundedInteger(1.5, options)).toBe(3);
    expect(readBoundedInteger(Infinity, options)).toBe(3);
    expect(readBoundedInteger(Number.MAX_SAFE_INTEGER + 1, options)).toBe(3);
  });
});
