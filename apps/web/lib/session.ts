import "server-only";
import { cookies, headers } from "next/headers";
import { sqlClient } from "./db";
import { ids } from "@aiornot/db";
import { randomToken, hashSessionToken, hashIp, hashUserAgent } from "./crypto";
import { isAdminEmail } from "./env";

const COOKIE = "aon_session";
const SESSION_TTL_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  role: string;
  emailVerified: boolean;
  isAdmin: boolean;
  isMember: boolean;
  /** May play (vote/guess): bought the $1 play pass OR is a lifetime member. */
  canPlay: boolean;
};

function isoInDays(days: number): string {
  return new Date(Date.now() + days * 86400_000).toISOString();
}

export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const tokenHash = hashSessionToken(token);
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "";
  const ua = hdrs.get("user-agent") || "";

  await sqlClient.execute({
    sql: `INSERT INTO sessions (id, user_id, session_token_hash, ip_hash, user_agent_hash, expires_at, last_seen_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    args: [
      ids.session(),
      userId,
      tokenHash,
      ip ? hashIp(ip) : null,
      ua ? hashUserAgent(ua) : null,
      isoInDays(SESSION_TTL_DAYS),
    ],
  });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86400,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await sqlClient.execute({
      sql: "DELETE FROM sessions WHERE session_token_hash = ?",
      args: [hashSessionToken(token)],
    });
  }
  jar.delete(COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const res = await sqlClient.execute({
    sql: `SELECT u.id, u.email, u.display_name, u.status, u.role, u.email_verified_at, u.is_lifetime_member, u.play_pass_at
          FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.session_token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP
          LIMIT 1`,
    args: [hashSessionToken(token)],
  });
  const row = res.rows[0];
  if (!row) return null;
  if (row.status === "deleted" || row.status === "suspended") return null;

  const email = row.email as string;
  return {
    id: row.id as string,
    email,
    displayName: (row.display_name as string) ?? null,
    status: row.status as string,
    role: row.role as string,
    emailVerified: row.email_verified_at != null,
    isAdmin: row.role === "admin" || isAdminEmail(email),
    isMember: Number(row.is_lifetime_member ?? 0) === 1,
    canPlay: Number(row.is_lifetime_member ?? 0) === 1 || row.play_pass_at != null,
  };
}

/** Throws-free helper for gating actions that need a verified account. */
export function canParticipate(user: SessionUser | null): user is SessionUser {
  return !!user && user.emailVerified && user.status === "active";
}

/** Gating for actions that require a paid play pass (or membership). */
export function canPlay(user: SessionUser | null): user is SessionUser {
  return canParticipate(user) && user.canPlay;
}
