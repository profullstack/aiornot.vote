import { describe, expect, it } from "vitest";
import { readSubmissionForm } from "./submission-form";

describe("readSubmissionForm", () => {
  it("rejects requests with an unsupported content type", async () => {
    const request = new Request("https://aiornot.vote/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    await expect(readSubmissionForm(request)).resolves.toEqual({ ok: false });
  });

  it("rejects malformed multipart bodies", async () => {
    const request = new Request("https://aiornot.vote/api/submit", {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=missing" },
      body: "not-a-valid-multipart-body",
    });

    await expect(readSubmissionForm(request)).resolves.toEqual({ ok: false });
  });

  it("returns valid form data", async () => {
    const body = new FormData();
    body.set("title", "Example submission");
    const request = new Request("https://aiornot.vote/api/submit", {
      method: "POST",
      body,
    });

    const result = await readSubmissionForm(request);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.form.get("title")).toBe("Example submission");
  });
});
