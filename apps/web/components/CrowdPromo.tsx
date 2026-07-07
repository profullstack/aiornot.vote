import Link from "next/link";

/**
 * Homepage promo band positioning AIorNot.vote as crowd-sourced AI image
 * detection *as a service* — with real social-proof stats and API-first CTAs.
 */
export function CrowdPromo({
  images,
  votes,
  opinions,
}: {
  images: number;
  votes: number;
  opinions: number;
}) {
  const fmt = (n: number) => n.toLocaleString();
  return (
    <section className="promo">
      <div className="eyebrow">Crowd-sourced AI detection · as a service</div>
      <h2>
        Is that image AI? <span className="grad">Ask the crowd.</span>
      </h2>
      <p className="lead">
        No black-box classifier — a transparent verdict from verified humans. Submit an
        image and thousands of eyes decide <strong>AI</strong> or <strong>real</strong>.
        Read the result on the web, by RSS, or straight from the API.
      </p>

      <div className="promo-cta">
        <Link href="/api" className="btn btn-primary">Get a crowd verdict — API →</Link>
        <Link href="/submit" className="btn">Submit an image</Link>
        <Link href="/play" className="btn">Play &amp; judge</Link>
        <Link href="/prizes" className="btn">🏆 Win weekly prizes</Link>
      </div>

      {(images > 0 || votes > 0) && (
        <div className="promo-stats">
          <div><div className="n ai">{fmt(images)}</div><div className="l">Images in play</div></div>
          <div><div className="n">{fmt(votes)}</div><div className="l">Human votes cast</div></div>
          {opinions > 0 && <div><div className="n">{fmt(opinions)}</div><div className="l">API submissions</div></div>}
        </div>
      )}

      <div className="promo-features">
        <div className="promo-feature">
          <div className="ft">Verified voters only</div>
          <div className="fd">Every vote comes from an email-verified account — one vote per person, no takebacks.</div>
        </div>
        <div className="promo-feature">
          <div className="ft">Simple API</div>
          <div className="fd">POST an image URL, poll the results endpoint for <code>ai_percent</code> and a verdict. $1 to start.</div>
        </div>
        <div className="promo-feature">
          <div className="ft">Transparent &amp; open</div>
          <div className="fd">Results are public and syndicated by RSS — inspect the crowd, not a hidden model. Images only, for now.</div>
        </div>
      </div>
    </section>
  );
}
