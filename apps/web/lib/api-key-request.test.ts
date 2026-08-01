import { describe, expect, it } from "vitest";
import { readApiKeyRequest } from "./api-key-request";

function request(body: string): Request {
  return new Request("https://aiornot.vote/api/account/api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("readApiKeyRequest", () => {
  it("rejects malformed JSON instead of creating a default key", async () => {
    await expect(readApiKeyRequest(request('{"label":'))).resolves.toEqual({ ok: false });
  });

  it("rejects JSON values that are not objects", async () => {
    await expect(readApiKeyRequest(request("null"))).resolves.toEqual({ ok: false });
    await expect(readApiKeyRequest(request("[]"))).resolves.toEqual({ ok: false });
  });

  it("uses the default label only for a valid JSON object", async () => {
    await expect(readApiKeyRequest(request("{}"))).resolves.toEqual({
      ok: true,
      label: "API key",
    });
  });
});
