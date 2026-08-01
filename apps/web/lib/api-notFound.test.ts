import { describe, expect, it } from "vitest";
import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from "../app/api/route";

describe("/api root route handler (JSON 404)", () => {
  it("returns JSON 404 response for GET", async () => {
    const res = await GET();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "Not found. See /api-docs for API documentation." });
  });

  it("returns JSON 404 response for POST, PUT, PATCH, DELETE, OPTIONS, HEAD", async () => {
    for (const handler of [POST, PUT, PATCH, DELETE, OPTIONS, HEAD]) {
      const res = await handler();
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: "Not found. See /api-docs for API documentation." });
    }
  });
});
