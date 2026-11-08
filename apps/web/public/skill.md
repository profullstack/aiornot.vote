# AIorNot.vote Skill

AIorNot.vote is a crowd-sourced AI-image-detection service. Verified humans vote whether a
photorealistic image, video, or post is AI-generated or real; the aggregated crowd verdict is
available on the web, by RSS, and via a JSON API.

Base URL: https://aiornot.pwa.pit.world
API docs: https://aiornot.pwa.pit.world/api
Auth: Bearer API key (create one on your account page; membership includes free keys)

## What an agent can do

- Look up the crowd's AI-vs-real verdict and vote distribution for a piece of media.
- Browse the latest, trending, and hardest-to-call media.
- Read leaderboards of the best human detectors.
- Subscribe to RSS feeds for latest / trending / featured / leaderboard updates.

## Feeds (no auth)

- Latest: https://aiornot.pwa.pit.world/rss.xml
- Trending: https://aiornot.pwa.pit.world/rss/trending.xml
- Featured: https://aiornot.pwa.pit.world/rss/featured.xml
- Leaderboard: https://aiornot.pwa.pit.world/rss/leaderboard.xml

See https://aiornot.pwa.pit.world/api for endpoints, parameters, and authentication.
