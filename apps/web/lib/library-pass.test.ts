import { describe, expect, it } from "vitest";
import { extendLibraryPass, hasLibraryPass, libraryPassDaysLeft } from "./library-pass";

const NOW = Date.parse("2026-10-21T12:00:00.000Z");

describe("library pass", () => {
  it("is off with no pass, a past pass, or junk", () => {
    expect(hasLibraryPass(null, NOW)).toBe(false);
    expect(hasLibraryPass("2026-10-01T00:00:00.000Z", NOW)).toBe(false);
    expect(hasLibraryPass("not a date", NOW)).toBe(false);
  });

  it("is on before its end", () => {
    expect(hasLibraryPass("2026-10-22T00:00:00.000Z", NOW)).toBe(true);
  });

  it("starts from now when there is no live pass", () => {
    expect(extendLibraryPass(null, 30, NOW)).toBe("2026-11-20T12:00:00.000Z");
    expect(extendLibraryPass("2026-01-01T00:00:00.000Z", 30, NOW)).toBe("2026-11-20T12:00:00.000Z");
  });

  it("stacks on the end of a live pass", () => {
    expect(extendLibraryPass("2026-10-31T12:00:00.000Z", 30, NOW)).toBe("2026-11-30T12:00:00.000Z");
  });

  it("counts days left rounded up", () => {
    expect(libraryPassDaysLeft("2026-10-21T13:00:00.000Z", NOW)).toBe(1);
    expect(libraryPassDaysLeft("2026-11-20T12:00:00.000Z", NOW)).toBe(30);
    expect(libraryPassDaysLeft(null, NOW)).toBe(0);
  });
});
