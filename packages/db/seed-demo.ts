import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "dotenv";
import { getClient } from "./src/client";
import { ids } from "./src/ids";

config({ path: join(process.cwd(), ".env") });
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../../.env") });

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

type DemoItem = {
  title: string;
  truth: "ai" | "not_ai";
  provider: "unsplash" | "openai";
  tags: string[];
  aiPct: number; // simulated crowd share that guessed "ai"
  featured?: boolean;
};

const DEMO: DemoItem[] = [
  { title: "Golden hour portrait on a rooftop", truth: "not_ai", provider: "unsplash", tags: ["portrait", "photorealistic", "cinematic"], aiPct: 41, featured: true },
  { title: "Impossibly symmetrical android face", truth: "ai", provider: "openai", tags: ["portrait", "uncanny", "photorealistic"], aiPct: 78 },
  { title: "Foggy mountain range at dawn", truth: "not_ai", provider: "unsplash", tags: ["landscape", "travel", "clean"], aiPct: 33 },
  { title: "Neon-lit street that never existed", truth: "ai", provider: "openai", tags: ["street-photo", "cinematic", "uncanny"], aiPct: 64, featured: true },
  { title: "Plated tasting-menu dessert", truth: "not_ai", provider: "unsplash", tags: ["food", "product", "close-up"], aiPct: 52 },
  { title: "Too-perfect burger with impossible steam", truth: "ai", provider: "openai", tags: ["food", "product", "weird"], aiPct: 71 },
  { title: "Runner crossing the finish line", truth: "not_ai", provider: "unsplash", tags: ["sports", "photorealistic"], aiPct: 28 },
  { title: "Fashion editorial with melting fabric", truth: "ai", provider: "openai", tags: ["fashion", "uncanny", "cinematic"], aiPct: 83 },
  { title: "Brutalist building against blue sky", truth: "not_ai", provider: "unsplash", tags: ["architecture", "clean", "travel"], aiPct: 37 },
  { title: "Snow leopard staring down the lens", truth: "not_ai", provider: "unsplash", tags: ["animal", "close-up", "photorealistic"], aiPct: 45 },
  { title: "Six-legged deer in a misty forest", truth: "ai", provider: "openai", tags: ["animal", "weird", "uncanny"], aiPct: 88 },
  { title: "Vintage car on a coastal road", truth: "not_ai", provider: "unsplash", tags: ["travel", "product", "cinematic"], aiPct: 40 },
];

// Generate a larger, balanced demo pool so there's plenty to vote on. Each
// category contributes a mix of real (not_ai) and AI (ai) items with varied
// crowd splits, including some deliberately hard ~50/50 items.
const CATEGORY_POOL: Array<{ cat: string; tags: string[] }> = [
  { cat: "portrait", tags: ["portrait", "photorealistic"] },
  { cat: "landscape", tags: ["landscape", "travel"] },
  { cat: "street", tags: ["street-photo", "cinematic"] },
  { cat: "food", tags: ["food", "product"] },
  { cat: "fashion", tags: ["fashion", "cinematic"] },
  { cat: "animal", tags: ["animal", "close-up"] },
  { cat: "architecture", tags: ["architecture", "clean"] },
  { cat: "sports", tags: ["sports", "photorealistic"] },
  { cat: "travel", tags: ["travel", "cinematic"] },
  { cat: "product", tags: ["product", "clean"] },
  { cat: "newsworthy", tags: ["newsworthy", "photorealistic"] },
  { cat: "close-up", tags: ["close-up", "uncanny"] },
];
const REAL_ADJ = ["candid", "documentary", "natural-light", "handheld", "editorial", "everyday"];
const AI_ADJ = ["hyperreal", "too-perfect", "uncanny", "impossible-detail", "flawless", "dreamlike"];
for (let i = 0; i < CATEGORY_POOL.length; i++) {
  const { cat, tags } = CATEGORY_POOL[i]!;
  for (let j = 0; j < 5; j++) {
    const isAi = j % 2 === 1;
    const adj = (isAi ? AI_ADJ : REAL_ADJ)[(i + j) % 6]!;
    // Vary difficulty: some near 50/50 (hard), some obvious.
    const base = isAi ? 55 : 40;
    const aiPct = Math.max(8, Math.min(92, base + ((i * 7 + j * 13) % 40) - 15));
    DEMO.push({
      title: `${adj} ${cat} shot #${j + 1}`,
      truth: isAi ? "ai" : "not_ai",
      provider: isAi ? "openai" : "unsplash",
      tags,
      aiPct,
    });
  }
}

async function main() {
  const client = getClient();

  // NOTE: we intentionally do NOT create an admin user row here. Admin access is
  // granted at signup to any address listed in ADMIN_EMAILS — just register with
  // that email (and verify) to become an admin. Seeding a pre-verified,
  // passwordless admin would both block registration ("already exists") and let
  // anyone claim admin without proving inbox control.
  const adminEmail = (process.env.ADMIN_EMAILS || "anthony@profullstack.com")
    .split(",")[0]
    .trim();
  console.log(`Admin bootstrap: sign up at /signup with ${adminEmail} and verify to get admin.`);

  // Map of tag slug -> id
  const tagRows = await client.execute("SELECT id, slug FROM tags");
  const tagBySlug = new Map<string, string>();
  for (const r of tagRows.rows) tagBySlug.set(r.slug as string, r.id as string);

  let created = 0;
  for (let i = 0; i < DEMO.length; i++) {
    const item = DEMO[i]!;
    // Neutral title/slug — must not reveal AI vs real (both use the same style).
    const primaryTag = (item.tags[0] || "image").replace(/-/g, " ");
    const neutralTitle = `AI or Not: ${primaryTag.charAt(0).toUpperCase()}${primaryTag.slice(1)}`;
    const slug = `${slugify(neutralTitle)}-${i + 1}`;
    const exists = await client.execute({
      sql: "SELECT id FROM media WHERE slug = ?",
      args: [slug],
    });
    if (exists.rows.length > 0) continue;

    const mediaId = ids.media();
    // Deterministic placeholder image so the demo renders with no external keys.
    const seed = encodeURIComponent(slug);
    const mediaUrl = `https://picsum.photos/seed/${seed}/1000/1250`;
    const thumbUrl = `https://picsum.photos/seed/${seed}/500/625`;

    await client.execute({
      sql: `INSERT INTO media
        (id, slug, media_type, title, description, media_url, thumbnail_url,
         source_provider, seed_source, truth_label, truth_confidence, reveal_status,
         status, is_featured, is_score_eligible, width, height,
         ai_prompt_summary, ai_model, approved_at)
        VALUES (?, ?, 'image', ?, ?, ?, ?, ?, ?, ?, 'seeded', 'hidden_until_guess',
                'approved', ?, 1, 1000, 1250, ?, ?, CURRENT_TIMESTAMP)`,
      args: [
        mediaId,
        slug,
        neutralTitle,
        "Real photo or AI generation? Cast your vote.",
        mediaUrl,
        thumbUrl,
        item.provider,
        item.provider,
        item.truth,
        item.featured ? 1 : 0,
        item.provider === "openai" ? `photorealistic variant: ${item.title}` : null,
        item.provider === "openai" ? process.env.AI_IMAGE_MODEL || "gpt-image-1" : null,
      ],
    });

    // Tags (+ derived system tag for truth, hidden as spoiler)
    const tagSlugs = new Set(item.tags);
    tagSlugs.add(item.truth === "ai" ? "ai-generated" : "human-made");
    tagSlugs.add("image");
    for (const ts of tagSlugs) {
      const tagId = tagBySlug.get(ts);
      if (!tagId) continue;
      await client.execute({
        sql: "INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)",
        args: [mediaId, tagId],
      });
    }

    // Simulated crowd stats
    const total = 40 + ((i * 7) % 60);
    const aiG = Math.round((item.aiPct / 100) * total);
    const notAiG = total - aiG;
    const correct = item.truth === "ai" ? aiG : notAiG;
    const incorrect = total - correct;
    const crowdAcc = total > 0 ? correct / total : 0;
    const difficulty = 1 - Math.abs(item.aiPct - 50) / 50; // near 50/50 => hardest
    const trending = total * (0.5 + difficulty) + (item.featured ? 20 : 0);
    await client.execute({
      sql: `INSERT INTO media_stats
        (media_id, ai_guesses, not_ai_guesses, total_guesses, correct_guesses,
         incorrect_guesses, crowd_accuracy, difficulty_score, trending_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [mediaId, aiG, notAiG, total, correct, incorrect, crowdAcc, difficulty, trending],
    });
    created++;
  }

  console.log(`Seeded ${created} demo media item(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Demo seed failed:", err);
  process.exit(1);
});
