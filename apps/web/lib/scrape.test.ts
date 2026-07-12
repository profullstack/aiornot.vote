import { afterEach, describe, expect, it, vi } from "vitest";
import { scrapeUrl } from "./scrape";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scrapeUrl redirect guard", () => {
  it("blocks redirects to private hosts before following them", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1/secret" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(scrapeUrl("https://example.com/post")).rejects.toThrow("Redirect URL");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows safe redirects and scrapes the final page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "/final" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          "<html><head><meta property=\"og:title\" content=\"Safe post\"><meta property=\"og:description\" content=\"Crowd check\"></head></html>",
          { status: 200, headers: { "content-type": "text/html" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const post = await scrapeUrl("https://example.com/post");

    expect(post.title).toBe("Safe post");
    expect(post.body).toBe("Crowd check");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://example.com/final");
  });

  it("decodes common named and numeric HTML entities", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        `<html><head>
          <meta property="og:title" content="AI&apos;s &#8217;test&#x2014;case">
          <meta property="og:description" content="Tom &amp;amp; Jerry &nbsp; check">
        </head></html>`,
        { status: 200, headers: { "content-type": "text/html" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const post = await scrapeUrl("https://example.com/post");

    expect(post.title).toBe("AI's ’test—case");
    expect(post.body).toBe("Tom &amp; Jerry   check");
  });
});
