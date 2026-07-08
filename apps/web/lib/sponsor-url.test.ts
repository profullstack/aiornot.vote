import { describe, expect, it } from "vitest";
import { normalizeSponsorUrl } from "./sponsor-url";

describe("normalizeSponsorUrl", () => {
  it("allows empty sponsor links", () => {
    expect(normalizeSponsorUrl("")).toEqual({ ok: true, url: null });
    expect(normalizeSponsorUrl("   ")).toEqual({ ok: true, url: null });
    expect(normalizeSponsorUrl(null)).toEqual({ ok: true, url: null });
  });

  it("normalizes http and https links", () => {
    expect(normalizeSponsorUrl("https://example.com/path").ok).toBe(true);
    expect(normalizeSponsorUrl(" http://example.com ").ok).toBe(true);
  });

  it("rejects non-web protocols", () => {
    expect(normalizeSponsorUrl("javascript:alert(1)").ok).toBe(false);
    expect(normalizeSponsorUrl("mailto:test@example.com").ok).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(normalizeSponsorUrl("example dot com").ok).toBe(false);
  });
});
