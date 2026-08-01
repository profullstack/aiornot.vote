import { createClient, type Client, type InStatement } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getMostFollowed, getMostFollowing } from "./social";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({
  sqlClient: { execute: mocks.execute },
}));

let client: Client;

describe("follow leaderboards", () => {
  beforeAll(async () => {
    client = createClient({ url: "file::memory:" });
    mocks.execute.mockImplementation((statement: InStatement) => client.execute(statement));
    await client.execute(`CREATE TABLE users (
      id TEXT PRIMARY KEY,
      display_name TEXT,
      status TEXT NOT NULL
    )`);
    await client.execute(`CREATE TABLE follows (
      follower_id TEXT NOT NULL,
      followee_id TEXT NOT NULL,
      PRIMARY KEY (follower_id, followee_id)
    )`);
  });

  beforeEach(async () => {
    await client.execute("DELETE FROM follows");
    await client.execute("DELETE FROM users");
    await client.execute(`INSERT INTO users (id, display_name, status) VALUES
      ('alice', 'Alice', 'active'),
      ('bob', 'Bob', 'active'),
      ('suspended', 'Suspended', 'suspended'),
      ('deleted', 'Deleted', 'deleted')`);
    await client.execute(`INSERT INTO follows (follower_id, followee_id) VALUES
      ('bob', 'alice'),
      ('suspended', 'alice'),
      ('deleted', 'alice'),
      ('alice', 'bob'),
      ('alice', 'suspended'),
      ('alice', 'deleted')`);
  });

  afterAll(() => {
    client.close();
  });

  it("excludes inactive followers from the most-followed counts", async () => {
    const rows = await getMostFollowed();

    expect(rows.find((row) => row.userId === "alice")?.count).toBe(1);
    expect(rows.some((row) => row.userId === "suspended" || row.userId === "deleted")).toBe(false);
  });

  it("excludes inactive followees from the most-following counts", async () => {
    const rows = await getMostFollowing();

    expect(rows.find((row) => row.userId === "alice")?.count).toBe(1);
    expect(rows.some((row) => row.userId === "suspended" || row.userId === "deleted")).toBe(false);
  });
});
