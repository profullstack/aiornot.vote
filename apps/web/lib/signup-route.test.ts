import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@libsql/client";
import { createProfileStore } from "@profullstack/profile";

// The shared profile store on a real in-memory SQLite (the local edition of
// the schema), so the test checks what actually lands in user_profiles.
const store = createProfileStore(createClient({ url: "file::memory:" }));

const mocks = vi.hoisted(() => ({
  signup: vi.fn(),
  createSession: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ signup: mocks.signup }));
vi.mock("@/lib/session", () => ({ createSession: mocks.createSession }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/crypto", () => ({ hashIp: () => "hashed-ip" }));
vi.mock("@/lib/user-profile", () => ({ profileStore: () => store }));

import { POST } from "../app/api/auth/signup/route";

const NAMES = { first_name: "Ada", last_name: "Lovelace" };

function signupRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request("https://aiornot.vote/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/signup", () => {
  beforeAll(async () => {
    await store.migrate();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimit.mockResolvedValue({ ok: true });
    mocks.signup.mockResolvedValue({ ok: true, userId: "user-1" });
  });

  it("ignores a malformed referral cookie instead of failing signup", async () => {
    const response = await POST(
      signupRequest(
        { email: "player@example.com", password: "x".repeat(12), ...NAMES },
        { cookie: "aon_ref=%E0%A4%A" },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, needsVerification: true });
    expect(mocks.signup).toHaveBeenCalledWith(
      "player@example.com",
      "x".repeat(12),
      undefined,
      null,
    );
    expect(mocks.createSession).toHaveBeenCalledWith("user-1");
  });

  it("stores the profile fields once the user exists", async () => {
    mocks.signup.mockResolvedValue({ ok: true, userId: "user-2" });
    const response = await POST(
      signupRequest({
        email: "Ada@Acme.com",
        password: "x".repeat(12),
        ...NAMES,
        company_domain: "https://www.acme.com/about",
        job_title: "VP Engineering",
        linkedin_url: "in/ada-lovelace",
      }),
    );

    expect(response.status).toBe(200);
    expect(await store.get("user-2")).toMatchObject({
      email: "ada@acme.com",
      first_name: "Ada",
      last_name: "Lovelace",
      company_domain: "acme.com",
      job_title: "VP Engineering",
      linkedin_url: "https://www.linkedin.com/in/ada-lovelace",
    });
  });

  it("refuses a signup without a name before any account is made", async () => {
    const response = await POST(
      signupRequest({ email: "player@example.com", password: "x".repeat(12) }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(Object.keys(body.errors)).toEqual(expect.arrayContaining(["first_name", "last_name"]));
    expect(mocks.signup).not.toHaveBeenCalled();
  });
});
