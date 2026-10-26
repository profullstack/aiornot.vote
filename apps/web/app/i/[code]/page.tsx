import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { canonicalInvite, inviteConfig, inviteStatus, INVITE_MESSAGES } from "@/lib/credits";
import { RememberInvite } from "@/components/CreditUI";

export const metadata = { title: "You're invited", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * An invite link: /i/INV-XXXX-XXXX-XXXX. Never priced or metered (middleware),
 * never spent here: the code is remembered (cookie + the signup form) and only
 * accepted when the new account verifies its email.
 */
export default async function InviteLanding({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const decoded = decodeURIComponent(raw).slice(0, 32);
  const status = await inviteStatus(decoded).catch(() => "invalid" as const);
  const code = status === "invalid" ? decoded : canonicalInvite(decoded);
  const user = await getCurrentUser();
  const days = inviteConfig.bonusDays;

  return (
    <div className="form-card container-narrow">
      <h1>{status === "ok" ? "You're invited to AIorNot.vote" : "This invite can't be used"}</h1>
      {status !== "ok" ? (
        <>
          <div className="form-error">{INVITE_MESSAGES[status]}</div>
          <p className="muted-sm" style={{ marginTop: 16 }}>
            You can still <Link href="/signup">create an account</Link> and play for free.
          </p>
        </>
      ) : user ? (
        <>
          <p className="muted">
            You already have an account, and invites are for new people. Pass it on to someone who doesn&apos;t.
          </p>
          <p><Link href="/account" className="btn">Your account →</Link></p>
        </>
      ) : (
        <>
          <RememberInvite code={code} />
          <p className="muted">
            Someone wanted you here. Spot the AI fakes, climb the weekly leaderboard, and win prizes.
            {days > 0 && (
              <>
                {" "}Create your account and verify your email, and you both get{" "}
                <strong>{days} days of the photo library</strong>: full-resolution, licensed, human-made photos.
              </>
            )}
          </p>
          <p style={{ marginTop: 16 }}>
            <Link href={`/signup?invite=${encodeURIComponent(code)}`} className="btn btn-primary">
              Accept the invite →
            </Link>
          </p>
          <p className="muted-sm">
            Invite <code>{code}</code>. Already a member? <Link href="/login">Sign in</Link>.
          </p>
        </>
      )}
    </div>
  );
}
