import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

// Keep every crawler out of infinite search-param space + private areas.
const DISALLOW = ["/search", "/api/", "/account", "/admin"];

// AI bots get a lighter disallow — we want them to access the public API
// endpoints (the site promotes itself as "built for AI agents") while still
// keeping out infinite search parameters and private admin areas.
const AI_DISALLOW = ["/search", "/account", "/admin"];
const AI_DISALLOW_PATHS = AI_DISALLOW.map((d) => ({ disallow: d }));

// AI answer engines / training crawlers we explicitly welcome (so they don't
// fall back to defaults). We WANT to be cited by these.
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "Amazonbot",
  "cohere-ai",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_BOTS, allow: "/", disallow: AI_DISALLOW },
    ],
    sitemap: `${env.appUrl}/sitemap.xml`,
    host: env.appUrl,
  };
}
