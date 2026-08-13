import { createClient, type Client, type InStatement } from "@libsql/client";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { drawWeeklyPrizes } from "./prizes";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  transaction: vi.fn(),
  newId: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("./db", () => ({
  sqlClient: {
    execute: mocks.execute,
    transaction: mocks.transaction,
  },
}));

vi.mock("@aiornot/db", () => ({
  newId: mocks.newId,
}));

vi.mock("./env", () => ({
  env: {
    adminEmails: [],
    appUrl: "https://example.com",
    prizeMinScored: 1,
  },
}));

vi.mock("./email", () => ({
  sendEmail: mocks.sendEmail,
}));

let client: Client;
let nextId = 0;
const databasePath = join(tmpdir(), "aiornot-prizes-test.db");

function sqlText(statement: unknown): string {
  if (typeof statement === "string") return statement;
  return String((statement as { sql?: unknown }).sql ?? "");
}

describe("drawWeeklyPrizes", () => {
  beforeAll(async () => {
    rmSync(databasePath, { force: true });
    client = createClient({ url: `file:${databasePath}` });
    await client.execute(`CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT,
      email_verified_at TEXT,
      status TEXT NOT NULL
    )`);
    await client.execute(`CREATE TABLE guesses (
      user_id TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      is_scored INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`);
    await client.execute(`CREATE TABLE prizes (
      id TEXT PRIMARY KEY,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      rank INTEGER NOT NULL,
      reward_kind TEXT NOT NULL,
      reward_label TEXT NOT NULL,
      user_id TEXT,
      status TEXT NOT NULL,
      claim_deadline TEXT NOT NULL,
      claimed_at TEXT,
      carried_over INTEGER NOT NULL DEFAULT 0,
      notified_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      source TEXT NOT NULL DEFAULT 'weekly'
    )`);
    await client.execute(`CREATE TABLE prize_sponsorships (
      id TEXT PRIMARY KEY,
      prize_label TEXT NOT NULL,
      sponsor_name TEXT NOT NULL,
      period_start TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  });

  beforeEach(async () => {
    await client.execute("DELETE FROM guesses");
    await client.execute("DELETE FROM users");
    await client.execute("DELETE FROM prizes");
    await client.execute("DELETE FROM prize_sponsorships");

    nextId = 0;
    mocks.newId.mockReset();
    mocks.newId.mockImplementation((prefix: string) => `${prefix}_test_${++nextId}`);
    mocks.sendEmail.mockReset();
    mocks.execute.mockReset();
    mocks.execute.mockImplementation((statement: InStatement) => client.execute(statement));
    mocks.transaction.mockReset();
    mocks.transaction.mockImplementation((mode: "write") => client.transaction(mode));
  });

  afterAll(() => {
    client.close();
  });

  it("creates one prize pack when two draws start concurrently", async () => {
    let idempotencyReads = 0;
    let releaseReads!: () => void;
    const bothRead = new Promise<void>((resolve) => { releaseReads = resolve; });

    mocks.execute.mockImplementation(async (statement: InStatement) => {
      const result = await client.execute(statement);
      if (sqlText(statement).includes("SELECT 1 FROM prizes WHERE period_start")) {
        idempotencyReads++;
        if (idempotencyReads === 2) releaseReads();
        await bothRead;
      }
      return result;
    });

    const period = {
      start: "2026-08-03T00:00:00.000Z",
      end: "2026-08-10T00:00:00.000Z",
    };
    const results = await Promise.all([
      drawWeeklyPrizes({ period }),
      drawWeeklyPrizes({ period }),
    ]);

    expect(results.filter((result) => result.drawn)).toHaveLength(1);
    const prizes = await client.execute({
      sql: "SELECT COUNT(*) AS count FROM prizes WHERE period_start = ?",
      args: [period.start],
    });
    expect(Number(prizes.rows[0]?.count)).toBe(3);
  });
});
