import { env } from "./env";
import type { MediaCard, LeaderboardRow } from "./queries";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(s: string): string {
  return `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

/** Feeds need absolute URLs; locally-stored media uses relative /media paths. */
function abs(url: string): string {
  return url.startsWith("/") ? `${env.appUrl}${url}` : url;
}

function imageMimeType(url: string): string | null {
  let path = url;
  try {
    path = new URL(url, env.appUrl).pathname;
  } catch {
    path = url.split(/[?#]/, 1)[0] ?? "";
  }

  const extension = path.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    case "svg":
      return "image/svg+xml";
    default:
      return null;
  }
}

export type FeedItem = {
  title: string;
  link: string;
  guid: string;
  pubDate: string; // ISO
  descriptionHtml: string;
  categories?: string[];
  enclosure?: { url: string; type: string; length?: number };
};

export type FeedChannel = {
  title: string;
  link: string;
  feedUrl: string;
  description: string;
  items: FeedItem[];
};

const MAX_ITEMS = 100;

export function buildRss(channel: FeedChannel): string {
  const items = channel.items.slice(0, MAX_ITEMS);
  const lastBuild = new Date().toUTCString();
  const body = items
    .map((it) => {
      const cats = (it.categories ?? [])
        .map((c) => `<category>${esc(c)}</category>`)
        .join("");
      const enc = it.enclosure
        ? `<enclosure url="${esc(it.enclosure.url)}" type="${esc(it.enclosure.type)}"${
            it.enclosure.length ? ` length="${it.enclosure.length}"` : ""
          } />`
        : "";
      return `    <item>
      <title>${esc(it.title)}</title>
      <link>${esc(it.link)}</link>
      <guid isPermaLink="false">${esc(it.guid)}</guid>
      <pubDate>${new Date(it.pubDate).toUTCString()}</pubDate>
      ${cats}
      ${enc}
      <description>${cdata(it.descriptionHtml)}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(channel.title)}</title>
    <link>${esc(channel.link)}</link>
    <atom:link href="${esc(channel.feedUrl)}" rel="self" type="application/rss+xml" />
    <description>${esc(channel.description)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <generator>AIorNot.vote</generator>
${body}
  </channel>
</rss>`;
}

export function mediaItemDescription(m: MediaCard): string {
  const preview = abs(m.thumbnailUrl || m.mediaUrl);
  const tags = m.tags
    .filter((t) => !t.isAnswerSpoiler)
    .map((t) => t.name)
    .join(", ");
  const crowd =
    m.stats.totalGuesses > 0
      ? `<p>Current crowd result: ${m.stats.aiPct}% AI, ${100 - m.stats.aiPct}% Not AI.</p>`
      : `<p>No guesses yet — be the first.</p>`;
  return `<img src="${esc(preview)}" alt="${esc(m.title)}" />
<p>Guess: AI or Not AI.</p>
${crowd}
${tags ? `<p>Tags: ${esc(tags)}</p>` : ""}`;
}

export function mediaCardsToFeed(
  cards: MediaCard[],
  channel: Omit<FeedChannel, "items">,
): string {
  return buildRss({
    ...channel,
    items: cards.map((m) => {
      const enclosureType = m.mediaType === "image" ? imageMimeType(m.mediaUrl) : null;
      return {
        title: m.title,
        link: `${env.appUrl}/m/${m.slug}`,
        guid: `media:${m.id}`,
        pubDate: m.approvedAt || m.createdAt,
        descriptionHtml: mediaItemDescription(m),
        categories: m.tags.filter((t) => !t.isAnswerSpoiler).map((t) => t.slug),
        enclosure: enclosureType ? { url: abs(m.mediaUrl), type: enclosureType } : undefined,
      };
    }),
  });
}

export function leaderboardToFeed(
  rows: LeaderboardRow[],
  channel: Omit<FeedChannel, "items">,
): string {
  const now = new Date().toISOString();
  return buildRss({
    ...channel,
    items: rows.map((r) => ({
      title: `#${r.rank} ${r.displayName} — ${r.correct} correct (${Math.round(
        r.accuracy * 100,
      )}%)`,
      link: `${env.appUrl}/leaderboard`,
      guid: `lb:${channel.feedUrl}:${r.userId}:${r.rank}`,
      pubDate: now,
      descriptionHtml: `<p>Rank ${r.rank}: <strong>${esc(r.displayName)}</strong></p>
<p>${r.correct} correct of ${r.scored} scored guesses — ${Math.round(r.accuracy * 100)}% accuracy.</p>
<p>Current streak: ${r.currentStreak} · Best streak: ${r.bestStreak}</p>`,
    })),
  });
}
