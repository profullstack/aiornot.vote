import Link from "next/link";
import { getCurrentUser, canParticipate } from "@/lib/session";
import { Arena } from "@/components/Arena";

export const metadata = { title: "Play" };
export const dynamic = "force-dynamic";

export default async function PlayPage() {
  const user = await getCurrentUser();
  if (!canParticipate(user)) {
    return (
      <div className="form-card container-narrow">
        <h1>Play mode</h1>
        <p className="muted">Guess photorealistic media one at a time and build a streak.</p>
        {!user ? (
          <div className="notice">
            <Link href="/login">Sign in</Link> or <Link href="/signup">create an account</Link> to play.
          </div>
        ) : (
          <div className="notice warn">
            Verify your email on your <Link href="/account">account</Link> to play.
          </div>
        )}
      </div>
    );
  }
  return <Arena />;
}
