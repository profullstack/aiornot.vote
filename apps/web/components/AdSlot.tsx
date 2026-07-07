/**
 * A CrawlProof ad unit. The div is filled by the global ad.js loader (a
 * sandboxed iframe). We reserve the unit's dimensions to avoid layout shift and
 * label it clearly. When no campaign is available, CrawlProof serves a default
 * house ad, so the slot is never empty.
 */
const SIZES: Record<string, { w: number; h: number }> = {
  banner_300x250: { w: 300, h: 250 },
  banner_728x90: { w: 728, h: 90 },
  banner_320x50: { w: 320, h: 50 },
  banner_160x600: { w: 160, h: 600 },
};

export function AdSlot({
  slot,
  format = "banner_300x250",
  className,
}: {
  slot: string;
  format?: string;
  className?: string;
}) {
  const size = SIZES[format] ?? SIZES.banner_300x250!;
  return (
    <div className={`ad-slot ${className ?? ""}`}>
      <div className="ad-label">Advertisement</div>
      <div
        data-cp-ad=""
        data-slot={slot}
        data-format={format}
        style={{ width: size.w, height: size.h, maxWidth: "100%" }}
      />
    </div>
  );
}
