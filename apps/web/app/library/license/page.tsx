import Link from "next/link";
import type { Metadata } from "next";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Photo library license",
  description: "What a photo library download lets you do, and what contributors grant when they license a photo.",
  alternates: { canonical: "/library/license" },
};

export default function LibraryLicensePage() {
  return (
    <div className="container-narrow" style={{ padding: "32px 24px", lineHeight: 1.7 }}>
      <h1>Photo library license</h1>
      <p className="muted">
        Plain terms for the <Link href="/library">AIorNot.vote photo library</Link>. A library pass costs $
        {env.priceLibraryPassUsd} for {env.libraryPassDays} days of downloads.
      </p>

      <h2>What you can do with a download</h2>
      <p>
        Each photo you download while your pass is active is licensed to you, worldwide and without
        royalties, for as long as you use it. The license stays with that download after your pass
        ends. You may:
      </p>
      <ul>
        <li>use it in commercial and personal work: websites, ads, social posts, products, print, video and apps;</li>
        <li>crop, edit, color-grade and combine it with other work;</li>
        <li>use it without credit (credit to the photographer is appreciated).</li>
      </ul>

      <h2>What you may not do</h2>
      <ul>
        <li>sell or give away the photo itself, unchanged or as part of a stock, wallpaper or photo collection;</li>
        <li>build a competing library, dataset or photo service from library downloads;</li>
        <li>use a photo of a recognizable person in a way that is defamatory, or that suggests they endorse something;</li>
        <li>claim the photo as your own work, or register it as a trademark.</li>
      </ul>

      <h2>Archive photos</h2>
      <p>
        Archive photos come from The Metropolitan Museum of Art&apos;s Open Access program, which has
        released them into the public domain (CC0). They are free of copyright everywhere. The pass
        buys the curated, full-resolution file and the convenience, not the rights themselves.
      </p>

      <h2>For contributors</h2>
      <p>
        When you upload a photo on the <Link href="/submit">submit page</Link> and tick
        &ldquo;License it for the photo library&rdquo;, you confirm that you took the photo yourself,
        that it was not generated or substantially made with AI, and that you have any releases it
        needs. You keep your copyright. You grant AIorNot.vote a non-exclusive, worldwide right to
        show the photo and to license downloads of it to pass holders on the terms above. Ask us to
        remove a photo at any time; licenses already granted for past downloads continue.
      </p>
      <p>
        Every contributed photo also goes through the AIorNot.vote game, and a moderator checks it,
        before it is listed as human-made.
      </p>

      <h2>Payments</h2>
      <p>
        The pass is a one-time payment in crypto or PayPal through CoinPay. Digital access is
        non-refundable except where the law requires. Questions: hello@aiornot.vote.
      </p>
    </div>
  );
}
