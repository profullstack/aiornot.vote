import type { MediaCard as MediaCardData } from "./queries";
import type { ClientCard } from "@/components/MediaCard";

/** Trim a server MediaCard into the serializable shape the client component needs. */
export function toClientCard(m: MediaCardData): ClientCard {
  const userGuess = m.userGuess ?? null;

  return {
    id: m.id,
    slug: m.slug,
    title: m.title,
    mediaType: m.mediaType,
    mediaUrl: m.mediaUrl,
    thumbnailUrl: m.thumbnailUrl,
    posterUrl: m.posterUrl,
    isFeatured: m.isFeatured,
    truthLabel: userGuess ? m.truthLabel : "unknown",
    tags: m.tags.map((t) => ({ slug: t.slug, name: t.name, isAnswerSpoiler: t.isAnswerSpoiler })),
    userGuess,
    userGuessCorrect: m.userGuessCorrect ?? null,
    stats: {
      aiGuesses: m.stats.aiGuesses,
      notAiGuesses: m.stats.notAiGuesses,
      totalGuesses: m.stats.totalGuesses,
      aiPct: m.stats.aiPct,
    },
  };
}
