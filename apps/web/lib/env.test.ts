import { afterEach, describe, expect, it, vi } from "vitest";

async function loadEnv() {
  vi.resetModules();
  return (await import("./env")).env;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("env numeric configuration", () => {
  it("loads valid positive integer limits and USD prices", async () => {
    vi.stubEnv("MAX_IMAGE_UPLOAD_MB", "24");
    vi.stubEnv("MAX_VIDEO_DURATION_SECONDS", "45");
    vi.stubEnv("PRIZE_MIN_SCORED", "5");
    vi.stubEnv("PRICE_API_ACCESS_USD", "1.50");

    const env = await loadEnv();

    expect(env.maxImageUploadMb).toBe(24);
    expect(env.maxVideoDurationSeconds).toBe(45);
    expect(env.prizeMinScored).toBe(5);
    expect(env.priceApiAccessUsd).toBe(1.5);
  });

  it("falls back for malformed or non-positive limits", async () => {
    vi.stubEnv("MAX_IMAGE_UPLOAD_MB", "10abc");
    vi.stubEnv("MAX_VIDEO_UPLOAD_MB", "0");
    vi.stubEnv("RSS_CACHE_SECONDS", "1.5");
    vi.stubEnv("PRIZE_MIN_SCORED", "3abc");

    const env = await loadEnv();

    expect(env.maxImageUploadMb).toBe(12);
    expect(env.maxVideoUploadMb).toBe(75);
    expect(env.rssCacheSeconds).toBe(300);
    expect(env.prizeMinScored).toBe(3);
  });

  it("falls back for invalid checkout prices", async () => {
    vi.stubEnv("PRICE_API_ACCESS_USD", "0");
    vi.stubEnv("PRICE_LIFETIME_USD", "-2");
    vi.stubEnv("PRICE_PLAY_PASS_USD", "Infinity");

    const env = await loadEnv();

    expect(env.priceApiAccessUsd).toBe(1);
    expect(env.priceLifetimeUsd).toBe(2);
    expect(env.pricePlayPassUsd).toBe(1);
  });
});
