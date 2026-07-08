import Link from "next/link";
import { getCurrentUser, canParticipate } from "@/lib/session";
import { Arena } from "@/components/Arena";

export const metadata = { title: "Play" };
export const dynamic = "force-dynamic";

export default async function PlayPage() {
  const user = await getCurrentUser();
  // Logged in but not verified: nudge to verify (their guesses would be lost).
  if (user && !canParticipate(user)) {
    return (
      <div className="form-card container-narrow">
        <h1>Play mode</h1>
        <p className="muted">Guess photorealistic media one at a time and build a streak.</p>
        <div className="notice warn">
          Verify your email on your <Link href="/account">account</Link> to save your streak and play unlimited.
        </div>
      </div>
    );
  }
  // Anon visitors get free trial rounds; verified users get the full game.
  return <Arena signedIn={canParticipate(user)} />;
}
