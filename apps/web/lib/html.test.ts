import { describe, expect, it } from "vitest";
import { escapeHtml } from "./html";

describe("escapeHtml", () => {
  it("escapes special HTML characters", () => {
    expect(escapeHtml(`<b onclick="x">Tom & Jerry's</b>`)).toBe(
      "&lt;b onclick=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/b&gt;",
    );
  });

  it("handles nullish values", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});
