import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { normalizePage } from "@/lib/pagination";
import { listLibrary, libraryStats, type LibrarySource } from "@/lib/library";
import { env } from "@/lib/env";
import { Pagination } from "@/components/Pagination";
import { LibraryCard, LibraryPassPanel } from "@/components/LibraryUI";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 36;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = !!(sp.q || sp.source || (sp.page && sp.page !== "1"));
  return {
    title: "Photo library",
    description: `Human-made photos, licensed for commercial use. Full-resolution downloads with a $${env.priceLibraryPassUsd} pass.`,
    alternates: { canonical: "/library" },
    // Only the plain library page is indexed; searches and pages are crawl traps.
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

const SOURCES: { key: LibrarySource | null; label: string }[] = [
  { key: null, label: "All" },
  { key: "contributor", label: "Human-made, contributed" },
  { key: "met", label: "Archive (public domain)" },
];

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim().slice(0, 80);
  const source = sp.source === "contributor" || sp.source === "met" ? sp.source : null;
  const page = normalizePage(sp.page);

  const [user, stats, { photos, total }] = await Promise.all([
    getCurrentUser(),
    libraryStats(),
    listLibrary({ q, source, page, pageSize: PAGE_SIZE }),
  ]);

  const baseQuery = new URLSearchParams();
  if (q) baseQuery.set("q", q);
  if (source) baseQuery.set("source", source);
  const href = (s: LibrarySource | null) => {
    const p = new URLSearchParams(baseQuery);
    if (s) p.set("source", s);
    else p.delete("source");
    const str = p.toString();
    return `/library${str ? `?${str}` : ""}`;
  };

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="hero" style={{ padding: "16px 0" }}>
        <h1>
          Photo <span className="human">library</span>
        </h1>
        <p>
          Photos taken by people, not generated. Contributors license their work to the library, and
          the crowd on AIorNot.vote checks it. The archive adds public-domain photographs from The
          Met. {stats.total.toLocaleString()} photos so far.
        </p>
      </div>

      <LibraryPassPanel user={user} />

      <form action="/library" method="get" style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "12px 0" }}>
        {source && <input type="hidden" name="source" value={source} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Search photos, photographers, tags"
          aria-label="Search the library"
          style={{ flex: "1 1 260px", background: "var(--panel-alt)", border: "1px solid var(--border-3)", borderRadius: 10, padding: "10px 12px", color: "var(--text)" }}
        />
        <button className="btn" type="submit">Search</button>
      </form>

      <div className="chips" style={{ justifyContent: "flex-start" }}>
        {SOURCES.map((s) => (
          <Link key={s.label} href={href(s.key)} className="chip" aria-current={s.key === source ? "page" : undefined}
            style={s.key === source ? { borderColor: "var(--text)", color: "var(--text)" } : undefined}>
            {s.label}
            {s.key === "contributor" ? ` · ${stats.contributor}` : s.key === "met" ? ` · ${stats.met}` : ""}
          </Link>
        ))}
      </div>

      <div className="section-head">
        <h2>{q ? `Results for “${q}”` : source === "contributor" ? "Contributed photos" : source === "met" ? "Archive" : "All photos"}</h2>
        <span className="sub">{total.toLocaleString()} photos</span>
      </div>

      {photos.length === 0 ? (
        <div className="notice">
          {q || source ? "No photos match that yet." : "The library is being stocked. Check back soon."}{" "}
          <Link href="/submit">Contribute your own photos</Link>.
        </div>
      ) : (
        <div className="grid">
          {photos.map((p) => (
            <LibraryCard key={p.id} photo={p} />
          ))}
        </div>
      )}

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/library" query={baseQuery.toString()} />

      <div className="notice" style={{ marginTop: 24 }}>
        <strong>Take photos?</strong> Upload them on the <Link href="/submit">submit page</Link> and tick
        &ldquo;License it for the photo library&rdquo;. You keep your copyright. Read the{" "}
        <Link href="/library/license">library license</Link>.
      </div>
    </div>
  );
}
