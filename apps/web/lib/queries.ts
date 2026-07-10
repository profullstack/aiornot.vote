import "server-only";
import { sqlClient } from "./db";
import { normalizePage } from "./pagination";
import type { Row } from "@libsql/client";

export const PAGE_SIZE = 24;

export type MediaTag = { slug: string; name: string; isAnswerSpoiler: boolean; membersOnly: boolean };

export function hasMembersOnlyTag(media: { tags: Array<Pick<MediaTag, "membersOnly">> }): boolean {
  return media.tags.some((t) => t.membersOnly);
}

export type MediaStatsView = {
  aiGuesses: number;
  notAiGuesses: number;
  totalGuesses: number;
  crowdAccuracy: number;
  aiPct: number;
};

export type MediaCard = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  mediaType: "image" | "video" | "link";
  mediaUrl: string;
  thumbnailUrl: string | null;
  posterUrl: string | null;
  sourceUrl: string | null;
  sourceProvider: string | null;
  truthLabel: "ai" | "not_ai" | "unknown";
  truthConfidence: string;
  revealStatus: string;
  isFeatured: boolean;
  isScoreEligible: boolean;
  createdAt: string;
  approvedAt: string | null;
  stats: MediaStatsView;
  tags: MediaTag[];
  userGuess?: "ai" | "not_ai" | null;
  userGuessCorrect?: boolean | null;
};

export type MediaDetail = MediaCard & {
  aiPromptSummary: string | null;
  aiModel: string | null;
  sourceDomain: string | null;
  unsplash?: {
    photographerName: string | null;
    photographerUrl: string | null;
    unsplashHtmlUrl: string | null;
  } | null;
};

function statsFromRow(r: Row): MediaStatsView {
  const ai = Number(r.ai_guesses ?? 0);
  const notAi = Number(r.not_ai_guesses ?? 0);
  const total = Number(r.total_guesses ?? 0);
  return {
    aiGuesses: ai,
    notAiGuesses: notAi,
    totalGuesses: total,
    crowdAccuracy: Number(r.crowd_accuracy ?? 0),
    aiPct: total > 0 ? Math.round((ai / total) * 100) : 0,
  };
}

function cardFromRow(r: Row): MediaCard {
  return {
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    description: (r.description as string) ?? null,
    mediaType: (r.media_type as "image" | "video" | "link") ?? "image",
    mediaUrl: r.media_url as string,
    thumbnailUrl: (r.thumbnail_url as string) ?? null,
    posterUrl: (r.poster_url as string) ?? null,
    sourceUrl: (r.source_url as string) ?? null,
    sourceProvider: (r.source_provider as string) ?? null,
    truthLabel: (r.truth_label as MediaCard["truthLabel"]) ?? "unknown",
    truthConfidence: (r.truth_confidence as string) ?? "unverified",
    revealStatus: (r.reveal_status as string) ?? "revealed",
    isFeatured: Number(r.is_featured ?? 0) === 1,
    isScoreEligible: Number(r.is_score_eligible ?? 1) === 1,
    createdAt: r.created_at as string,
    approvedAt: (r.approved_at as string) ?? null,
    stats: statsFromRow(r),
    tags: [],
  };
}

export type ListSort = "newest" | "trending" | "hardest" | "most_guessed" | "featured";

export type ListArgs = {
  sort?: ListSort;
  mediaType?: "image" | "video";
  tagSlug?: string;
  featuredOnly?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
  userId?: string | null;
  /** Include members-only (e.g. #nsfw) media. Default false — gated everywhere. */
  includeMembersOnly?: boolean;
};

const SELECT_CARD = `
  SELECT m.*, ms.ai_guesses, ms.not_ai_guesses, ms.total_guesses,
         ms.crowd_accuracy, ms.trending_score, ms.difficulty_score
  FROM media m
  LEFT JOIN media_stats ms ON ms.media_id = m.id
`;

export async function listMedia(args: ListArgs): Promise<{ items: MediaCard[]; total: number }> {
  const page = normalizePage(args.page);
  const pageSize = args.pageSize ?? PAGE_SIZE;
  const where: string[] = ["m.status = 'approved'"];
  const params: unknown[] = [];

  if (args.mediaType) {
    where.push("m.media_type = ?");
    params.push(args.mediaType);
  }
  if (args.featuredOnly) where.push("m.is_featured = 1");
  // Members-only media (e.g. #nsfw) is hidden from every default feed, play
  // queue, RSS and search — only surfaced when a caller explicitly opts in.
  if (!args.includeMembersOnly) {
    where.push(
      "m.id NOT IN (SELECT mt.media_id FROM media_tags mt JOIN tags t ON t.id = mt.tag_id WHERE t.members_only = 1)",
    );
  }
  if (args.tagSlug) {
    where.push(
      "m.id IN (SELECT mt.media_id FROM media_tags mt JOIN tags t ON t.id = mt.tag_id WHERE t.slug = ?)",
    );
    params.push(args.tagSlug);
  }
  if (args.q && args.q.trim()) {
    const like = `%${args.q.trim().toLowerCase()}%`;
    where.push(
      `(LOWER(m.title) LIKE ? OR LOWER(COALESCE(m.description,'')) LIKE ? OR LOWER(COALESCE(m.source_domain,'')) LIKE ?
        OR m.id IN (SELECT mt.media_id FROM media_tags mt JOIN tags t ON t.id = mt.tag_id WHERE t.slug LIKE ?)
        OR m.id IN (SELECT up.media_id FROM unsplash_photos up WHERE LOWER(COALESCE(up.photographer_name,'')) LIKE ?))`,
    );
    params.push(like, like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  let orderSql = "ORDER BY m.approved_at DESC, m.created_at DESC";
  switch (args.sort) {
    case "trending":
      orderSql = "ORDER BY ms.trending_score DESC, m.created_at DESC";
      break;
    case "hardest":
      orderSql = "ORDER BY ms.difficulty_score DESC, ms.total_guesses DESC";
      break;
    case "most_guessed":
      orderSql = "ORDER BY ms.total_guesses DESC, m.created_at DESC";
      break;
    case "featured":
      orderSql = "ORDER BY m.is_featured DESC, m.created_at DESC";
      break;
  }

  const countRes = await sqlClient.execute({
    sql: `SELECT COUNT(*) AS c FROM media m ${whereSql}`,
    args: params as never[],
  });
  const total = Number(countRes.rows[0]?.c ?? 0);

  const res = await sqlClient.execute({
    sql: `${SELECT_CARD} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`,
    args: [...params, pageSize, (page - 1) * pageSize] as never[],
  });

  const items = res.rows.map(cardFromRow);
  await attachTags(items);
  if (args.userId) await attachUserGuesses(items, args.userId);
  return { items, total };
}

async function attachTags(items: MediaCard[]): Promise<void> {
  if (items.length === 0) return;
  const ids = items.map((i) => i.id);
  const placeholders = ids.map(() => "?").join(",");
  const res = await sqlClient.execute({
    sql: `SELECT mt.media_id, t.slug, t.name, t.is_answer_spoiler, t.members_only
          FROM media_tags mt JOIN tags t ON t.id = mt.tag_id
          WHERE mt.media_id IN (${placeholders}) AND t.is_visible = 1`,
    args: ids as never[],
  });
  const byMedia = new Map<string, MediaTag[]>();
  for (const r of res.rows) {
    const arr = byMedia.get(r.media_id as string) ?? [];
    arr.push({
      slug: r.slug as string,
      name: r.name as string,
      isAnswerSpoiler: Number(r.is_answer_spoiler ?? 0) === 1,
      membersOnly: Number(r.members_only ?? 0) === 1,
    });
    byMedia.set(r.media_id as string, arr);
  }
  for (const item of items) item.tags = byMedia.get(item.id) ?? [];
}

async function attachUserGuesses(items: MediaCard[], userId: string): Promise<void> {
  if (items.length === 0) return;
  const ids = items.map((i) => i.id);
  const placeholders = ids.map(() => "?").join(",");
  const res = await sqlClient.execute({
    sql: `SELECT media_id, guess, is_correct FROM guesses
          WHERE user_id = ? AND media_id IN (${placeholders})`,
    args: [userId, ...ids] as never[],
  });
  const byMedia = new Map<string, { guess: "ai" | "not_ai"; correct: boolean | null }>();
  for (const r of res.rows) {
    byMedia.set(r.media_id as string, {
      guess: r.guess as "ai" | "not_ai",
      correct: r.is_correct == null ? null : Number(r.is_correct) === 1,
    });
  }
  for (const item of items) {
    const g = byMedia.get(item.id);
    item.userGuess = g?.guess ?? null;
    item.userGuessCorrect = g?.correct ?? null;
  }
}

export async function getMediaBySlug(
  slug: string,
  userId?: string | null,
): Promise<MediaDetail | null> {
  const res = await sqlClient.execute({
    sql: `${SELECT_CARD} WHERE m.slug = ? AND m.status = 'approved' LIMIT 1`,
    args: [slug],
  });
  const row = res.rows[0];
  if (!row) return null;
  const card = cardFromRow(row) as MediaDetail;
  card.aiPromptSummary = (row.ai_prompt_summary as string) ?? null;
  card.aiModel = (row.ai_model as string) ?? null;
  card.sourceDomain = (row.source_domain as string) ?? null;
  await attachTags([card]);
  if (userId) await attachUserGuesses([card], userId);

  const up = await sqlClient.execute({
    sql: `SELECT photographer_name, photographer_url, unsplash_html_url
          FROM unsplash_photos WHERE media_id = ? LIMIT 1`,
    args: [card.id],
  });
  const upr = up.rows[0];
  card.unsplash = upr
    ? {
        photographerName: (upr.photographer_name as string) ?? null,
        photographerUrl: (upr.photographer_url as string) ?? null,
        unsplashHtmlUrl: (upr.unsplash_html_url as string) ?? null,
      }
    : null;
  return card;
}

export async function getRelatedMedia(
  mediaId: string,
  tagSlugs: string[],
  limit = 6,
  opts?: { includeMembersOnly?: boolean },
): Promise<MediaCard[]> {
  if (tagSlugs.length === 0) return [];
  const placeholders = tagSlugs.map(() => "?").join(",");
  const memberFilter = opts?.includeMembersOnly
    ? ""
    : "AND m.id NOT IN (SELECT mt.media_id FROM media_tags mt JOIN tags t ON t.id = mt.tag_id WHERE t.members_only = 1)";
  const res = await sqlClient.execute({
    sql: `${SELECT_CARD}
          WHERE m.status = 'approved' AND m.id != ?
            ${memberFilter}
            AND m.id IN (
              SELECT mt.media_id FROM media_tags mt JOIN tags t ON t.id = mt.tag_id
              WHERE t.slug IN (${placeholders}) AND t.is_answer_spoiler = 0
            )
          ORDER BY m.created_at DESC LIMIT ?`,
    args: [mediaId, ...tagSlugs, limit] as never[],
  });
  const items = res.rows.map(cardFromRow);
  await attachTags(items);
  return items;
}

export type TagRow = {
  slug: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isAnswerSpoiler: boolean;
  membersOnly: boolean;
  mediaCount: number;
};

export async function listTags(opts?: { defaultsOnly?: boolean; hideSpoilers?: boolean }): Promise<TagRow[]> {
  const where: string[] = ["t.is_visible = 1"];
  if (opts?.defaultsOnly) where.push("t.is_default = 1");
  if (opts?.hideSpoilers) where.push("t.is_answer_spoiler = 0");
  const res = await sqlClient.execute(
    `SELECT t.slug, t.name, t.description, t.is_default, t.is_answer_spoiler, t.members_only,
            (SELECT COUNT(*) FROM media_tags mt JOIN media m ON m.id = mt.media_id
             WHERE mt.tag_id = t.id AND m.status = 'approved') AS media_count
     FROM tags t WHERE ${where.join(" AND ")}
     ORDER BY media_count DESC, t.name ASC`,
  );
  return res.rows.map((r) => ({
    slug: r.slug as string,
    name: r.name as string,
    description: (r.description as string) ?? null,
    isDefault: Number(r.is_default ?? 0) === 1,
    isAnswerSpoiler: Number(r.is_answer_spoiler ?? 0) === 1,
    membersOnly: Number(r.members_only ?? 0) === 1,
    mediaCount: Number(r.media_count ?? 0),
  }));
}

export async function getTagBySlug(slug: string): Promise<TagRow | null> {
  const res = await sqlClient.execute({
    sql: `SELECT t.slug, t.name, t.description, t.is_default, t.is_answer_spoiler, t.members_only,
            (SELECT COUNT(*) FROM media_tags mt JOIN media m ON m.id = mt.media_id
             WHERE mt.tag_id = t.id AND m.status = 'approved') AS media_count
          FROM tags t WHERE t.slug = ? LIMIT 1`,
    args: [slug],
  });
  const r = res.rows[0];
  if (!r) return null;
  return {
    slug: r.slug as string,
    name: r.name as string,
    description: (r.description as string) ?? null,
    isDefault: Number(r.is_default ?? 0) === 1,
    isAnswerSpoiler: Number(r.is_answer_spoiler ?? 0) === 1,
    membersOnly: Number(r.members_only ?? 0) === 1,
    mediaCount: Number(r.media_count ?? 0),
  };
}

// ---- Leaderboards -------------------------------------------------------

export type LeaderboardRow = {
  rank: number;
  userId: string;
  displayName: string;
  correct: number;
  scored: number;
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
};

export type LeaderboardArgs = {
  timeframe?: "all" | "week" | "month";
  tagSlug?: string;
  mediaType?: "image" | "video";
  minScored?: number;
  limit?: number;
};

function sinceForTimeframe(tf?: string): string | null {
  const now = new Date();
  if (tf === "week") {
    const d = new Date(now);
    const day = (d.getUTCDay() + 6) % 7; // Monday-start
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (tf === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }
  return null;
}

export async function getLeaderboard(args: LeaderboardArgs): Promise<LeaderboardRow[]> {
  const minScored = args.minScored ?? 1;
  const limit = args.limit ?? 100;
  const where: string[] = [
    "u.email_verified_at IS NOT NULL",
    "u.status = 'active'",
    "g.is_scored = 1",
  ];
  const params: unknown[] = [];
  const since = sinceForTimeframe(args.timeframe);
  const needMediaJoin = !!args.mediaType || !!args.tagSlug;

  if (since) {
    where.push("g.created_at >= ?");
    params.push(since);
  }
  if (args.mediaType) {
    where.push("m.media_type = ?");
    params.push(args.mediaType);
  }
  if (args.tagSlug) {
    where.push(
      "g.media_id IN (SELECT mt.media_id FROM media_tags mt JOIN tags t ON t.id = mt.tag_id WHERE t.slug = ?)",
    );
    params.push(args.tagSlug);
  }

  const res = await sqlClient.execute({
    sql: `
      SELECT u.id AS user_id,
             COALESCE(NULLIF(u.display_name,''), 'anon-' || substr(u.id, -5)) AS display_name,
             SUM(CASE WHEN g.is_correct = 1 THEN 1 ELSE 0 END) AS correct,
             COUNT(*) AS scored,
             COALESCE(us.current_streak, 0) AS current_streak,
             COALESCE(us.best_streak, 0) AS best_streak,
             MAX(g.created_at) AS last_activity
      FROM guesses g
      JOIN users u ON u.id = g.user_id
      LEFT JOIN user_stats us ON us.user_id = u.id
      ${needMediaJoin ? "JOIN media m ON m.id = g.media_id" : ""}
      WHERE ${where.join(" AND ")}
      GROUP BY u.id
      HAVING scored >= ?
      ORDER BY correct DESC, (CAST(correct AS REAL) / scored) DESC, scored DESC, last_activity DESC
      LIMIT ?`,
    args: [...params, minScored, limit] as never[],
  });

  return res.rows.map((r, i) => {
    const correct = Number(r.correct ?? 0);
    const scored = Number(r.scored ?? 0);
    return {
      rank: i + 1,
      userId: r.user_id as string,
      displayName: r.display_name as string,
      correct,
      scored,
      accuracy: scored > 0 ? correct / scored : 0,
      currentStreak: Number(r.current_streak ?? 0),
      bestStreak: Number(r.best_streak ?? 0),
    };
  });
}

export type MyStanding = {
  scored: number;
  correct: number;
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
  qualified: boolean;
  minScored: number;
  needed: number;
};

/** The signed-in user's own standing for a leaderboard scope (so they can see their votes count). */
export async function getMyStanding(
  userId: string,
  args: { timeframe?: "all" | "week" | "month"; tagSlug?: string; mediaType?: "image" | "video"; minScored: number },
): Promise<MyStanding> {
  const where = ["g.user_id = ?", "g.is_scored = 1"];
  const params: unknown[] = [userId];
  const since = sinceForTimeframe(args.timeframe);
  const needMediaJoin = !!args.mediaType;
  if (since) {
    where.push("g.created_at >= ?");
    params.push(since);
  }
  if (args.mediaType) {
    where.push("m.media_type = ?");
    params.push(args.mediaType);
  }
  if (args.tagSlug) {
    where.push("g.media_id IN (SELECT mt.media_id FROM media_tags mt JOIN tags t ON t.id = mt.tag_id WHERE t.slug = ?)");
    params.push(args.tagSlug);
  }
  const res = await sqlClient.execute({
    sql: `SELECT COUNT(*) AS scored, SUM(CASE WHEN g.is_correct = 1 THEN 1 ELSE 0 END) AS correct
          FROM guesses g ${needMediaJoin ? "JOIN media m ON m.id = g.media_id" : ""}
          WHERE ${where.join(" AND ")}`,
    args: params as never[],
  });
  const scored = Number(res.rows[0]?.scored ?? 0);
  const correct = Number(res.rows[0]?.correct ?? 0);
  const us = await sqlClient.execute({
    sql: "SELECT current_streak, best_streak FROM user_stats WHERE user_id = ? LIMIT 1",
    args: [userId],
  });
  return {
    scored,
    correct,
    accuracy: scored > 0 ? correct / scored : 0,
    currentStreak: Number(us.rows[0]?.current_streak ?? 0),
    bestStreak: Number(us.rows[0]?.best_streak ?? 0),
    qualified: scored >= args.minScored,
    minScored: args.minScored,
    needed: Math.max(0, args.minScored - scored),
  };
}

export async function getStreakLeaderboard(limit = 100): Promise<LeaderboardRow[]> {
  const res = await sqlClient.execute({
    sql: `SELECT u.id AS user_id,
                 COALESCE(NULLIF(u.display_name,''), 'anon-' || substr(u.id, -5)) AS display_name,
                 us.correct_guesses AS correct, us.scored_guesses AS scored,
                 us.accuracy, us.current_streak, us.best_streak
          FROM user_stats us JOIN users u ON u.id = us.user_id
          WHERE u.email_verified_at IS NOT NULL AND u.status = 'active' AND us.current_streak > 0
          ORDER BY us.current_streak DESC, us.best_streak DESC, us.correct_guesses DESC
          LIMIT ?`,
    args: [limit],
  });
  return res.rows.map((r, i) => ({
    rank: i + 1,
    userId: r.user_id as string,
    displayName: r.display_name as string,
    correct: Number(r.correct ?? 0),
    scored: Number(r.scored ?? 0),
    accuracy: Number(r.accuracy ?? 0),
    currentStreak: Number(r.current_streak ?? 0),
    bestStreak: Number(r.best_streak ?? 0),
  }));
}

// ---- User history & stats ----------------------------------------------

export type HistoryRow = {
  mediaId: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  mediaUrl: string;
  mediaType: string;
  guess: "ai" | "not_ai";
  truthLabel: string;
  isScored: boolean;
  isCorrect: boolean | null;
  createdAt: string;
};

export async function getUserHistory(
  userId: string,
  opts?: { result?: "correct" | "incorrect" | "pending"; tag?: string; mediaType?: string; limit?: number },
): Promise<HistoryRow[]> {
  const where = ["g.user_id = ?"];
  const params: unknown[] = [userId];
  if (opts?.result === "correct") where.push("g.is_scored = 1 AND g.is_correct = 1");
  else if (opts?.result === "incorrect") where.push("g.is_scored = 1 AND g.is_correct = 0");
  else if (opts?.result === "pending") where.push("g.is_scored = 0");
  if (opts?.mediaType) {
    where.push("m.media_type = ?");
    params.push(opts.mediaType);
  }
  if (opts?.tag) {
    where.push("m.id IN (SELECT mt.media_id FROM media_tags mt JOIN tags t ON t.id = mt.tag_id WHERE t.slug = ?)");
    params.push(opts.tag);
  }
  const res = await sqlClient.execute({
    sql: `SELECT g.media_id, m.slug, m.title, m.thumbnail_url, m.media_url, m.media_type,
                 g.guess, m.truth_label, g.is_scored, g.is_correct, g.created_at
          FROM guesses g JOIN media m ON m.id = g.media_id
          WHERE ${where.join(" AND ")}
          ORDER BY g.created_at DESC LIMIT ?`,
    args: [...params, opts?.limit ?? 100] as never[],
  });
  return res.rows.map((r) => ({
    mediaId: r.media_id as string,
    slug: r.slug as string,
    title: r.title as string,
    thumbnailUrl: (r.thumbnail_url as string) ?? null,
    mediaUrl: r.media_url as string,
    mediaType: r.media_type as string,
    guess: r.guess as "ai" | "not_ai",
    truthLabel: r.truth_label as string,
    isScored: Number(r.is_scored ?? 0) === 1,
    isCorrect: r.is_correct == null ? null : Number(r.is_correct) === 1,
    createdAt: r.created_at as string,
  }));
}

export type UserStatsView = {
  totalGuesses: number;
  scoredGuesses: number;
  correctGuesses: number;
  incorrectGuesses: number;
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
};

export async function getUserStats(userId: string): Promise<UserStatsView> {
  const res = await sqlClient.execute({
    sql: `SELECT total_guesses, scored_guesses, correct_guesses, incorrect_guesses,
                 accuracy, current_streak, best_streak FROM user_stats WHERE user_id = ? LIMIT 1`,
    args: [userId],
  });
  const r = res.rows[0];
  return {
    totalGuesses: Number(r?.total_guesses ?? 0),
    scoredGuesses: Number(r?.scored_guesses ?? 0),
    correctGuesses: Number(r?.correct_guesses ?? 0),
    incorrectGuesses: Number(r?.incorrect_guesses ?? 0),
    accuracy: Number(r?.accuracy ?? 0),
    currentStreak: Number(r?.current_streak ?? 0),
    bestStreak: Number(r?.best_streak ?? 0),
  };
}
