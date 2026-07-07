import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "./env";

/** Opaque random token (used for session + verification tokens). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** HMAC-SHA256 hex digest keyed by a salt. Used to store hashed tokens/IPs. */
export function hmac(value: string, salt: string): string {
  return createHmac("sha256", salt).update(value).digest("hex");
}

export function hashSessionToken(token: string): string {
  return hmac(token, env.sessionSecret);
}

export function hashIp(ip: string): string {
  return hmac(ip, env.rateLimitSalt).slice(0, 32);
}

export function hashUserAgent(ua: string): string {
  return hmac(ua, env.rateLimitSalt).slice(0, 32);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
