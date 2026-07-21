import { describe, expect, it } from "vitest";
import { POOL_DIR, poolKey } from "@aiornot/seed";

// Regression guard for the media-source answer leak.
//
// Real (not-AI) photos used to be hotlinked from picsum.photos while AI photos
// were served from an `ai-variants/<time>-<rand>` object key. That made the
// image SOURCE (host + path) reveal the truth label: a scraper -- or anyone
// reading page source -- could score "AI or Not" perfectly without judging a
// single pixel. The fix routes BOTH real and AI images through one neutral
// pool with opaque, source-agnostic keys. These tests lock that invariant so
// it cannot silently regress.
describe("media pool keys", () => {
  it("produces an opaque key in the shared, label-neutral pool", () => {
    expect(poolKey()).toMatch(
      new RegExp(`^${POOL_DIR}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.png$`),
    );
  });

  it("never encodes the truth label or original source in the key", () => {
    for (let i = 0; i < 200; i++) {
      const key = poolKey();
      // The pre-fix leaks: the AI-only directory and the picsum host/marker.
      expect(key).not.toMatch(/ai-variants/i);
      expect(key).not.toMatch(/picsum/i);
      expect(key).not.toMatch(/\b(not_?ai|real|human|ai-|-ai)\b/i);
    }
  });

  it("returns a fresh, non-colliding key each call", () => {
    const keys = new Set(Array.from({ length: 1000 }, () => poolKey()));
    expect(keys.size).toBe(1000);
  });
});
