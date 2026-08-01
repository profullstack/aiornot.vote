import { beforeEach, describe, expect, it, vi } from "vitest";
import { castGuess, castGuessAnon } from "./guess";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("./db", () => ({
  sqlClient: {
    execute: mocks.execute,
  },
}));

vi.mock("@aiornot/db", () => ({
  ids: {
    guess: () => "guess_test",
  },
}));

vi.mock("./rewards", () => ({
  awardMilestones: vi.fn(async () => null),
}));

function sqlText(query: unknown): string {
  if (typeof query === "string") return query;
  return String((query as { sql?: unknown }).sql ?? "");
}

describe("guess members-only access", () => {
  beforeEach(() => {
    mocks.execute.mockReset();
  });

  it("blocks anonymous guesses for members-only media", async () => {
    mocks.execute.mockImplementation(async (query: unknown) => {
      const sql = sqlText(query);
      if (sql.includes("FROM media WHERE id = ?")) {
        return { rows: [{ id: "media_1", truth_label: "ai", is_score_eligible: 1, status: "approved" }] };
      }
      if (sql.includes("FROM media_tags mt JOIN tags")) {
        return { rows: [{ exists: 1 }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(castGuessAnon("media_1", "ai")).resolves.toEqual({
      ok: false,
      error: "Media not found.",
      code: 404,
    });
    expect(mocks.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({ sql: expect.stringContaining("FROM media_stats") }),
    );
  });

  it("blocks non-member account guesses for members-only media", async () => {
    mocks.execute.mockImplementation(async (query: unknown) => {
      const sql = sqlText(query);
      if (sql.includes("FROM media WHERE id = ?")) {
        return {
          rows: [{
            id: "media_1",
            truth_label: "not_ai",
            is_score_eligible: 1,
            reveal_status: "hidden_until_guess",
            status: "approved",
          }],
        };
      }
      if (sql.includes("FROM media_tags mt JOIN tags")) {
        return { rows: [{ exists: 1 }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(castGuess("user_1", "media_1", "not_ai", null, null, false)).resolves.toEqual({
      ok: false,
      error: "Media not found.",
      code: 404,
    });
    expect(mocks.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({ sql: expect.stringContaining("FROM guesses") }),
    );
  });

  it("allows lifetime members to guess members-only media", async () => {
    mocks.execute.mockImplementation(async (query: unknown) => {
      const sql = sqlText(query);
      if (sql.includes("FROM media WHERE id = ?")) {
        return {
          rows: [{
            id: "media_1",
            truth_label: "ai",
            is_score_eligible: 1,
            reveal_status: "hidden_until_guess",
            status: "approved",
          }],
        };
      }
      if (sql.includes("FROM guesses")) {
        return { rows: [{ guess: "ai", is_correct: 1, is_scored: 1 }] };
      }
      if (sql.includes("FROM media_stats")) {
        return { rows: [{ ai_guesses: 3, not_ai_guesses: 1, total_guesses: 4 }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(castGuess("user_1", "media_1", "ai", null, null, true)).resolves.toMatchObject({
      ok: true,
      guess: "ai",
      scored: true,
      isCorrect: true,
      alreadyVoted: true,
      stats: { totalGuesses: 4, aiPct: 75 },
    });
    expect(mocks.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({ sql: expect.stringContaining("FROM media_tags mt JOIN tags") }),
    );
  });

  it("handles race condition: concurrent votes return stored guess with alreadyVoted=true", async () => {
    mocks.execute.mockImplementation(async (query: unknown) => {
      const sql = sqlText(query);
      if (sql.includes("FROM media WHERE id = ?")) {
        return {
          rows: [{
            id: "media_1",
            truth_label: "ai",
            is_score_eligible: 1,
            reveal_status: "hidden_until_guess",
            status: "approved",
          }],
        };
      }
      if (sql.includes("FROM media_tags mt JOIN tags")) {
        return { rows: [] };
      }
      if (sql.includes("FROM guesses WHERE media_id = ? AND user_id = ?")) {
        // First call: no existing vote, second call (after INSERT): return the other guess
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO guesses")) {
        // Simulate DO NOTHING - no rows affected
        return { rows: [], rowsAffected: 0 };
      }
      if (sql.includes("SELECT guess, is_correct, is_scored FROM guesses")) {
        // Return a different guess than requested (simulating race winner)
        return { rows: [{ guess: "not_ai", is_correct: 0, is_scored: 1 }] };
      }
      if (sql.includes("FROM media_stats")) {
        return { rows: [{ ai_guesses: 3, not_ai_guesses: 1, total_guesses: 4 }] };
      }
      if (sql.includes("FROM user_stats")) {
        return { rows: [{ current_streak: 0 }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    // User requests "ai" but race winner was "not_ai"
    const result = await castGuess("user_1", "media_1", "ai", null, null, true);
    expect(result.ok).toBe(true);
    expect(result.guess).toBe("not_ai"); // Returns the race winner's guess
    expect(result.alreadyVoted).toBe(true); // Signals conflict
    expect(result.alreadyVoted).not.toBe(false);
  });
});
