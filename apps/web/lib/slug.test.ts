import { describe, expect, it, vi } from "vitest";

// slug.ts pulls in ./db (and its `server-only` guard) for uniqueMediaSlug;
// slugify itself is pure, so stub both to keep this a fast unit test — matching
// the pattern in guess.test.ts / opinions.test.ts.
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ sqlClient: { execute: vi.fn() } }));

import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and joins words with single separators", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("AI or Not?")).toBe("ai-or-not");
    expect(slugify("Multiple   spaces & symbols!!")).toBe("multiple-spaces-symbols");
  });

  it("strips leading and trailing separators", () => {
    expect(slugify("  leading and trailing  ")).toBe("leading-and-trailing");
    expect(slugify("--dashes--")).toBe("dashes");
  });

  it("falls back to 'media' when nothing usable remains", () => {
    expect(slugify("")).toBe("media");
    expect(slugify("!!!")).toBe("media");
    expect(slugify("   ")).toBe("media");
  });

  it("caps the slug at 60 characters", () => {
    const slug = slugify("a".repeat(200));
    expect(slug.length).toBe(60);
  });

  it("never returns a trailing separator, even when truncation lands on one", () => {
    // Before the fix, trailing dashes were stripped *before* the 60-char cut,
    // so a slug longer than 60 chars could be truncated right after a "-" and
    // end up with a trailing separator (e.g. "word-word-...-word-").
    const slug = slugify("word ".repeat(20)); // -> "word-word-...", far over 60 chars
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug).toBe("word-word-word-word-word-word-word-word-word-word-word-word");
  });
});
