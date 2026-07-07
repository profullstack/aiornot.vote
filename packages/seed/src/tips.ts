import { getClient, newId } from "@aiornot/db";
import type { Client } from "@libsql/client";

const SYSTEM = [
  "You write short, punchy, concrete tips for a game where players guess whether a",
  "photorealistic image is AI-generated or a real photo. Each tip teaches one specific",
  "tell (hands, teeth, eyes, ears, hair, jewelry, text/signage, reflections, symmetry,",
  "repeated patterns, over-smooth skin, warped edges, impossible physics, lighting/",
  "shadows, vehicle geometry like bikes/scooters, tiling artifacts, using the zoom",
  "magnifier). Each tip < 140 chars, starts with a verb, no numbering, no quotes.",
].join(" ");

/**
 * Generate a batch of fresh game tips with OpenAI and insert them (dedup by
 * unique text). Meant to be run occasionally to top up the tip pool — never in
 * the hot request path. Requires OPENAI_API_KEY.
 */
export async function generateTips(opts: { count?: number; client?: Client } = {}): Promise<{ added: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
  const client = opts.client ?? getClient();
  const count = Math.min(40, Math.max(1, opts.count ?? 20));

  const existing = await client.execute("SELECT text FROM tips LIMIT 200");
  const have = existing.rows.map((r) => r.text as string);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.AI_TEXT_MODEL || "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Give ${count} NEW distinct tips as a JSON array of strings. Do not repeat any of these existing tips:\n${have.join("\n")}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI tips failed (${res.status}): ${(await res.text()).slice(0, 150)}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  let content = data.choices[0]?.message?.content?.trim() ?? "[]";
  const m = content.match(/\[[\s\S]*\]/);
  content = m ? m[0] : content;
  let tips: string[] = [];
  try {
    tips = JSON.parse(content);
  } catch {
    tips = [];
  }

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
