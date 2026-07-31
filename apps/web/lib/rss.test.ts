import { describe, it, expect } from "vitest";
import { buildRss, mediaCardsToFeed } from "./rss";
import type { MediaCard } from "./queries";

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

describe("mediaCardsToFeed", () => {
  const card = (mediaUrl: string): MediaCard => ({
    id: "media-1",
    slug: "photo",
    title: "Photo",
    description: null,
    mediaType: "image",
    mediaUrl,
    thumbnailUrl: null,
    posterUrl: null,
    sourceUrl: null,
    sourceProvider: null,
    truthLabel: "unknown",
    truthConfidence: "unverified",
    revealStatus: "revealed",
    isFeatured: false,
    isScoreEligible: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    approvedAt: "2026-01-01T00:00:00.000Z",
    stats: {
      aiGuesses: 0,
      notAiGuesses: 0,
      totalGuesses: 0,
      crowdAccuracy: 0,
      aiPct: 0,
    },
    tags: [],
  });

  const channel = {
    title: "Latest",
    link: "https://aiornot.vote",
    feedUrl: "https://aiornot.vote/rss.xml",
    description: "Latest media",
  };

  it("uses the image URL's actual MIME type for RSS enclosures", () => {
    const xml = mediaCardsToFeed(
      [
        card("https://cdn.example/photo.jpg"),
        { ...card("https://cdn.example/generated.webp?width=1200"), id: "media-2", slug: "generated" },
      ],
      channel,
    );

    expect(xml).toContain('url="https://cdn.example/photo.jpg" type="image/jpeg"');
    expect(xml).toContain(
      'url="https://cdn.example/generated.webp?width=1200" type="image/webp"',
    );
  });

  it("omits an enclosure when the image MIME type cannot be inferred", () => {
    const xml = mediaCardsToFeed(
      [card("https://picsum.photos/seed/example/1000/1250")],
      channel,
    );

    expect(xml).not.toContain("<enclosure");
    expect(xml).toContain(
      '<img src="https://picsum.photos/seed/example/1000/1250"',
    );
  });
});
