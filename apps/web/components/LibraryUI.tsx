import Link from "next/link";
import type { SessionUser } from "@/lib/session";
import type { LibraryPhoto } from "@/lib/library";
import { env } from "@/lib/env";
import { libraryPassDaysLeft } from "@/lib/library-pass";
import { BuyButton } from "./PaymentUI";

export function LicenseBadge({ photo }: { photo: Pick<LibraryPhoto, "source" | "license"> }) {
  return photo.source === "contributor" ? (
    <span className="chip" style={{ color: "var(--human)" }}>Human-made · contributor</span>
  ) : (
    <span className="chip">Archive · public domain</span>
  );
}

export function LibraryCard({ photo }: { photo: LibraryPhoto }) {
  return (
    <article className="card">
      <Link href={`/library/${photo.slug}`} className="card-media" style={{ display: "block" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.previewUrl} alt={photo.title} loading="lazy" />
      </Link>
      <div className="card-body">
        <h3 className="card-title">
          <Link href={`/library/${photo.slug}`}>{photo.title}</Link>
        </h3>
        <div className="muted-sm">
          {photo.photographer || "Unknown photographer"}
          {photo.photoDate ? ` · ${photo.photoDate}` : ""}
        </div>
        <div style={{ marginTop: 8 }}>
          <LicenseBadge photo={photo} />
        </div>
      </div>
    </article>
  );
}

/** Pass status, or the way to buy one, for the top of library pages. */
export function LibraryPassPanel({ user }: { user: SessionUser | null }) {
  const days = libraryPassDaysLeft(user?.libraryPassUntil);
  return (
    <div className="form-card" style={{ margin: "16px 0" }}>
      {user?.hasLibraryAccess ? (
        <div className="form-ok">
          {days > 0
            ? `Your library pass is active: ${days} day${days === 1 ? "" : "s"} left. Every download is full resolution and licensed.`
            : "Admin access: downloads are open."}
        </div>
      ) : (
        <>
          <div className="section-head" style={{ marginTop: 0 }}>
            <h2>Library pass: ${env.priceLibraryPassUsd} for {env.libraryPassDays} days</h2>
          </div>
          <ul className="muted" style={{ lineHeight: 1.9, margin: "8px 0 14px" }}>
            <li>Unlimited full-resolution originals (up to {env.libraryDailyDownloads} a day)</li>
            <li>Royalty-free commercial license on every download, no attribution needed</li>
            <li>One-time payment, no subscription. Buy again to add {env.libraryPassDays} more days.</li>
          </ul>
          {user ? (
            <BuyButton purpose="library_pass" priceUsd={env.priceLibraryPassUsd} label="Get the library pass" />
          ) : (
            <Link href="/login" className="btn btn-primary">Sign in to get the library pass</Link>
          )}
        </>
      )}
    </div>
  );
}
