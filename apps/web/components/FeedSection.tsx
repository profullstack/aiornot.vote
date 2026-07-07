import Link from "next/link";
import { RssBar } from "./RssBar";
import { MediaGrid } from "./MediaGrid";
import { Pagination } from "./Pagination";
import { listMedia, type ListSort } from "@/lib/queries";
import { toClientCard } from "@/lib/serialize";
import { getCurrentUser, canParticipate } from "@/lib/session";
import { PAGE_SIZE } from "@/lib/queries";

const TABS: { label: string; href: string; sort?: ListSort }[] = [
  { label: "Newest", href: "/" },
  { label: "Trending", href: "/search?sort=trending" },
  { label: "Hardest", href: "/search?sort=hardest" },
  { label: "Featured", href: "/search?featured=1" },
];

export async function FeedSection({ page }: { page: number }) {
  const user = await getCurrentUser();
  const { items, total } = await listMedia({
    sort: "newest",
    page,
    userId: user?.id ?? null,
  });

  return (
    <>
      <div className="section-head">
        <h2>Latest media</h2>
        <div className="tabs">
          {TABS.map((t) => (
            <Link key={t.label} href={t.href} className={t.label === "Newest" ? "active" : ""}>
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      <RssBar feedPath="/rss.xml" title="Follow the latest media by RSS" />
      <MediaGrid cards={items.map(toClientCard)} canGuess={canParticipate(user)} isLoggedIn={!!user} />
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/page" />
    </>
  );
}
