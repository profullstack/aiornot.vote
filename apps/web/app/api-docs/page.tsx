import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { env } from "@/lib/env";
import { BuyButton } from "@/components/PaymentUI";
import { CopyButton } from "@/components/CopyButton";

export const metadata = {
  title: "Crowd-Opinion API",
  description: "Submit an image, get a crowd-sourced opinion on whether it's AI or real.",
};
export const dynamic = "force-dynamic";

export default async function ApiDocsPage() {
  const user = await getCurrentUser();
  const base = env.appUrl;
  const submitExample = `curl -X POST ${base}/api/v1/opinions \\
  -H "Authorization: Bearer aion_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"image_url":"https://example.com/photo.jpg","title":"Is this real?","tags":["portrait"]}'`;
  const resultsExample = `curl ${base}/api/v1/opinions/OPINION_ID`;

  return (
    <div className="container" style={{ paddingTop: 24, maxWidth: 860 }}>
      <div className="hero" style={{ padding: "24px 0" }}>
        <h1>Crowd-Opinion API</h1>
        <p>
          Submit a photorealistic image and let verified humans decide: <span className="ai">AI</span> or real?
          You get a shareable page and a results endpoint that aggregates the crowd&apos;s vote.
        </p>
      </div>

      <div className="rss-bar">
        <div>
          <div className="rss-title">Get API access — ${env.priceApiAccessUsd}</div>
          <div className="rss-copy">A one-time ${env.priceApiAccessUsd} in crypto (via CoinPay) issues an API key. Keeps out spam.</div>
        </div>
        {user ? (
          <BuyButton purpose="api_access" priceUsd={env.priceApiAccessUsd} label="Get a key" />
        ) : (
          <Link href="/login" className="btn btn-primary">Sign in to buy</Link>
        )}
      </div>
      <p className="muted-sm">
        Prefer everything? A <Link href="/membership">${env.priceLifetimeUsd} lifetime membership</Link> includes
        free API keys plus a member badge.
      </p>

      <div className="section-head" style={{ marginTop: 24 }}><h2>Create an opinion</h2></div>
      <p className="muted"><code>POST /api/v1/opinions</code> — auth with <code>Authorization: Bearer &lt;key&gt;</code>.</p>
      <div className="form-card" style={{ margin: "8px 0" }}>
        <pre style={{ overflowX: "auto", margin: 0, fontSize: 13 }}>{submitExample}</pre>
        <div style={{ marginTop: 10 }}><CopyButton text={submitExample} label="Copy" /></div>
      </div>
      <p className="muted-sm">Body fields: <code>image_url</code> (required, <strong>images only for now</strong>), <code>title</code>, <code>tags[]</code>, <code>metadata</code>. Returns <code>id</code>, <code>url</code>, <code>results_url</code>.</p>

      <div className="section-head" style={{ marginTop: 24 }}><h2>Get results</h2></div>
      <p className="muted"><code>GET /api/v1/opinions/:id</code> — public, no auth.</p>
      <div className="form-card" style={{ margin: "8px 0" }}>
        <pre style={{ overflowX: "auto", margin: 0, fontSize: 13 }}>{resultsExample}</pre>
      </div>
      <p className="muted-sm">
        Returns <code>votes {`{ ai, not_ai, total }`}</code>, <code>ai_percent</code>, and a <code>verdict</code>
        (<code>likely_ai</code> / <code>likely_not_ai</code> / <code>uncertain</code> / <code>insufficient_votes</code>).
      </p>

      <div className="notice" style={{ marginTop: 24 }}>
        <strong>Not a detector.</strong> Results are crowd opinions from verified voters — useful signal, not a
        scientific AI-detection guarantee.
      </div>
      <p className="muted-sm">Full reference: <Link href="https://github.com/profullstack/aiornot.vote/blob/master/docs/public-api.md">docs/public-api.md</Link></p>
    </div>
  );
}
