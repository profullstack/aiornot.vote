import "server-only";
import { cookies } from "next/headers";
import { hmac, safeEqual } from "./crypto";
import { env } from "./env";

/**
 * Anonymous play. Visitors may keep guessing WITHOUT an account, but every
 * ANON_NAG_EVERY rounds they get a dismissible "join free" nag (soft gate, not
 * a hard cap). We never persist anon guesses (no DB write, no crowd-stat
 * impact, never on the leaderboard) — we only keep a signed count of rounds
 * played in a cookie so we know when to nag.
 */
const COOKIE = "aon_anon";
export const ANON_NAG_EVERY = 5;

function sign(n: number): string {
  return `${n}.${hmac(`anon:${n}`, env.sessionSecret)}`;
}

function parse(raw: string | undefined): number {
  if (!raw) return 0;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return 0;
  const nStr = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const n = Number(nStr);
  if (!Number.isInteger(n) || n < 0) return 0;
  if (!safeEqual(sig, hmac(`anon:${n}`, env.sessionSecret))) return 0;
  return n;
}

/** Increment the anon round counter and persist it. Returns the new count. */
export async function bumpAnonRounds(): Promise<number> {
  const jar = await cookies();
  const next = parse(jar.get(COOKIE)?.value) + 1;
  jar.set(COOKIE, sign(next), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 86400,
  });
  return next;
}
