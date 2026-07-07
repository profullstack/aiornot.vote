import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentUser, type SessionUser } from "./session";
import { sqlClient } from "./db";
import { ids } from "@aiornot/db";

/** For admin pages: redirect non-admins (or unverified admins) to login. */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin || !user.emailVerified) redirect("/login");
  return user;
}

/** For admin API routes: returns the user or a 403 response. */
export async function requireAdminApi(): Promise<
  { user: SessionUser } | { error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin || !user.emailVerified) {
    return { error: NextResponse.json({ ok: false, error: "Admin only." }, { status: 403 }) };
  }
  return { user };
}

export async function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: unknown,
): Promise<void> {
  await sqlClient.execute({
    sql: `INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, metadata_json)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [ids.audit(), actorId, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null],
  });
}
