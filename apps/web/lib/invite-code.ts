/**
 * Invite-code helpers safe for any runtime (client components, the signup
 * route, the middleware): no database, no server-only imports.
 */

/** Cookie /i/<code> sets so the code survives the trip through signup. */
export const INVITE_COOKIE = "aon_invite";

/** Shape check only (INV-XXXX-XXXX-XXXX, forgiving of case, spaces and dashes). */
export const looksLikeInvite = (s: unknown): s is string => /^[A-Za-z0-9 -]{12,24}$/.test(String(s ?? ""));

/** Credit codes look like CR-XXXX-XXXX-XXXX-XXXX; invite paths start INV-. */
export const isInvitePath = (pathname: string): boolean => /^\/i\/inv-/i.test(pathname);
