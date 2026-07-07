export * as schema from "./schema";
export * from "./schema";
export { getDb, getClient } from "./client";
export { ids, newId } from "./ids";

// Canonical default tag set (seeded by seed-tags.ts).
export const DEFAULT_TAGS: Array<{
  slug: string;
  name: string;
  isAnswerSpoiler?: boolean;
}> = [
  { slug: "ai-generated", name: "AI Generated", isAnswerSpoiler: true },
  { slug: "human-made", name: "Human Made", isAnswerSpoiler: true },
  { slug: "uncertain", name: "Uncertain" },
  { slug: "photorealistic", name: "Photorealistic" },
  { slug: "portrait", name: "Portrait" },
  { slug: "animal", name: "Animal" },
  { slug: "landscape", name: "Landscape" },
  { slug: "architecture", name: "Architecture" },
  { slug: "food", name: "Food" },
  { slug: "fashion", name: "Fashion" },
  { slug: "sports", name: "Sports" },
  { slug: "travel", name: "Travel" },
  { slug: "product", name: "Product" },
  { slug: "newsworthy", name: "Newsworthy" },
  { slug: "weird", name: "Weird" },
  { slug: "uncanny", name: "Uncanny" },
  { slug: "clean", name: "Clean" },
  { slug: "cinematic", name: "Cinematic" },
  { slug: "close-up", name: "Close-up" },
  { slug: "street-photo", name: "Street Photo" },
  { slug: "video", name: "Video" },
  { slug: "image", name: "Image" },
];
