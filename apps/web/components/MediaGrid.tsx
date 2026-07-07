import type { MediaCard as MediaCardData } from "@/lib/queries";
import { toClientCard } from "@/lib/serialize";
import { MediaCard } from "./MediaCard";

export function MediaGrid({
  items,
  canGuess,
  isLoggedIn,
}: {
  items: MediaCardData[];
  canGuess: boolean;
  isLoggedIn: boolean;
}) {
  if (items.length === 0) {
    return <div className="empty">No media here yet. Check back soon, or subscribe by RSS.</div>;
  }
  return (
    <div className="grid">
      {items.map((m) => (
        <MediaCard key={m.id} card={toClientCard(m)} canGuess={canGuess} isLoggedIn={isLoggedIn} />
      ))}
    </div>
  );
}
