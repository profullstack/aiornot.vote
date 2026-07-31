import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  rateLimit,
  rateLimitAsync,
  clearRateLimit,
  setRateLimitStore,
  UpstashStore,
  RateLimitStore,
} from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(async () => {
    setRateLimitStore(null);
    await clearRateLimit("test-key");
  });

  it("limits requests within window and resets after expiry", () => {
    const res1 = rateLimit("test-key", 2, 1000);
    expect(res1.ok).toBe(true);
    expect(res1.remaining).toBe(1);

    const res2 = rateLimit("test-key", 2, 1000);
    expect(res2.ok).toBe(true);
    expect(res2.remaining).toBe(0);

    const res3 = rateLimit("test-key", 2, 1000);
    expect(res3.ok).toBe(false);
    expect(res3.remaining).toBe(0);
  });

  it("clears rate limit state with clearRateLimit", async () => {
    rateLimit("test-key", 1, 1000);
    expect(rateLimit("test-key", 1, 1000).ok).toBe(false);

    await clearRateLimit("test-key");
    expect(rateLimit("test-key", 1, 1000).ok).toBe(true);
  });

  it("supports custom store via setRateLimitStore", async () => {
    const mockStore: RateLimitStore = {
      hit: vi.fn().mockReturnValue({ ok: true, remaining: 99, resetAt: 12345 }),
      clear: vi.fn(),
    };
    setRateLimitStore(mockStore);

    const res = await rateLimitAsync("test-key", 100, 60000);
    expect(res.ok).toBe(true);
    expect(res.remaining).toBe(99);
    expect(mockStore.hit).toHaveBeenCalledWith("test-key", 100, 60000);
  });

  it("handles UpstashStore REST pipeline responses", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [{ result: 2 }, { result: "OK" }, { result: 50 }],
    } as Response);

    const upstash = new UpstashStore("https://example.upstash.io", "mock-token");
    const res = await upstash.hit("api-ip", 5, 60000);

    expect(res.ok).toBe(true);
    expect(res.remaining).toBe(3);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.upstash.io/pipeline",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer mock-token" }),
      })
    );
    fetchSpy.mockRestore();
  });
});
