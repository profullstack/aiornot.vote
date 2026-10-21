import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { formatBytes, getLibraryPhoto } from "@/lib/library";
import { env } from "@/lib/env";
import { LibraryPassPanel, LicenseBadge } from "@/components/LibraryUI";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const photo = await getLibraryPhoto({ slug });
  if (!photo) return { title: "Photo not found" };
  const by = photo.photographer ? ` by ${photo.photographer}` : "";
  return {
    title: `${photo.title}${by} · Photo library`,
    description: `${photo.title}${by}. Licensed for commercial use; full-resolution download with a $${env.priceLibraryPassUsd} library pass.`,
    alternates: { canonical: `/library/${photo.slug}` },
    openGraph: { images: [{ url: photo.previewUrl }] },
  };
}

export default async function LibraryPhotoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [photo, user] = await Promise.all([getLibraryPhoto({ slug }), getCurrentUser()]);
  if (!photo) notFound();

  const humanPct = photo.votes ? Math.round((photo.votes.human / photo.votes.total) * 100) : null;
  const dims = photo.width && photo.height ? `${photo.width} × ${photo.height}px` : null;

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ImageObject",
            name: photo.title,
            contentUrl: photo.previewUrl.startsWith("/") ? `${env.appUrl}${photo.previewUrl}` : photo.previewUrl,
            creator: photo.photographer ? { "@type": "Person", name: photo.photographer } : undefined,
            license: `${env.appUrl}/library/license`,
            acquireLicensePage: `${env.appUrl}/library/${photo.slug}`,
            creditText: photo.photographer || undefined,
          }),
        }}
      />
      <p className="muted-sm"><Link href="/library">← Photo library</Link></p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, alignItems: "start" }}>
        <div className="card" style={{ animation: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.previewUrl} alt={photo.title} style={{ width: "100%", height: "auto", display: "block" }} />
        </div>
        <div>
          <h1 style={{ fontSize: 26, lineHeight: 1.25, marginTop: 0 }}>{photo.title}</h1>
          <p className="muted">
            {photo.photographer || "Unknown photographer"}
            {photo.photoDate ? ` · ${photo.photoDate}` : ""}
          </p>
          <p><LicenseBadge photo={photo} /></p>
          {humanPct != null && photo.votes && (
            <div className="notice">
              <strong className="human">{humanPct}%</strong> of {photo.votes.total} players on AIorNot.vote called this
              human-made.
            </div>
          )}
          {photo.description && <p className="muted-sm">{photo.description}</p>}
          <ul className="muted-sm" style={{ lineHeight: 1.9, paddingLeft: 18 }}>
            {dims && <li>Original: {dims}{photo.fileSizeBytes ? `, ${formatBytes(photo.fileSizeBytes)}` : ""}</li>}
            <li>
              License:{" "}
              {photo.license === "cc0"
                ? "public domain (CC0), plus the library license"
                : "AIorNot.vote library license, granted by the photographer"}{" "}
              · <Link href="/library/license">terms</Link>
            </li>
            {photo.creditUrl && (
              <li>
                Source: <a href={photo.creditUrl} rel="noopener nofollow" target="_blank">{new URL(photo.creditUrl).hostname}</a>
              </li>
            )}
            {photo.tags.length > 0 && (
              <li>
                Tags:{" "}
                {photo.tags.map((t, i) => (
                  <span key={t}>
                    {i > 0 && ", "}
                    <Link href={`/library?q=${encodeURIComponent(t)}`}>{t}</Link>
                  </span>
                ))}
              </li>
            )}
          </ul>

          {user?.hasLibraryAccess ? (
            <p>
              <a href={`/api/library/${photo.id}/download`} className="btn btn-primary" download>
                Download full resolution
              </a>
            </p>
          ) : (
            <LibraryPassPanel user={user} />
          )}
          <p className="muted-sm">The preview above is watermarked. Downloads are the untouched original.</p>
        </div>
      </div>
    </div>
  );
}
