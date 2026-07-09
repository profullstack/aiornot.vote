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
});
