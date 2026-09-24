import { createECDH, randomBytes } from "node:crypto";
import { generateVapidKeys } from "@profullstack/notifications/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("./db", () => ({ sqlClient: { execute: mocks.execute } }));

const vapid = generateVapidKeys();

/** A subscription row with real browser-shaped keys, so encryption runs for real. */
function row(id: string) {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    id,
    endpoint: `https://push.example.com/${id}`,
    p256dh: ecdh.getPublicKey().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  };
}

// Imported once: the sender reads the keys on first use and keeps them only
// once found, so the "not configured" case must run before the configured one.
import { broadcastPush, sendPushToUser } from "./push";

beforeEach(() => {
  mocks.execute.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("push delivery", () => {
  it("does nothing when the VAPID keys are not configured", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await sendPushToUser("user-1", { title: "t", body: "b" })).toEqual({ sent: 0, failed: 0, pruned: 0 });
    expect(await broadcastPush({ title: "t", body: "b" })).toEqual({ sent: 0, failed: 0, pruned: 0 });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends signed, encrypted pushes and prunes subscriptions the push service says are gone", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", vapid.publicKey);
    vi.stubEnv("VAPID_PRIVATE_KEY", vapid.privateKey);
    const rows = [row("ok"), row("gone"), row("expired"), row("error")];
    const status: Record<string, number> = { ok: 201, gone: 410, expired: 404, error: 500 };
    const fetchMock = vi.fn(async (url: string) => new Response(null, { status: status[url.split("/").pop()!] }));
    vi.stubGlobal("fetch", fetchMock);
    mocks.execute.mockImplementation(async (q: { sql: string }) =>
      q.sql.startsWith("SELECT") ? { rows } : { rows: [] },
    );

    const res = await sendPushToUser("user-1", { title: "Hi", body: "There", url: "/play" });

    expect(res).toEqual({ sent: 1, failed: 3, pruned: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://push.example.com/ok");
    expect(init.method).toBe("POST");
    expect(init.headers["content-encoding"]).toBe("aes128gcm");
    expect(init.headers.ttl).toBe(String(4 * 7 * 24 * 3600));
    expect(init.headers.authorization).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${vapid.publicKey}$`));
    const claims = JSON.parse(
      Buffer.from(init.headers.authorization.split(" ")[1].slice(2).split(".")[1], "base64url").toString(),
    );
    expect(claims).toMatchObject({ aud: "https://push.example.com", sub: "mailto:hello@aiornot.vote" });

    const deletes = mocks.execute.mock.calls
      .map(([q]) => q as { sql: string; args: unknown[] })
      .filter((q) => q.sql.startsWith("DELETE"));
    expect(deletes.map((q) => q.args)).toEqual([["https://push.example.com/gone"], ["https://push.example.com/expired"]]);
  });
});

describe("GET /api/push/vapid-public-key", () => {
  it("serves the public key read at run time", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", vapid.publicKey);
    vi.stubEnv("VAPID_PRIVATE_KEY", vapid.privateKey);
    vi.resetModules();
    const { GET, dynamic } = await import("../app/api/push/vapid-public-key/route");

    const res = GET();
    expect(dynamic).toBe("force-dynamic");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ publicKey: vapid.publicKey });
  });

  it("answers 503 when push is not configured", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.resetModules();
    const { GET } = await import("../app/api/push/vapid-public-key/route");

    const res = GET();
    expect(res.status).toBe(503);
    expect((await res.json()).publicKey).toBeNull();
  });
});
