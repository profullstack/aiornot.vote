import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { SubmitForm } from "@/components/SubmitForm";

export const metadata = { title: "Submit media" };
export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const user = await getCurrentUser();
  return (
    <div className="form-card container-narrow">
      <h1>Submit media</h1>
      <p className="muted">
        Share an image or short video for the community to judge. Everything is
        reviewed before it goes live.
      </p>
      <div className="notice" style={{ marginBottom: 4 }}>
        📝 Got a <strong>tweet, Reddit thread, Bluesky or Nostr post</strong> instead?{" "}
        <Link href="/submit/link">Submit a post for the crowd to judge →</Link>
      </div>
      {!user ? (
        <div className="notice">
          <Link href="/login">Sign in</Link> or <Link href="/signup">create an account</Link> to submit.
        </div>
      ) : !user.emailVerified ? (
        <div className="notice warn">
          Verify your email on your <Link href="/account">account</Link> before submitting.
        </div>
      ) : (
        <SubmitForm canPlay={user.canPlay} />
      )}
    </div>
  );
}
