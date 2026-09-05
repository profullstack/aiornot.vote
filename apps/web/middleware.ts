import { gate } from "@/lib/crawl-gateway";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Canonical-host proxy: redirect www.* → apex (non-www) with a 308 so links,
 * cookies, and SEO consolidate on one hostname. Runs at the Next.js edge.
 */
export async function middleware(req: NextRequest) {
  // Crawl gateway first: AI training crawlers get 402 Payment Required (or the
  // sales page at /crawl) unless they present a paid pass. People, Googlebot
  // and retrieval crawlers fall through to everything below.
  const answer = await gate(req);
  if (answer) return answer;

  const host = req.headers.get("host") || "";
  if (host.startsWith("www.")) {
    const apex = host.slice(4);
    const url = new URL(req.url);
    url.host = apex;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  // Skip Next internals and static assets; run on everything else.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
