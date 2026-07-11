import { describe, expect, it } from "vitest";
import { normalizeSearchMediaType, normalizeSearchSort, searchFeedParams, searchPagePathFromParams } from "./search-feed";

describe("search feed params", () => {
  it("preserves the public search filters that affect feed results", () => {
    const params = searchFeedParams({
      q: "  portrait  ",
      tag: "photography",
      mediaType: "video",
      sort: "trending",
      featuredOnly: true,
    });

    expect(params.toString()).toBe("q=portrait&tag=photography&media_type=video&sort=trending&featured=1");
    expect(searchPagePathFromParams(params)).toBe("/search?q=portrait&tag=photography&media_type=video&sort=trending&featured=1");
  });

  it("omits empty filters and the default newest sort", () => {
    const params = searchFeedParams({ q: "   ", sort: "newest" });

    expect(params.toString()).toBe("");
    expect(searchPagePathFromParams(params)).toBe("/search");
  });

  it("normalizes URL-provided filters before querying", () => {
    expect(normalizeSearchSort("hardest")).toBe("hardest");
    expect(normalizeSearchSort("unknown")).toBe("newest");
    expect(normalizeSearchMediaType("image")).toBe("image");
    expect(normalizeSearchMediaType("audio")).toBeUndefined();
  });
});
