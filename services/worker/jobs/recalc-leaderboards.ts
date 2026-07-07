import "./_env.js";
import { getClient } from "@aiornot/db";

/**
 * Recompute media_stats and user_stats from the guesses table. Safe to run on a
 * cron. Keeps derived tables consistent even if a live update was missed.
 */
async function main() {
  const client = getClient();

  const media = await client.execute("SELECT id, truth_label FROM media");
  console.log(`Recomputing stats for ${media.rows.length} media…`);
  for (const m of media.rows) {
    const mediaId = m.id as string;
    const r = await client.execute({
      sql: `SELECT
              SUM(CASE WHEN guess='ai' THEN 1 ELSE 0 END) ai,
              SUM(CASE WHEN guess='not_ai' THEN 1 ELSE 0 END) not_ai,
              COUNT(*) total,
              SUM(CASE WHEN is_scored=1 AND is_correct=1 THEN 1 ELSE 0 END) correct,
              SUM(CASE WHEN is_scored=1 AND is_correct=0 THEN 1 ELSE 0 END) incorrect
            FROM guesses WHERE media_id = ?`,
      args: [mediaId],
    });
    const row = r.rows[0]!;
    const ai = Number(row.ai ?? 0);
    const notAi = Number(row.not_ai ?? 0);
    const total = Number(row.total ?? 0);
    const correct = Number(row.correct ?? 0);
    const incorrect = Number(row.incorrect ?? 0);
    const scored = correct + incorrect;
    const crowdAcc = scored > 0 ? correct / scored : 0;
    const aiPct = total > 0 ? ai / total : 0;
    const difficulty = 1 - Math.abs(aiPct - 0.5) / 0.5;
    const trending = total * (0.5 + difficulty);
    await client.execute({
      sql: `INSERT INTO media_stats (media_id, ai_guesses, not_ai_guesses, total_guesses, correct_guesses, incorrect_guesses, crowd_accuracy, difficulty_score, trending_score, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(media_id) DO UPDATE SET
              ai_guesses=excluded.ai_guesses, not_ai_guesses=excluded.not_ai_guesses,
              total_guesses=excluded.total_guesses, correct_guesses=excluded.correct_guesses,
              incorrect_guesses=excluded.incorrect_guesses, crowd_accuracy=excluded.crowd_accuracy,
              difficulty_score=excluded.difficulty_score, trending_score=excluded.trending_score, updated_at=CURRENT_TIMESTAMP`,
      args: [mediaId, ai, notAi, total, correct, incorrect, crowdAcc, difficulty, trending],
    });
  }

  const users = await client.execute("SELECT id FROM users");
  console.log(`Recomputing stats for ${users.rows.length} users…`);
  for (const u of users.rows) {
    const userId = u.id as string;
    const all = await client.execute({
      sql: "SELECT is_scored, is_correct, created_at FROM guesses WHERE user_id = ? ORDER BY created_at ASC",
      args: [userId],
    });
    let total = 0, scored = 0, correct = 0, incorrect = 0, best = 0, running = 0;
    let last: string | null = null;
    for (const g of all.rows) {
      total++;
      last = g.created_at as string;
      if (Number(g.is_scored) !== 1) continue;
      scored++;
      if (Number(g.is_correct) === 1) { correct++; running++; if (running > best) best = running; }
      else { incorrect++; running = 0; }
    }
    const accuracy = scored > 0 ? correct / scored : 0;
    await client.execute({
      sql: `INSERT INTO user_stats (user_id, total_guesses, scored_guesses, correct_guesses, incorrect_guesses, accuracy, current_streak, best_streak, last_guess_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
              total_guesses=excluded.total_guesses, scored_guesses=excluded.scored_guesses,
              correct_guesses=excluded.correct_guesses, incorrect_guesses=excluded.incorrect_guesses,
              accuracy=excluded.accuracy, current_streak=excluded.current_streak,
              best_streak=excluded.best_streak, last_guess_at=excluded.last_guess_at, updated_at=CURRENT_TIMESTAMP`,
      args: [userId, total, scored, correct, incorrect, accuracy, running, best, last],
    });
  }

  console.log("Recalc complete.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
