import "server-only";
import { getCurrentUser } from "./session";
import { verifyApiKey } from "./entitlements";
import { sqlClient } from "./db";

export type RequestUser = { id: string; email: string; emailVerified: boolean; isAdmin: boolean; via: "session" | "api_key" };

/**
 * The signed-in person (session cookie), or the owner of a Bearer API key
 * (`Authorization: Bearer aion_...`) for scripts and agents. Suspended and
 * deleted accounts are nobody.
 */
export async function requestUser(req: Request): Promise<RequestUser | null> {
  const key = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (key) {
    const auth = await verifyApiKey(key);
    if (!auth) return null;
    const r = await sqlClient.execute({
      sql: "SELECT id, email, status, email_verified_at FROM users WHERE id = ? LIMIT 1",
      args: [auth.userId],
    });
    const row = r.rows[0];
    if (!row || row.status === "suspended" || row.status === "deleted") return null;
    return { id: row.id as string, email: row.email as string, emailVerified: row.email_verified_at != null, isAdmin: false, via: "api_key" };
  }
  const user = await getCurrentUser();
  return user ? { id: user.id, email: user.email, emailVerified: user.emailVerified, isAdmin: user.isAdmin, via: "session" } : null;
}

/** https://<host> of this request (behind the proxy), never localhost from config. */
export function requestOrigin(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
