import { beforeEach, describe, expect, it } from "vitest";
import { clearRateLimit, rateLimit } from "./rate-limit";

describe("rateLimit in-memory fixed-window bucket logic", () => {
  beforeEach(() => {
    clearRateLimit();
  });

  it("allows initial request within limit and calculates remaining count", () => {
    const res = rateLimit("ip:127.0.0.1", 5, 60_000);
    expect(res.ok).toBe(true);
    expect(res.remaining).toBe(4);
    expect(res.resetAt).toBeGreaterThan(Date.now());
  });

  it("blocks requests when rate limit threshold is exceeded", () => {
    const key = "ip:192.168.1.1";
    for (let i = 0; i < 3; i++) {
      rateLimit(key, 3, 60_000);
    }
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets bucket after clearRateLimit is called", () => {
    const key = "user:123";
    rateLimit(key, 1, 60_000);
    const blocked = rateLimit(key, 1, 60_000);
    expect(blocked.ok).toBe(false);

    clearRateLimit(key);
    const res = rateLimit(key, 1, 60_000);
    expect(res.ok).toBe(true);
    expect(res.remaining).toBe(0);
  });
});
