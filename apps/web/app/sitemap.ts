import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.appUrl;
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/tags",
    "/leaderboard",
    "/leaderboard/weekly",
    "/leaderboard/monthly",
    "/feeds",
    "/submit",
  ].map((p) => ({ url: `${base}${p}`, changeFrequency: "daily", priority: p === "" ? 1 : 0.6 }));

  const media = await sqlClient.execute(
    "SELECT slug, updated_at FROM media WHERE status = 'approved' ORDER BY created_at DESC LIMIT 5000",
  );
  const mediaRoutes: MetadataRoute.Sitemap = media.rows.map((r) => ({
    url: `${base}/m/${r.slug as string}`,
    lastModified: new Date((r.updated_at as string).replace(" ", "T") + "Z"),
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const tags = await sqlClient.execute("SELECT slug FROM tags WHERE is_visible = 1");
  const tagRoutes: MetadataRoute.Sitemap = tags.rows.map((r) => ({
    url: `${base}/t/${r.slug as string}`,
    changeFrequency: "daily",
    priority: 0.4,
  }));

  return [...staticRoutes, ...tagRoutes, ...mediaRoutes];
}
