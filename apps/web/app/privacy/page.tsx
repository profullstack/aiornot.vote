import Link from "next/link";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="container-narrow" style={{ padding: "32px 24px", lineHeight: 1.7 }}>
      <h1>Privacy Policy</h1>
      <p className="muted-sm">Last updated: July 8, 2026</p>

      <p>
        Profullstack, Inc. operates AIorNot.vote. We keep data collection minimal and we don&apos;t
        sell your personal information. This policy explains what we collect and why.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> your email, optional display name, and account status.
        </li>
        <li>
          <strong>Gameplay:</strong> your guesses, scores, streaks, and rewards, used to run the
          game and leaderboards.
        </li>
        <li>
          <strong>Abuse-prevention signals:</strong> we store <em>hashed</em> (not raw) IP addresses
          and user-agent strings for rate-limiting and fraud prevention.
        </li>
        <li>
          <strong>Push subscriptions:</strong> if you enable notifications, we store the browser
          push endpoint needed to deliver them. Turn them off any time in{" "}
          <Link href="/account/settings">settings</Link>.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        To run the game and leaderboards, verify your email, prevent abuse, send notifications you
        opt into, process purchases, and improve the Service. We do not sell personal data or use it
        for third-party ad targeting.
      </p>

      <h2>Service providers</h2>
      <ul>
        <li><strong>Email</strong> is delivered via Resend.</li>
        <li><strong>Payments</strong> are processed in crypto via CoinPay.</li>
        <li><strong>Hosting</strong> is on Railway. Media is stored in object storage.</li>
        <li><strong>Push notifications</strong> are delivered through your browser&apos;s push service.</li>
      </ul>
      <p>These providers process data only as needed to provide their service.</p>

      <h2>Cookies</h2>
      <p>
        We use a session cookie to keep you signed in and a lightweight signed cookie to count guest
        rounds. We don&apos;t use third-party tracking cookies.
      </p>

      <h2>Your choices</h2>
      <p>
        You can turn notifications on or off in <Link href="/account/settings">settings</Link>. To
        delete your account or request your data, email{" "}
        <a href="mailto:hello@aiornot.vote">hello@aiornot.vote</a>.
      </p>

      <h2>Changes</h2>
      <p>We may update this policy; we&apos;ll revise the date above when we do.</p>

      <p className="muted-sm" style={{ marginTop: 24 }}>
        See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </div>
  );
}
