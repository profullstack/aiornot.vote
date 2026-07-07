import { describe, it, expect } from "vitest";
import { buildRss } from "./rss";

describe("buildRss", () => {
  const xml = buildRss({
    title: "AIorNot & <friends>",
    link: "https://aiornot.vote",
    feedUrl: "https://aiornot.vote/rss.xml",
    description: "Latest media",
    items: [
      {
        title: "Is this <b>real</b>?",
        link: "https://aiornot.vote/m/x",
        guid: "media:1",
        pubDate: "2026-01-01T00:00:00.000Z",
        descriptionHtml: "<p>hello]]></p>",
        categories: ["portrait"],
      },
    ],
  });

  it("is a valid rss envelope", () => {
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("<channel>");
    expect(xml).toContain("<lastBuildDate>");
  });
  it("escapes channel + item titles", () => {
    expect(xml).toContain("AIorNot &amp; &lt;friends&gt;");
    expect(xml).toContain("Is this &lt;b&gt;real&lt;/b&gt;?");
  });
  it("emits stable non-URL guids and categories", () => {
    expect(xml).toContain('<guid isPermaLink="false">media:1</guid>');
    expect(xml).toContain("<category>portrait</category>");
  });
  it("wraps description in CDATA and neutralises nested terminators", () => {
    expect(xml).toContain("<![CDATA[");
    expect(xml).not.toContain("hello]]></p>]]>");
  });
});
