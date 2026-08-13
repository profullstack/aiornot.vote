import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const verifyApiKey = vi.fn();
const rateLimit = vi.fn();

vi.mock("./entitlements", () => ({ verifyApiKey: (...args: unknown[]) => verifyApiKey(...args) }));
vi.mock("./rate-limit", () => ({ rateLimit: (...args: unknown[]) => rateLimit(...args) }));

import { POST } from "../app/api/v1/provenance/route";

/** Builds a request the way a caller would. */
function request(body: unknown, key = "aion_live_test"): Request {
  return new Request("https://aiornot.vote/api/v1/provenance", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** A response whose body streams the given bytes, like a real image fetch. */
function fileResponse(bytes: Uint8Array, contentType = "image/png"): Response {
  // Copy into a plain ArrayBuffer: TS types BodyInit against ArrayBuffer, not
  // the ArrayBufferLike a Uint8Array is generic over.
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Response(buffer, { status: 206, headers: { "content-type": contentType } });
}

function pngWithC2pa(): Uint8Array {
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const label = "caBX";
  const out = new Uint8Array(magic.length + label.length);
  out.set(magic, 0);
  for (let i = 0; i < label.length; i += 1) out[magic.length + i] = label.charCodeAt(i);
  return out;
}

beforeEach(() => {
  vi.restoreAllMocks();
  verifyApiKey.mockResolvedValue({ keyId: "key_1" });
  rateLimit.mockResolvedValue({ ok: true });
});

describe("POST /api/v1/provenance", () => {
  it("rejects a missing or bad key", async () => {
    verifyApiKey.mockResolvedValue(null);

    const res = await POST(request({ media_url: "https://example.com/a.png" }));

    expect(res.status).toBe(401);
    expect((await res.json()).error).toContain("API key");
  });

  it("rejects when rate limited", async () => {
    rateLimit.mockResolvedValue({ ok: false });

    const res = await POST(request({ media_url: "https://example.com/a.png" }));

    expect(res.status).toBe(429);
  });

  it("rejects a private-network url", async () => {
    const res = await POST(request({ media_url: "http://127.0.0.1/secret.png" }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("media_url");
  });

  it("rejects a non-http scheme", async () => {
    const res = await POST(request({ media_url: "file:///etc/passwd" }));
    expect(res.status).toBe(400);
  });

  it("reads a C2PA manifest and reports it without claiming verification", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(fileResponse(pngWithC2pa())),
    );

    const res = await POST(request({ media_url: "https://example.com/signed.png" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.provenance.c2pa.present).toBe(true);
    expect(body.provenance.c2pa.signature_verified).toBe(false);
    expect(body.provenance.strength).toBe("signed");
    expect(body.content_type).toBe("image/png");
  });

  it("reports a bare file as no evidence either way", async () => {
    const plain = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fileResponse(plain, "image/jpeg")));

    const res = await POST(request({ media_url: "https://example.com/plain.jpg" }));
    const body = await res.json();

    expect(body.provenance.signals).toEqual(["none"]);
    expect(body.provenance.declared_ai_generated).toBeNull();
    expect(String(body.provenance.notes.join(" "))).toContain("not evidence either way");
  });

  it("always reports that SynthID was not checked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fileResponse(pngWithC2pa())));

    const body = await (await POST(request({ media_url: "https://example.com/a.png" }))).json();

    expect(body.provenance.synthid.checked).toBe(false);
    expect(body.provenance.synthid.reason).toContain("SynthID");
  });

  it("sends a Range header so a large file is not pulled whole", async () => {
    const spy = vi.fn().mockResolvedValue(fileResponse(pngWithC2pa()));
    vi.stubGlobal("fetch", spy);

    await POST(request({ media_url: "https://example.com/big.png" }));

    const init = spy.mock.calls[0]?.[1] as RequestInit & { headers: Record<string, string> };
    expect(init.headers.Range).toMatch(/^bytes=0-\d+$/);
  });

  it("caps how much it reads when the server ignores Range", async () => {
    // 3MB, past the 2MB scan cap.
    const oversized = new Uint8Array(3 * 1024 * 1024);
    oversized.set([0x89, 0x50, 0x4e, 0x47], 0);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fileResponse(oversized)));

    const body = await (await POST(request({ media_url: "https://example.com/huge.png" }))).json();

    expect(body.bytes_inspected).toBeLessThanOrEqual(2 * 1024 * 1024);
  });

  it("surfaces an upstream failure as a 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));

    const res = await POST(request({ media_url: "https://example.com/missing.png" }));

    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("Could not read the file");
  });

  it("rejects an empty file", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fileResponse(new Uint8Array(0))));

    const res = await POST(request({ media_url: "https://example.com/empty.png" }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("empty");
  });

  it("accepts image_url as an alias for media_url", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fileResponse(pngWithC2pa())));

    const res = await POST(request({ image_url: "https://example.com/a.png" }));

    expect(res.status).toBe(200);
  });

  it("says plainly that it is not a detector", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fileResponse(pngWithC2pa())));

    const body = await (await POST(request({ media_url: "https://example.com/a.png" }))).json();

    expect(body.note).toContain("not an AI detector");
  });
});
