import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ sqlClient: { execute: vi.fn() } }));
vi.mock("./email", () => ({ sendEmail: vi.fn() }));

const ai = vi.hoisted(() => ({ generateObject: vi.fn() }));
vi.mock("@profullstack/ai-providers", () => ai);

import { generateNewsletter, parseNewsletter } from "./newsletter";

describe("newsletter drafting", () => {
  beforeEach(() => {
    ai.generateObject.mockReset();
  });

  it("goes through the c0mpute-first router with a schema", async () => {
    ai.generateObject.mockImplementation(async (req: { schema: (v: unknown) => unknown }) => ({
      object: req.schema({ subject: "Spot the fake", html: "<p>Play</p>" }),
      provider: "c0mpute",
    }));
    const out = await generateNewsletter("  weekly roundup  ");
    expect(out).toEqual({ subject: "Spot the fake", html: "<p>Play</p>" });
    const req = ai.generateObject.mock.calls[0][0];
    expect(req.user).toBe("weekly roundup");
    expect(req.timeoutMs).toBeGreaterThanOrEqual(60_000);
  });

  it("rejects an empty prompt without calling a model", async () => {
    await expect(generateNewsletter("   ")).rejects.toThrow("Enter a prompt.");
    expect(ai.generateObject).not.toHaveBeenCalled();
  });

  it("reports a failure of every provider as a generation failure", async () => {
    ai.generateObject.mockRejectedValue(new Error("all providers failed"));
    await expect(generateNewsletter("hi")).rejects.toThrow(/Newsletter generation failed/);
  });

  it("parseNewsletter trims the subject and refuses a missing field", () => {
    expect(parseNewsletter({ subject: "x".repeat(200), html: "<p/>" }).subject).toHaveLength(120);
    expect(() => parseNewsletter({ subject: "s" })).toThrow();
    expect(() => parseNewsletter(null)).toThrow();
  });
});
