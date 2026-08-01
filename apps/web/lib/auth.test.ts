import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const database = vi.hoisted(() => {
  let closed = false;
  const transactionExecute = vi.fn();
  const commit = vi.fn(async () => {
    closed = true;
  });
  const rollback = vi.fn(async () => {
    closed = true;
  });
  const close = vi.fn(() => {
    closed = true;
  });
  const transaction = vi.fn(async () => {
    closed = false;
    return {
      execute: transactionExecute,
      commit,
      rollback,
      close,
      get closed() {
        return closed;
      },
    };
  });

  return { execute: vi.fn(), transaction, transactionExecute, commit, rollback, close };
});

vi.mock("./db", () => ({
  sqlClient: { execute: database.execute, transaction: database.transaction },
}));
vi.mock("@aiornot/db", () => ({
  ids: { user: () => "user-1", verification: () => "verification-1" },
}));
vi.mock("./password", () => ({
  hashPassword: vi.fn(async () => "password-hash"),
  verifyPassword: vi.fn(),
}));
vi.mock("./crypto", () => ({
  randomToken: vi.fn(() => "token"),
  hmac: vi.fn(() => "token-hash"),
}));
vi.mock("./env", () => ({
  env: { appUrl: "https://aiornot.vote", verificationTtlMinutes: 30 },
  isAdminEmail: vi.fn(() => false),
}));
vi.mock("./email", () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock("./referrals", () => ({
  recordReferralOnSignup: vi.fn(async () => undefined),
  rewardReferralOnVerify: vi.fn(async () => undefined),
}));

import { resetPassword, signup } from "./auth";
import { DISPLAY_NAME_MAX_LENGTH } from "./profile";

describe("signup display names", () => {
  beforeEach(() => {
    database.execute.mockReset();
    database.transaction.mockClear();
    database.transactionExecute.mockReset();
    database.commit.mockClear();
    database.rollback.mockClear();
    database.close.mockClear();
  });

  it("rejects names longer than the public profile limit before touching the database", async () => {
    await expect(
      signup("player@example.com", "password123", "x".repeat(DISPLAY_NAME_MAX_LENGTH + 1)),
    ).resolves.toEqual({
      ok: false,
      error: `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
    });
    expect(database.execute).not.toHaveBeenCalled();
  });

  it("rejects non-string display names instead of coercing them", async () => {
    await expect(signup("player@example.com", "password123", { name: "Player" })).resolves.toEqual({
      ok: false,
      error: "Display name must be a string.",
    });
    expect(database.execute).not.toHaveBeenCalled();
  });

  it("stores the same whitespace-normalized name used by profile updates", async () => {
    database.execute.mockResolvedValueOnce({ rows: [] });
    database.execute.mockResolvedValue({ rows: [], rowsAffected: 1 });

    await expect(signup("player@example.com", "password123", "  Player\n  One  ")).resolves.toEqual({
      ok: true,
      userId: "user-1",
    });

    expect(database.execute).toHaveBeenCalledWith({
      sql: expect.stringContaining("INSERT INTO users"),
      args: ["user-1", "player@example.com", "player@example.com", "password-hash", "Player One", "user"],
    });
  });
});

describe("password reset token consumption", () => {
  beforeEach(() => {
    database.execute.mockReset();
    database.transaction.mockClear();
    database.transactionExecute.mockReset();
    database.commit.mockClear();
    database.rollback.mockClear();
    database.close.mockClear();
  });

  it("rejects a request that loses the atomic token claim", async () => {
    database.execute.mockResolvedValueOnce({
      rows: [{ id: "reset-1", user_id: "user-1", expires_at: "2999-01-01T00:00:00.000Z", consumed_at: null }],
    });
    database.transactionExecute.mockResolvedValueOnce({ rows: [], rowsAffected: 0 });

    await expect(resetPassword("token", "new-password")).resolves.toEqual({
      ok: false,
      error: "This reset link was already used.",
    });

    expect(database.transactionExecute).toHaveBeenCalledTimes(1);
    expect(database.transactionExecute).toHaveBeenCalledWith({
      sql: expect.stringContaining("consumed_at IS NULL"),
      args: ["reset-1"],
    });
    expect(database.rollback).toHaveBeenCalledOnce();
    expect(database.commit).not.toHaveBeenCalled();
  });

  it("changes the password and invalidates sessions in the claiming transaction", async () => {
    database.execute.mockResolvedValueOnce({
      rows: [{ id: "reset-1", user_id: "user-1", expires_at: "2999-01-01T00:00:00.000Z", consumed_at: null }],
    });
    database.transactionExecute.mockResolvedValue({ rows: [], rowsAffected: 1 });

    await expect(resetPassword("token", "new-password")).resolves.toEqual({
      ok: true,
      userId: "user-1",
    });

    expect(database.transaction).toHaveBeenCalledWith("write");
    expect(database.transactionExecute).toHaveBeenCalledTimes(4);
    expect(database.transactionExecute).toHaveBeenNthCalledWith(2, {
      sql: expect.stringContaining("UPDATE users"),
      args: ["password-hash", "user-1"],
    });
    expect(database.transactionExecute).toHaveBeenNthCalledWith(4, {
      sql: "DELETE FROM sessions WHERE user_id = ?",
      args: ["user-1"],
    });
    expect(database.commit).toHaveBeenCalledOnce();
    expect(database.rollback).not.toHaveBeenCalled();
  });
});
