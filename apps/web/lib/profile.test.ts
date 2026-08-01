import { describe, expect, it } from "vitest";
import {
  DISPLAY_NAME_MAX_LENGTH,
  displayNameUpdateStatement,
  normalizeDisplayName,
  readProfileRequest,
} from "./profile";

function request(body: string): Request {
  return new Request("https://aiornot.vote/api/account/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("display name normalization", () => {
  it("trims and collapses whitespace while preserving Unicode", () => {
    expect(normalizeDisplayName("  Phúc\n  Nguyễn  ")).toEqual({
      ok: true,
      displayName: "Phúc Nguyễn",
    });
  });

  it("uses an empty value to clear the display name", () => {
    expect(normalizeDisplayName("  \t\n ")).toEqual({ ok: true, displayName: null });
  });

  it("counts Unicode code points and enforces the public limit", () => {
    expect(normalizeDisplayName("🤘".repeat(DISPLAY_NAME_MAX_LENGTH))).toEqual({
      ok: true,
      displayName: "🤘".repeat(DISPLAY_NAME_MAX_LENGTH),
    });
    expect(normalizeDisplayName("🤘".repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toEqual({
      ok: false,
      error: `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
    });
  });

  it("rejects non-string values", () => {
    expect(normalizeDisplayName(null)).toEqual({
      ok: false,
      error: "Display name must be a string.",
    });
    expect(normalizeDisplayName({ toString: () => "admin" })).toEqual({
      ok: false,
      error: "Display name must be a string.",
    });
  });
});

describe("profile request parsing", () => {
  it("rejects malformed JSON and non-object bodies", async () => {
    await expect(readProfileRequest(request('{"displayName":'))).resolves.toEqual({
      ok: false,
      error: "Invalid JSON body.",
    });
    await expect(readProfileRequest(request("null"))).resolves.toEqual({
      ok: false,
      error: "Invalid request body.",
    });
    await expect(readProfileRequest(request("[]"))).resolves.toEqual({
      ok: false,
      error: "Invalid request body.",
    });
  });

  it("requires an explicit displayName field", async () => {
    await expect(readProfileRequest(request("{}"))).resolves.toEqual({
      ok: false,
      error: "displayName is required.",
    });
  });

  it("keeps untrusted values in parameterized SQL args", () => {
    const malicious = `Robert'); UPDATE users SET role='admin'; --`;
    const statement = displayNameUpdateStatement("user-123", malicious);

    expect(statement.sql).toBe("UPDATE users SET display_name = ? WHERE id = ?");
    expect(statement.sql).not.toContain(malicious);
    expect(statement.args).toEqual([malicious, "user-123"]);
  });
});
