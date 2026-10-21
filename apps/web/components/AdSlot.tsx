"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * The site's one CrawlProof ad unit: a low-profile text_link line (40px, fluid,
 * with its own "Sponsored" mark), filled by the global ad.js loader. It renders
 * on every page except the homepage, which carries no ad.
 */
export function AdSlot({ slot, className }: { slot: string; className?: string }) {
  const pathname = usePathname();
  const hidden = pathname === "/";

  useEffect(() => {
    // ad.js scans once at load; a unit mounted by client navigation asks again.
    if (!hidden) (window as unknown as { crawlproofAds?: { scan?: () => void } }).crawlproofAds?.scan?.();
  }, [hidden, pathname]);

  if (hidden) return null;
  return (
    <div className={`ad-slot ${className ?? ""}`}>
      <div data-cp-ad="" data-slot={slot} data-format="text_link" />
    </div>
  );
}
