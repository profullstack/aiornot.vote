export const SEED_CATEGORIES = [
  "portrait photography",
  "street photography",
  "landscape photography",
  "food photography",
  "product photography",
  "fashion photography",
  "sports photography",
  "architecture photography",
  "wildlife photography",
  "travel photography",
  "night photography",
  "macro photography",
  "event photography",
  "office photography",
  "car photography",
] as const;

const LIGHTING = ["golden-hour side light", "overcast soft light", "hard midday sun", "blue-hour ambient light", "warm tungsten interior light"];
const BACKGROUND = ["a different city skyline", "a quiet rural setting", "a minimalist studio backdrop", "a busy market street", "a coastal cliffside"];
const ANGLE = ["a low three-quarter angle", "an eye-level frontal angle", "a high overhead angle", "a tight close crop", "a wide environmental framing"];
const STYLING = ["different wardrobe and colors", "a seasonal change to winter", "rearranged props", "a different time of day", "an alternate subject pose"];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]!;
}

/**
 * Category-aware, reveal-safe prompt for an AI variant inspired by (not copying)
 * a real photo. Pass the intended `tags` and a short `description` so the model
 * depicts exactly the subject the item will be tagged with (avoids the image and
 * its tags disagreeing).
 */
export function buildVariantPrompt(
  category: string,
  caption: string,
  seed = Date.now(),
  opts: { tags?: string[]; description?: string } = {},
): string {
  const subject = (opts.tags ?? []).filter((t) => !["photorealistic", "ai-generated", "human-made", "image", "video"].includes(t));
  return [
    `Create a photorealistic editorial-style photograph in the "${category}" category.`,
    subject.length ? `The image MUST clearly and unambiguously depict: ${subject.join(", ")}.` : "",
    opts.description ? `Scene description: ${opts.description}.` : caption ? `Loose inspiration (do not copy): ${caption}.` : "",
    `Vary the execution with realistic detail: ${pick(LIGHTING, seed)}, ${pick(BACKGROUND, seed + 1)}, ${pick(ANGLE, seed + 2)}, ${pick(STYLING, seed + 3)}.`,
    `It must look like a real camera photo — not illustration, not CGI, not fantasy art. Keep the subject matter accurate to the category and tags above.`,
    `No text, no watermark, no logos.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Short summary stored on the media row (reveal metadata). */
export function promptSummary(category: string): string {
  return `Photorealistic ${category.replace(/ photography$/, "")} variant, creatively altered from a real reference.`;
}
