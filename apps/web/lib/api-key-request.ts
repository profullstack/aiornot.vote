export type ApiKeyRequest =
  | { ok: true; label: string }
  | { ok: false };

export async function readApiKeyRequest(req: Request): Promise<ApiKeyRequest> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false };
  }

  const label = (body as Record<string, unknown>).label;
  return { ok: true, label: String(label || "API key") };
}
