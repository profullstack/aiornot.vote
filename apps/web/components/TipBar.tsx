export function TipBar({ tip }: { tip: string | null }) {
  if (!tip) return null;
  return (
    <div className="tip-bar">
      <div className="container">
        <span className="tip-emoji">💡</span>
        <span className="tip-label">Tip</span>
        <span className="tip-text">{tip}</span>
      </div>
    </div>
  );
}
