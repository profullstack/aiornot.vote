import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signup: vi.fn(),
  createSession: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ signup: mocks.signup }));
vi.mock("@/lib/session", () => ({ createSession: mocks.createSession }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/crypto", () => ({ hashIp: () => "hashed-ip" }));

import { POST } from "../app/api/auth/signup/route";

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimit.mockResolvedValue({ ok: true });
    mocks.signup.mockResolvedValue({ ok: true, userId: "user-1" });
  });

  it("ignores a malformed referral cookie instead of failing signup", async () => {
    const response = await POST(
      new Request("https://aiornot.vote/api/auth/signup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "aon_ref=%E0%A4%A",
        },
        body: JSON.stringify({
          email: "player@example.com",
          password: "password123",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, needsVerification: true });
    expect(mocks.signup).toHaveBeenCalledWith(
      "player@example.com",
      "password123",
      undefined,
      null,
    );
    expect(mocks.createSession).toHaveBeenCalledWith("user-1");
  });
});
