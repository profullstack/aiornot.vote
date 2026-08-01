import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock("./db", () => ({
  sqlClient: { execute },
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

import { signup } from "./auth";
import { DISPLAY_NAME_MAX_LENGTH } from "./profile";

describe("signup display names", () => {
  beforeEach(() => {
    execute.mockReset();
  });

  it("rejects names longer than the public profile limit before touching the database", async () => {
    await expect(
      signup("player@example.com", "password123", "x".repeat(DISPLAY_NAME_MAX_LENGTH + 1)),
    ).resolves.toEqual({
      ok: false,
      error: `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects non-string display names instead of coercing them", async () => {
    await expect(signup("player@example.com", "password123", { name: "Player" })).resolves.toEqual({
      ok: false,
      error: "Display name must be a string.",
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("stores the same whitespace-normalized name used by profile updates", async () => {
    execute.mockResolvedValueOnce({ rows: [] });
    execute.mockResolvedValue({ rows: [], rowsAffected: 1 });

    await expect(signup("player@example.com", "password123", "  Player\n  One  ")).resolves.toEqual({
      ok: true,
      userId: "user-1",
    });

    expect(execute).toHaveBeenCalledWith({
      sql: expect.stringContaining("INSERT INTO users"),
      args: ["user-1", "player@example.com", "player@example.com", "password-hash", "Player One", "user"],
    });
  });
});
