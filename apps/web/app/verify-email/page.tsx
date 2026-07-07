import Link from "next/link";
import { verifyEmailToken } from "@/lib/auth";

export const metadata = { title: "Verify email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = await verifyEmailToken(token || "");
  return (
    <div className="form-card container-narrow">
      <h1>Email verification</h1>
      {result.ok ? (
        <>
          <div className="form-ok">Your email is verified. You can now guess and appear on leaderboards.</div>
          <p style={{ marginTop: 16 }}>
            <Link href="/" className="btn btn-primary">
              Start guessing →
            </Link>
          </p>
        </>
      ) : (
        <>
          <div className="form-error">{result.error}</div>
          <p className="muted-sm" style={{ marginTop: 16 }}>
            Head to your <Link href="/account">account</Link> to request a fresh verification link.
          </p>
        </>
      )}
    </div>
  );
}
