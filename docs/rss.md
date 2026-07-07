# RSS

RSS is a first-class surface. Every list view links to a feed, exposes a
`<link rel="alternate" type="application/rss+xml">` autodiscovery tag, and offers
a copyable URL. The `/feeds` page is a directory of all core + tag feeds.

## Feeds

| Feed | Route |
| --- | --- |
| Global latest | `/rss.xml` |
| Trending | `/rss/trending.xml` |
| Featured | `/rss/featured.xml` |
| Tag | `/rss/t/:tagSlug.xml` |
| Search | `/rss/search.xml?q=…&tag=…` |
| Per-media (+related) | `/rss/m/:slug.xml` |
| Leaderboard (all-time) | `/rss/leaderboard.xml` |
| Leaderboard weekly | `/rss/leaderboard/weekly.xml` |
| Leaderboard monthly | `/rss/leaderboard/monthly.xml` |
| Leaderboard by tag | `/rss/leaderboard/t/:tagSlug.xml` |

## Item fields
`title`, `link`, `guid` (stable — `media:<id>`, not the media URL), `pubDate`,
`description` (HTML preview `<img>` + crowd result + tags), one `category` per
non-spoiler tag, and an `enclosure` for hosted images.

## Behaviour
- Default 50 items, hard cap 100.
- `Cache-Control: s-maxage=<RSS_CACHE_SECONDS>` (default 300s) + SWR.
- `lastBuildDate` set on every channel.
- Spoiler tags (`ai-generated`, `human-made`) are excluded from feed categories.

Implementation: `apps/web/lib/rss.ts` (builder) + `apps/web/app/rss*/**`.
