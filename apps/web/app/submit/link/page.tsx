import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { LinkSubmitForm } from "@/components/LinkSubmitForm";

export const metadata = {
  title: "Submit a post",
  description: "Paste a tweet, Reddit thread, Bluesky or Nostr post — let the crowd decide if it's AI or real.",
};
export const dynamic = "force-dynamic";

export default async function SubmitLinkPage() {
  const user = await getCurrentUser();
  return (
    <div className="form-card container-narrow">
      <h1>Is this post <span className="ai">AI</span>, or not?</h1>
      <p className="muted" style={{ lineHeight: 1.8 }}>
        Paste any post URL — a tweet, a Reddit thread, a Bluesky or Nostr note, or any web page.
        We fetch its text and drop it into the arena. There&apos;s no verified answer here:
        <strong> the crowd decides</strong>. No scoring, just the collective read.
      </p>
      {!user ? (
        <div className="notice">
          <Link href="/login">Sign in</Link> or <Link href="/signup">create an account</Link> to submit.
        </div>
      ) : !user.emailVerified ? (
        <div className="notice warn">
          Verify your email on your <Link href="/account">account</Link> before submitting.
        </div>
      ) : (
        <LinkSubmitForm canPlay={user.canPlay} />
      )}
      <p className="muted-sm" style={{ marginTop: 14 }}>
        Got an image or video instead? <Link href="/submit">Submit media →</Link>
      </p>
    </div>
  );
}
