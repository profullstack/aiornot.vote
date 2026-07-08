import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

// Keep every crawler out of infinite search-param space + private areas.
const DISALLOW = ["/search", "/api/", "/account", "/admin"];

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
      { userAgent: AI_BOTS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${env.appUrl}/sitemap.xml`,
    host: env.appUrl,
  };
}
