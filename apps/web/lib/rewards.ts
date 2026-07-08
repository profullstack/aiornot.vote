import "server-only";
import { sqlClient } from "./db";
import { newId } from "@aiornot/db";
import { analyzeImage } from "./ai-vision";

export type PowerupKind = "hint" | "ai_scan" | "ai_verdict";
export type Grant = { hints?: number; aiScans?: number; aiVerdicts?: number };

export type Milestone = { streak: number; grant: Grant; badge: string | null; emoji: string; label: string };

/**
 * Recurring power-up grants — you keep earning, over and over, as your streak climbs.
 * A Hint every 5 correct in a row, an AI Scan every 20, an AI Verdict every 50.
 * Every hit stacks in your balance; break your streak and you start earning them again.
 */
export const GRANT_EVERY = { hint: 5, aiScan: 20, aiVerdict: 50 } as const;

/** Named badge tiers — permanent, awarded off your best-ever streak. */
export const BADGE_TIERS: Array<{ streak: number; badge: string; emoji: string }> = [
  { streak: 10, badge: "Sharp Eye", emoji: "👁️" },
  { streak: 20, badge: "Detective", emoji: "🔍" },
  { streak: 30, badge: "Hawk Eye", emoji: "🦅" },
  { streak: 50, badge: "Oracle", emoji: "🤖" },
  { streak: 75, badge: "Machine Whisperer", emoji: "🧠" },
  { streak: 100, badge: "Legend", emoji: "🏆" },
];

export type Balances = { hints: number; aiScans: number; aiVerdicts: number };

async function ensureRow(userId: string): Promise<void> {
  await sqlClient.execute({ sql: "INSERT OR IGNORE INTO user_powerups (user_id) VALUES (?)", args: [userId] });
}

export async function getBalances(userId: string): Promise<Balances> {
  const r = await sqlClient.execute({ sql: "SELECT hints, ai_scans, ai_verdicts FROM user_powerups WHERE user_id = ? LIMIT 1", args: [userId] });
  const row = r.rows[0];
  return { hints: Number(row?.hints ?? 0), aiScans: Number(row?.ai_scans ?? 0), aiVerdicts: Number(row?.ai_verdicts ?? 0) };
}

export function getBadges(bestStreak: number): Array<{ badge: string; emoji: string; streak: number }> {
  return BADGE_TIERS.filter((t) => bestStreak >= t.streak).map((t) => ({ badge: t.badge, emoji: t.emoji, streak: t.streak }));
}

/**
 * Called after a correct guess. Grants recurring power-ups whenever the new streak
 * lands on a multiple of a grant interval — so the rewards keep coming as you play.
 * Returns a summary of what was earned (for the toast), or null if this streak
 * length didn't land on any interval.
 */
export async function awardMilestones(userId: string, newStreak: number): Promise<Milestone | null> {
  if (newStreak <= 0) return null;
  const grant: Grant = {
    hints: newStreak % GRANT_EVERY.hint === 0 ? 1 : 0,
    aiScans: newStreak % GRANT_EVERY.aiScan === 0 ? 1 : 0,
    aiVerdicts: newStreak % GRANT_EVERY.aiVerdict === 0 ? 1 : 0,
  };
  if (!grant.hints && !grant.aiScans && !grant.aiVerdicts) return null;

  await ensureRow(userId);
  await sqlClient.execute({
    sql: `UPDATE user_powerups SET hints = hints + ?, ai_scans = ai_scans + ?, ai_verdicts = ai_verdicts + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    args: [grant.hints ?? 0, grant.aiScans ?? 0, grant.aiVerdicts ?? 0, userId],
  });

  const parts: string[] = [];
  if (grant.hints) parts.push(`+${grant.hints} 💡 Hint`);
  if (grant.aiScans) parts.push(`+${grant.aiScans} 🔍 AI Scan`);
  if (grant.aiVerdicts) parts.push(`+${grant.aiVerdicts} 🤖 AI Verdict`);
  const badge = BADGE_TIERS.find((t) => t.streak === newStreak) ?? null;
  return {
    streak: newStreak,
    grant,
    badge: badge?.badge ?? null,
    emoji: badge?.emoji ?? "🔥",
    label: `${newStreak}🔥 streak — ${parts.join(", ")}${badge ? ` · 🏅 ${badge.badge}` : ""}`,
  };
}

const COL: Record<PowerupKind, string> = { hint: "hints", ai_scan: "ai_scans", ai_verdict: "ai_verdicts" };

async function hintText(mediaId: string): Promise<string> {
  const s = await sqlClient.execute({ sql: "SELECT ai_guesses, total_guesses FROM media_stats WHERE media_id = ? LIMIT 1", args: [mediaId] });
  const ai = Number(s.rows[0]?.ai_guesses ?? 0);
  const total = Number(s.rows[0]?.total_guesses ?? 0);
  const tip = (await sqlClient.execute("SELECT text FROM tips WHERE is_active = 1 ORDER BY RANDOM() LIMIT 1")).rows[0]?.text as string | undefined;
  const crowd = total > 0 ? `The crowd leans ${Math.round((ai / total) * 100)}% AI so far (${total} votes). ` : "No crowd votes yet. ";
  return `${crowd}${tip ? "Look here: " + tip : ""}`.trim();
}

async function analysisText(mediaId: string, kind: "ai_scan" | "ai_verdict"): Promise<string> {
  const cached = await sqlClient.execute({ sql: "SELECT text FROM ai_analyses WHERE media_id = ? AND kind = ? LIMIT 1", args: [mediaId, kind] });
  if (cached.rows[0]) return cached.rows[0].text as string;
  const m = await sqlClient.execute({ sql: "SELECT media_url FROM media WHERE id = ? LIMIT 1", args: [mediaId] });
  const url = m.rows[0]?.media_url as string | undefined;
  if (!url) throw new Error("Media not found.");
  const text = await analyzeImage(url, kind);
  await sqlClient.execute({ sql: "INSERT OR IGNORE INTO ai_analyses (media_id, kind, text) VALUES (?, ?, ?)", args: [mediaId, kind, text] });
  return text;
}

async function resultText(mediaId: string, kind: PowerupKind): Promise<string> {
  if (kind === "hint") return hintText(mediaId);
  return analysisText(mediaId, kind);
}

export type UseResult = { ok: true; kind: PowerupKind; text: string; balances: Balances } | { ok: false; error: string };

async function canUsePowerupOnMedia(userId: string, mediaId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const media = await sqlClient.execute({
    sql: "SELECT status FROM media WHERE id = ? LIMIT 1",
    args: [mediaId],
  });
  const row = media.rows[0];
  if (!row || row.status !== "approved") {
    return { ok: false, error: "Media not found." };
  }

  const gated = await sqlClient.execute({
    sql: `SELECT 1
          FROM media_tags mt JOIN tags t ON t.id = mt.tag_id
          WHERE mt.media_id = ? AND t.members_only = 1
          LIMIT 1`,
    args: [mediaId],
  });
  if (gated.rows.length === 0) return { ok: true };

  const member = await sqlClient.execute({
    sql: "SELECT is_lifetime_member FROM users WHERE id = ? LIMIT 1",
    args: [userId],
  });
  if (Number(member.rows[0]?.is_lifetime_member ?? 0) === 1) return { ok: true };
  return { ok: false, error: "This media is members-only." };
}

/** Spend a power-up on a media item (or return the already-unlocked result). */
export async function usePowerup(userId: string, mediaId: string, kind: PowerupKind): Promise<UseResult> {
  const allowed = await canUsePowerupOnMedia(userId, mediaId);
  if (!allowed.ok) return allowed;

  const already = await sqlClient.execute({ sql: "SELECT 1 FROM powerup_uses WHERE user_id = ? AND media_id = ? AND kind = ? LIMIT 1", args: [userId, mediaId, kind] });
  if (already.rows.length > 0) {
    return { ok: true, kind, text: await resultText(mediaId, kind), balances: await getBalances(userId) };
  }
  await ensureRow(userId);
  // Atomically consume one, only if available.
  const dec = await sqlClient.execute({ sql: `UPDATE user_powerups SET ${COL[kind]} = ${COL[kind]} - 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND ${COL[kind]} > 0`, args: [userId] });
  if (dec.rowsAffected === 0) {
    return { ok: false, error: "You don't have that reward yet — build a streak to earn it." };
  }
  await sqlClient.execute({ sql: "INSERT OR IGNORE INTO powerup_uses (id, user_id, media_id, kind) VALUES (?, ?, ?, ?)", args: [newId("pwu"), userId, mediaId, kind] });
  try {
    const text = await resultText(mediaId, kind);
    return { ok: true, kind, text, balances: await getBalances(userId) };
  } catch (err) {
    // Refund on failure (e.g. AI hiccup).
    await sqlClient.execute({ sql: `UPDATE user_powerups SET ${COL[kind]} = ${COL[kind]} + 1 WHERE user_id = ?`, args: [userId] });
    await sqlClient.execute({ sql: "DELETE FROM powerup_uses WHERE user_id = ? AND media_id = ? AND kind = ?", args: [userId, mediaId, kind] });
    return { ok: false, error: (err as Error).message };
  }
}

/** Detail-page state: balances + any already-unlocked results for this media. */
export async function getMediaRewardState(userId: string, mediaId: string): Promise<{ balances: Balances; unlocked: Partial<Record<PowerupKind, string>> }> {
  const balances = await getBalances(userId);
  const uses = await sqlClient.execute({ sql: "SELECT kind FROM powerup_uses WHERE user_id = ? AND media_id = ?", args: [userId, mediaId] });
  const unlocked: Partial<Record<PowerupKind, string>> = {};
  for (const row of uses.rows) {
    const kind = row.kind as PowerupKind;
    unlocked[kind] = await resultText(mediaId, kind);
  }
  return { balances, unlocked };
}
