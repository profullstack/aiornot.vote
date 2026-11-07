import { getClient, newId } from "@aiornot/db";
import type { Client } from "@libsql/client";
import { generateObject } from "@profullstack/ai-providers";

const SYSTEM = [
  "You write short, punchy, concrete tips for a game where players guess whether a",
  "photorealistic image is AI-generated or a real photo. Each tip teaches one specific",
  "tell (hands, teeth, eyes, ears, hair, jewelry, text/signage, reflections, symmetry,",
  "repeated patterns, over-smooth skin, warped edges, impossible physics, lighting/",
  "shadows, vehicle geometry like bikes/scooters, tiling artifacts, using the zoom",
  "magnifier). Each tip < 140 chars, starts with a verb, no numbering, no quotes.",
].join(" ");

/** The model's answer, as tip strings. Accepts {"tips": [...]} or a bare array. */
export function parseTips(v: unknown): string[] {
  const list = Array.isArray(v) ? v : (v as { tips?: unknown } | null)?.tips;
  if (!Array.isArray(list) || list.length === 0) throw new Error("no tips in the answer");
  return list.map((t) => String(t));
}

/**
 * Generate a batch of fresh game tips and insert them (dedup by unique text).
 * Meant to be run occasionally to top up the tip pool — never in the hot
 * request path. c0mpute first (@profullstack/ai-providers), OpenAI/Anthropic
 * as paid fallbacks when their keys are set.
 */
export async function generateTips(opts: { count?: number; client?: Client } = {}): Promise<{ added: number }> {
  const client = opts.client ?? getClient();
  const count = Math.min(40, Math.max(1, opts.count ?? 20));

  const existing = await client.execute("SELECT text FROM tips LIMIT 200");
  const have = existing.rows.map((r) => r.text as string);

  const { object: tips } = await generateObject({
    feature: "aiornot.tips",
    name: "Tips",
    system: SYSTEM,
    user: `Give ${count} NEW distinct tips as {"tips": [string, ...]}. Do not repeat any of these existing tips:\n${have.join("\n")}`,
    temperature: 0.9,
    maxTokens: 2000,
    timeoutMs: 240_000,
    ...(process.env.AI_TEXT_MODEL ? { models: { openai: process.env.AI_TEXT_MODEL } } : {}),
    jsonSchema: {
      type: "object",
      properties: { tips: { type: "array", items: { type: "string" } } },
      required: ["tips"],
    },
    schema: parseTips,
  });

  let added = 0;
  for (const raw of tips) {
    const text = String(raw).trim().replace(/^["']|["']$/g, "").replace(/\.$/, "");
    if (!text || text.length > 180) continue;
    const r = await client.execute({
      sql: "INSERT OR IGNORE INTO tips (id, text) VALUES (?, ?)",
      args: [newId("tip"), text],
    });
    added += r.rowsAffected;
  }
  return { added };
}
