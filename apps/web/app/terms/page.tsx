import Link from "next/link";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="container-narrow" style={{ padding: "32px 24px", lineHeight: 1.7 }}>
      <h1>Terms of Service</h1>
      <p className="muted-sm">Last updated: July 8, 2026</p>

      <p>
        AIorNot.vote (&quot;the Service&quot;) is operated by Profullstack, Inc. (&quot;we&quot;,
        &quot;us&quot;). By using the Service you agree to these terms. If you don&apos;t agree,
        please don&apos;t use it.
      </p>

      <h2>The game</h2>
      <p>
        AIorNot.vote is a game where you guess whether photos, videos, and posts are AI-generated or
        real. Playing is free. You may play a limited number of rounds as a guest; creating a free
        account lets you save streaks, appear on leaderboards, and earn rewards.
      </p>

      <h2>Accounts</h2>
      <p>
        You&apos;re responsible for activity under your account and for keeping your login secure.
        Provide a valid email so we can verify your account. We may suspend or remove accounts that
        abuse the Service, cheat, scrape, spam, or break these terms.
      </p>

      <h2>Payments</h2>
      <p>
        Optional purchases (such as lifetime membership or API access) are processed in
        cryptocurrency via CoinPay. Digital goods and access grants are generally non-refundable
        except where required by law. Prices may change.
      </p>

      <h2>User submissions</h2>
      <p>
        If you submit or link media, you confirm you have the right to do so and grant us a license
        to display it within the Service. Don&apos;t submit illegal content, content you don&apos;t
        have rights to, or anything that violates others&apos; privacy or intellectual property.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don&apos;t attempt to manipulate leaderboards, automate voting, overload the Service, or
        access it in ways not permitted by the provided API. We may rate-limit or block abusive
        traffic.
      </p>

      <h2>Disclaimer &amp; liability</h2>
      <p>
        The Service is provided &quot;as is&quot; without warranties of any kind. AI-vs-real labels
        reflect our best effort and crowd input and may be imperfect. To the fullest extent
        permitted by law, we are not liable for indirect or consequential damages arising from your
        use of the Service.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms; continued use after changes means you accept them. Questions?
        Email <a href="mailto:hello@aiornot.vote">hello@aiornot.vote</a>.
      </p>

      <p className="muted-sm" style={{ marginTop: 24 }}>
        See also our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </div>
  );
}
