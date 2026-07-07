import Link from "next/link";

export default function NotFound() {
  return (
    <div className="form-card container-narrow" style={{ textAlign: "center" }}>
      <h1>Not found</h1>
      <p className="muted">That page or media doesn&apos;t exist (or was removed).</p>
      <p style={{ marginTop: 16 }}>
        <Link href="/" className="btn btn-primary">Back to the feed →</Link>
      </p>
    </div>
  );
}
