/**
 * Fixed-window rate limiter supporting both in-memory local fallback and
 * distributed multi-instance storage (e.g. Upstash Redis REST API).
 */

export type Bucket = { count: number; resetAt: number };
export type RateLimitResult = { ok: boolean; remaining: number; resetAt: number };

export interface RateLimitStore {
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> | RateLimitResult;
  clear?(key: string): Promise<void> | void;
}

class MemoryStore implements RateLimitStore {
  private buckets = new Map<string, Bucket>();

  constructor() {
    if (typeof setInterval !== "undefined") {
      setInterval(() => {
        const now = Date.now();
        for (const [k, v] of this.buckets) {
          if (v.resetAt < now) this.buckets.delete(k);
        }
      }, 60_000).unref?.();
    }
  }

  hit(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || b.resetAt < now) {
      const resetAt = now + windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { ok: true, remaining: limit - 1, resetAt };
    }
    b.count++;
    const ok = b.count <= limit;
    return { ok, remaining: Math.max(0, limit - b.count), resetAt: b.resetAt };
  }

  clear(key: string): void {
    this.buckets.delete(key);
  }
}

/** Upstash REST API store for multi-instance distributed deployments */
export class UpstashStore implements RateLimitStore {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url.replace(/\/$/, "");
    this.token = token;
  }

  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowSec = Math.ceil(windowMs / 1000);
    const redisKey = `ratelimit:${key}`;

    try {
      // Atomic pipeline: INCR and EXPIRE if new
      const res = await fetch(`${this.url}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", redisKey],
          ["EXPIRE", redisKey, windowSec, "NX"],
          ["TTL", redisKey],
        ]),
      });

      if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
      const data = await res.json();
      const count = Number(data[0]?.result ?? 1);
      const ttlSec = Number(data[2]?.result ?? windowSec);

      const resetAt = now + (ttlSec > 0 ? ttlSec * 1000 : windowMs);
      const ok = count <= limit;
      return { ok, remaining: Math.max(0, limit - count), resetAt };
    } catch {
      // Fallback to local in-memory store if Redis request fails
      return defaultMemoryStore.hit(key, limit, windowMs);
    }
  }

  async clear(key: string): Promise<void> {
    try {
      await fetch(`${this.url}/del/ratelimit:${key}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}` },
      });
    } catch {}
  }
}

const defaultMemoryStore = new MemoryStore();
let currentStore: RateLimitStore = defaultMemoryStore;

export function setRateLimitStore(store: RateLimitStore | null): void {
  currentStore = store || defaultMemoryStore;
}

export function getRateLimitStore(): RateLimitStore {
  return currentStore;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const result = currentStore.hit(key, limit, windowMs);
  if (result instanceof Promise) {
    // If the configured store is async (e.g. Upstash), fall back to memory store for sync rateLimit callers
    return defaultMemoryStore.hit(key, limit, windowMs);
  }
  return result;
}

export async function rateLimitAsync(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  return currentStore.hit(key, limit, windowMs);
}

export async function clearRateLimit(key: string): Promise<void> {
  if (currentStore.clear) {
    await currentStore.clear(key);
  }
  defaultMemoryStore.clear(key);
}
