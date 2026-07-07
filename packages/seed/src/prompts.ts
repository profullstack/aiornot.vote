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

/** Category-aware, reveal-safe prompt for an AI variant inspired by (not copying) a real photo. */
export function buildVariantPrompt(category: string, caption: string, seed = Date.now()): string {
  return [
    `Create a photorealistic editorial-style image inspired by this scene, but do not copy it exactly.`,
    `Scene: ${caption}.`,
    `Keep the general category: ${category}.`,
    `Change at least three major creative details: ${pick(LIGHTING, seed)}, ${pick(BACKGROUND, seed + 1)}, ${pick(ANGLE, seed + 2)}, ${pick(STYLING, seed + 3)}.`,
    `Make it look like a real camera photo, not illustration, not CGI, not fantasy art.`,
    `No text, no watermark, no logos.`,
  ].join(" ");
}

/** Short summary stored on the media row (reveal metadata). */
export function promptSummary(category: string): string {
  return `Photorealistic ${category.replace(/ photography$/, "")} variant, creatively altered from a real reference.`;
}
