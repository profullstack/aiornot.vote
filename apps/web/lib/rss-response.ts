import { env } from "./env";

export function rssResponse(xml: string): Response {
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": `public, max-age=60, s-maxage=${env.rssCacheSeconds}, stale-while-revalidate=600`,
    },
  });
}

/** Strip a trailing ".xml" from a dynamic RSS route segment. */
export function stripXml(seg: string): string {
  return seg.replace(/\.xml$/i, "");
}
