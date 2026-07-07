import { MediaCard, type ClientCard } from "./MediaCard";

export function MediaGrid({
  cards,
  canGuess,
  isLoggedIn,
}: {
  cards: ClientCard[];
  canGuess: boolean;
  isLoggedIn: boolean;
}) {
  if (cards.length === 0) {
    return <div className="empty">No media here yet. Check back soon, or subscribe by RSS.</div>;
  }
  return (
    <div className="grid">
      {cards.map((card) => (
        <MediaCard key={card.id} card={card} canGuess={canGuess} isLoggedIn={isLoggedIn} />
      ))}
    </div>
  );
}
