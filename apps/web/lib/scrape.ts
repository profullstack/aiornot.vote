import "server-only";
import { validateExternalUrl, domainOf } from "./url-guard";

export type ScrapedPost = {
  title: string | null;
  body: string;
  author: string | null;
  platform: string; // reddit | x | bluesky | nostr | mastodon | web
  tags: string[];
  sourceUrl: string;
  sourceDomain: string | null;
};

const UA = "Mozilla/5.0 (compatible; AIorNotBot/1.0; +https://aiornot.vote)";
const MAX_BYTES = 600_000;
const TIMEOUT_MS = 9000;
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function fetchText(url: string, headers: Record<string, string> = {}, redirects = 0): Promise<string> {
  const guard = validateExternalUrl(url);
  if (!guard.ok) throw new Error(guard.error);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(guard.url.toString(), { headers: { "User-Agent": UA, ...headers }, signal: ctrl.signal, redirect: "manual" });
    if (REDIRECT_STATUSES.has(res.status)) {
      if (redirects >= MAX_REDIRECTS) throw new Error("Too many redirects.");
      const location = res.headers.get("location");
      if (!location) throw new Error(`Fetch failed (${res.status}).`);
      const nextUrl = new URL(location, guard.url).toString();
      const nextGuard = validateExternalUrl(nextUrl);
      if (!nextGuard.ok) throw new Error(`Redirect URL: ${nextGuard.error}`);
      return fetchText(nextGuard.url.toString(), headers, redirects + 1);
    }
    if (!res.ok) throw new Error(`Fetch failed (${res.status}).`);
    const reader = res.body?.getReader();
    if (!reader) return (await res.text()).slice(0, MAX_BYTES);
    let received = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.length;
        chunks.push(value);
        if (received > MAX_BYTES) break;
      }
    }
    return new TextDecoder().decode(concat(chunks)).slice(0, MAX_BYTES);
  } finally {
    clearTimeout(t);
  }
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

function metaContent(html: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${prop}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${prop}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return null;
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'");
}

function detectPlatform(host: string): string {
  if (/(^|\.)reddit\.com$/.test(host)) return "reddit";
  if (/(^|\.)(x\.com|twitter\.com)$/.test(host)) return "x";
  if (/(^|\.)bsky\.app$/.test(host)) return "bluesky";
  if (/(^|\.)(njump\.me|nostr\.\w+)$/.test(host)) return "nostr";
  if (/(^|\.)(mastodon|mstdn|fosstodon|hachyderm)\./.test(host)) return "mastodon";
  return "web";
}

/** Scrape a submitted URL into a normalized text post. SSRF-guarded. */
export async function scrapeUrl(rawUrl: string): Promise<ScrapedPost> {
  const guard = validateExternalUrl(rawUrl);
  if (!guard.ok) throw new Error(guard.error);
  const url = guard.url;
  const host = url.hostname.toLowerCase();
  const platform = detectPlatform(host);
  const sourceDomain = domainOf(rawUrl);
  const base: Pick<ScrapedPost, "platform" | "sourceUrl" | "sourceDomain"> = { platform, sourceUrl: url.toString(), sourceDomain };

  if (platform === "reddit") {
    try {
      const jsonUrl = url.toString().replace(/\/?$/, "") + ".json";
      const txt = await fetchText(jsonUrl, { Accept: "application/json" });
      const data = JSON.parse(txt);
      const post = data?.[0]?.data?.children?.[0]?.data;
      if (post) {
        return {
          ...base,
          title: (post.title as string) || null,
          body: (post.selftext as string)?.slice(0, 2000) || (post.title as string) || "",
          author: post.author ? `u/${post.author}` : null,
          tags: ["reddit", post.subreddit ? `r-${String(post.subreddit).toLowerCase()}` : ""].filter(Boolean),
        };
      }
    } catch {
      /* fall through to generic */
    }
  }

  if (platform === "x") {
    try {
      const oembed = `https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(url.toString())}`;
      const txt = await fetchText(oembed, { Accept: "application/json" });
      const data = JSON.parse(txt);
      const body = stripTags(String(data.html || "")).slice(0, 2000);
      if (body) {
        return { ...base, title: null, body, author: (data.author_name as string) || null, tags: ["x", "tweet"] };
      }
    } catch {
      /* fall through to generic */
    }
  }

  // Generic (also covers Bluesky, Nostr/njump, Mastodon via OpenGraph link previews).
  const html = await fetchText(url.toString());
  const title = metaContent(html, "og:title") || metaContent(html, "twitter:title") || (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null);
  const desc = metaContent(html, "og:description") || metaContent(html, "twitter:description") || metaContent(html, "description") || "";
  const author = metaContent(html, "article:author") || metaContent(html, "og:site_name");
  const body = (desc || title || "").slice(0, 2000);
  if (!body) throw new Error("Couldn't read any text from that URL. Try a direct link to the post.");
  const tags = [platform === "web" ? (sourceDomain?.split(".")[0] ?? "web") : platform];
  return { ...base, title: title ? decodeEntities(title).slice(0, 200) : null, body, author, tags };
}
