import Link from "next/link";
import type { TagRow } from "@/lib/queries";

export function HomeHero({ tags }: { tags: TagRow[] }) {
  return (
    <section className="hero">
      <h1>
        Can you tell what&apos;s <span className="ai">AI</span>?
      </h1>
      <p>
        Guess photorealistic images and videos. Track your score. Subscribe to
        every list by RSS.
      </p>
      <form className="hero-search" action="/search" method="get">
        <input
          type="search"
          name="q"
          placeholder="Search media, tags, photographers…"
          aria-label="Search"
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>
      <div className="chips">
        {tags.slice(0, 14).map((t) => (
          <Link key={t.slug} href={`/t/${t.slug}`} className="chip">
            #{t.slug}
          </Link>
        ))}
        <Link href="/tags" className="chip">
          all tags →
        </Link>
      </div>
    </section>
  );
}
