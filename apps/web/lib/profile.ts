export const DISPLAY_NAME_MAX_LENGTH = 50;

export type ProfileRequest =
  | { ok: true; displayName: string | null }
  | { ok: false; error: string };

function displayNameLength(value: string): number {
  return Array.from(value).length;
}

export function normalizeDisplayName(value: unknown): ProfileRequest {
  if (typeof value !== "string") {
    return { ok: false, error: "Display name must be a string." };
  }

  const displayName = value.trim().replace(/\s+/gu, " ");
  if (!displayName) return { ok: true, displayName: null };
  if (displayNameLength(displayName) > DISPLAY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, displayName };
}

export async function readProfileRequest(req: Request): Promise<ProfileRequest> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, error: "Invalid JSON body." };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body." };
  }
  if (!Object.prototype.hasOwnProperty.call(body, "displayName")) {
    return { ok: false, error: "displayName is required." };
  }
  return normalizeDisplayName((body as Record<string, unknown>).displayName);
}

/** Keep user input in bound SQL args, never in the statement text. */
export function displayNameUpdateStatement(userId: string, displayName: string | null) {
  return {
    sql: "UPDATE users SET display_name = ? WHERE id = ?",
    args: [displayName, userId],
  };
}
