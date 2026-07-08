import "server-only";
import { sqlClient } from "./db";
import { ids } from "@aiornot/db";
import { awardMilestones, type Milestone } from "./rewards";

export type CastGuessResult =
  | {
      ok: true;
      guess: "ai" | "not_ai";
      scored: boolean;
      isCorrect: boolean | null;
      truthLabel: "ai" | "not_ai" | "unknown";
      revealTruth: boolean;
      alreadyVoted: boolean;
      earned?: Milestone | null;
      stats: { aiGuesses: number; notAiGuesses: number; total: number; totalGuesses: number; aiPct: number };
    }
  | { ok: false; error: string; code: number };

async function readMediaStats(
  mediaId: string,
): Promise<{ aiGuesses: number; notAiGuesses: number; total: number; totalGuesses: number; aiPct: number }> {
  const r = await sqlClient.execute({
    sql: "SELECT ai_guesses, not_ai_guesses, total_guesses FROM media_stats WHERE media_id = ? LIMIT 1",
    args: [mediaId],
  });
  const row = r.rows[0];
  const ai = Number(row?.ai_guesses ?? 0);
  const notAi = Number(row?.not_ai_guesses ?? 0);
  const total = Number(row?.total_guesses ?? 0);
  return { aiGuesses: ai, notAiGuesses: notAi, total, totalGuesses: total, aiPct: total > 0 ? Math.round((ai / total) * 100) : 0 };
}

/**
 * Anonymous trial guess: computes correctness and returns the reveal + current
 * crowd stats WITHOUT persisting anything (no guess row, no stat change, no
 * streak). Used for the free pre-signup rounds. Never touches the leaderboard.
 */
export async function castGuessAnon(
  mediaId: string,
  guess: "ai" | "not_ai",
): Promise<CastGuessResult> {
  const mres = await sqlClient.execute({
    sql: `SELECT id, truth_label, is_score_eligible, status FROM media WHERE id = ? LIMIT 1`,
    args: [mediaId],
  });
  const m = mres.rows[0];
  if (!m || m.status !== "approved") {
    return { ok: false, error: "Media not found.", code: 404 };
  }
  const truthLabel = m.truth_label as "ai" | "not_ai" | "unknown";
  const scoreEligible = Number(m.is_score_eligible ?? 1) === 1;
  const scored = scoreEligible && (truthLabel === "ai" || truthLabel === "not_ai");
  const isCorrect = scored ? guess === truthLabel : null;
  return {
    ok: true,
    guess,
    scored,
    isCorrect,
    truthLabel,
    revealTruth: truthLabel !== "unknown",
    alreadyVoted: false,
    earned: null,
    stats: await readMediaStats(mediaId),
  };
}

/** Cast or change a guess. Recomputes media + user stats (simple, correct). */
export async function castGuess(
  userId: string,
  mediaId: string,
  guess: "ai" | "not_ai",
  ipHash: string | null,
  uaHash: string | null,
): Promise<CastGuessResult> {
  const mres = await sqlClient.execute({
    sql: `SELECT id, truth_label, is_score_eligible, reveal_status, status
          FROM media WHERE id = ? LIMIT 1`,
    args: [mediaId],
  });
  const m = mres.rows[0];
  if (!m || m.status !== "approved") {
    return { ok: false, error: "Media not found.", code: 404 };
  }
  if (m.reveal_status === "locked") {
    return { ok: false, error: "This item is locked; guesses can no longer change.", code: 409 };
  }

  const truthLabel = m.truth_label as "ai" | "not_ai" | "unknown";
  const scoreEligible = Number(m.is_score_eligible ?? 1) === 1;
  const scored = scoreEligible && (truthLabel === "ai" || truthLabel === "not_ai");
  const isCorrect = scored ? (guess === truthLabel ? 1 : 0) : null;

  // A vote is one-and-done: if the user already voted on this item, return their
  // existing vote unchanged. This prevents flipping the answer after the reveal.
  const existing = await sqlClient.execute({
    sql: "SELECT guess, is_correct, is_scored FROM guesses WHERE media_id = ? AND user_id = ? LIMIT 1",
    args: [mediaId, userId],
  });
  if (existing.rows.length > 0) {
    const g = existing.rows[0]!;
    return {
      ok: true,
      guess: g.guess as "ai" | "not_ai",
      scored: Number(g.is_scored) === 1,
      isCorrect: g.is_correct == null ? null : Number(g.is_correct) === 1,
      truthLabel,
      revealTruth: truthLabel !== "unknown",
      alreadyVoted: true,
      stats: await readMediaStats(mediaId),
    };
  }

  // First vote wins even under a race: DO NOTHING on the unique (media,user) key.
  await sqlClient.execute({
    sql: `INSERT INTO guesses (id, media_id, user_id, guess, is_correct, is_scored, ip_hash, user_agent_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(media_id, user_id) DO NOTHING`,
    args: [ids.guess(), mediaId, userId, guess, isCorrect, scored ? 1 : 0, ipHash, uaHash],
  });

  // Read back the authoritative stored vote (handles the race where another
  // request inserted first).
  const stored = await sqlClient.execute({
    sql: "SELECT guess, is_correct, is_scored FROM guesses WHERE media_id = ? AND user_id = ? LIMIT 1",
    args: [mediaId, userId],
  });
  const s = stored.rows[0]!;

  const stats = await recomputeMediaStats(mediaId, truthLabel);
  await recomputeUserStats(userId);

  // If this correct guess pushed the streak onto a milestone, grant the reward.
  let earned: Milestone | null = null;
  if (Number(s.is_scored) === 1 && Number(s.is_correct) === 1) {
    const us = await sqlClient.execute({ sql: "SELECT current_streak FROM user_stats WHERE user_id = ? LIMIT 1", args: [userId] });
    earned = await awardMilestones(userId, Number(us.rows[0]?.current_streak ?? 0));
  }

  return {
    ok: true,
    guess: s.guess as "ai" | "not_ai",
    scored: Number(s.is_scored) === 1,
    isCorrect: s.is_correct == null ? null : Number(s.is_correct) === 1,
    truthLabel,
    revealTruth: truthLabel !== "unknown",
    alreadyVoted: false,
    earned,
    stats,
  };
}

export async function recomputeMediaStats(
  mediaId: string,
  truthLabel: "ai" | "not_ai" | "unknown",
): Promise<{ aiGuesses: number; notAiGuesses: number; total: number; totalGuesses: number; aiPct: number }> {
  const res = await sqlClient.execute({
    sql: `SELECT
            SUM(CASE WHEN guess = 'ai' THEN 1 ELSE 0 END) AS ai,
            SUM(CASE WHEN guess = 'not_ai' THEN 1 ELSE 0 END) AS not_ai,
            COUNT(*) AS total,
            SUM(CASE WHEN is_scored = 1 AND is_correct = 1 THEN 1 ELSE 0 END) AS correct,
            SUM(CASE WHEN is_scored = 1 AND is_correct = 0 THEN 1 ELSE 0 END) AS incorrect
          FROM guesses WHERE media_id = ?`,
    args: [mediaId],
  });
  const r = res.rows[0]!;
  const ai = Number(r.ai ?? 0);
  const notAi = Number(r.not_ai ?? 0);
  const total = Number(r.total ?? 0);
  const correct = Number(r.correct ?? 0);
  const incorrect = Number(r.incorrect ?? 0);
  const scoredTotal = correct + incorrect;
  const crowdAccuracy = scoredTotal > 0 ? correct / scoredTotal : 0;
  const aiPct = total > 0 ? ai / total : 0;
  // Difficulty: closeness to a 50/50 split (hardest = 1).
  const difficulty = 1 - Math.abs(aiPct - 0.5) / 0.5;
  const trending = total * (0.5 + difficulty);

  await sqlClient.execute({
    sql: `INSERT INTO media_stats
            (media_id, ai_guesses, not_ai_guesses, total_guesses, correct_guesses,
             incorrect_guesses, crowd_accuracy, difficulty_score, trending_score, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(media_id) DO UPDATE SET
            ai_guesses = excluded.ai_guesses,
            not_ai_guesses = excluded.not_ai_guesses,
            total_guesses = excluded.total_guesses,
            correct_guesses = excluded.correct_guesses,
            incorrect_guesses = excluded.incorrect_guesses,
            crowd_accuracy = excluded.crowd_accuracy,
            difficulty_score = excluded.difficulty_score,
            trending_score = excluded.trending_score,
            updated_at = CURRENT_TIMESTAMP`,
    args: [mediaId, ai, notAi, total, correct, incorrect, crowdAccuracy, difficulty, trending],
  });

  return { aiGuesses: ai, notAiGuesses: notAi, total, totalGuesses: total, aiPct: Math.round(aiPct * 100) };
}

export async function recomputeUserStats(userId: string): Promise<void> {
  const all = await sqlClient.execute({
    sql: `SELECT is_scored, is_correct, created_at FROM guesses
          WHERE user_id = ? ORDER BY created_at ASC`,
    args: [userId],
  });
  let total = 0;
  let scored = 0;
  let correct = 0;
  let incorrect = 0;
  let best = 0;
  let running = 0;
  let lastGuessAt: string | null = null;

  for (const r of all.rows) {
    total++;
    lastGuessAt = r.created_at as string;
    if (Number(r.is_scored ?? 0) !== 1) continue;
    scored++;
    if (Number(r.is_correct) === 1) {
      correct++;
      running++;
      if (running > best) best = running;
    } else {
      incorrect++;
      running = 0;
    }
  }
  const accuracy = scored > 0 ? correct / scored : 0;

  await sqlClient.execute({
    sql: `INSERT INTO user_stats
            (user_id, total_guesses, scored_guesses, correct_guesses, incorrect_guesses,
             accuracy, current_streak, best_streak, last_guess_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id) DO UPDATE SET
            total_guesses = excluded.total_guesses,
            scored_guesses = excluded.scored_guesses,
            correct_guesses = excluded.correct_guesses,
            incorrect_guesses = excluded.incorrect_guesses,
            accuracy = excluded.accuracy,
            current_streak = excluded.current_streak,
            best_streak = excluded.best_streak,
            last_guess_at = excluded.last_guess_at,
            updated_at = CURRENT_TIMESTAMP`,
    args: [userId, total, scored, correct, incorrect, accuracy, running, best, lastGuessAt],
  });
}
