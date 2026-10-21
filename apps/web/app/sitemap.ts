import type { MetadataRoute } from "next";
import { dbDate } from "@/lib/db-date";
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
    "/library",
    "/library/license",
  ].map((p) => ({ url: `${base}${p}`, changeFrequency: "daily", priority: p === "" ? 1 : 0.6 }));

  const media = await sqlClient.execute(
    `SELECT m.slug, m.updated_at
     FROM media m
     WHERE m.status = 'approved'
       AND NOT EXISTS (
         SELECT 1
         FROM media_tags mt JOIN tags t ON t.id = mt.tag_id
         WHERE mt.media_id = m.id AND t.members_only = 1
       )
     ORDER BY m.created_at DESC LIMIT 5000`,
  );
  const mediaRoutes: MetadataRoute.Sitemap = media.rows.map((r) => ({
    url: `${base}/m/${r.slug as string}`,
    lastModified: dbDate(r.updated_at as string),
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const tags = await sqlClient.execute("SELECT slug FROM tags WHERE is_visible = 1");
  const tagRoutes: MetadataRoute.Sitemap = tags.rows.map((r) => ({
    url: `${base}/t/${r.slug as string}`,
    changeFrequency: "daily",
    priority: 0.4,
  }));

  const library = await sqlClient.execute(
    "SELECT slug, created_at FROM library_photos WHERE status = 'listed' ORDER BY created_at DESC LIMIT 5000",
  );
  const libraryRoutes: MetadataRoute.Sitemap = library.rows.map((r) => ({
    url: `${base}/library/${r.slug as string}`,
    lastModified: dbDate(r.created_at as string),
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  return [...staticRoutes, ...tagRoutes, ...mediaRoutes, ...libraryRoutes];
}
