import Link from "next/link";

export function Pagination({
  page,
  total,
  pageSize,
  basePath,
  query = "",
}: {
  page: number;
  total: number;
  pageSize: number;
  basePath: string; // e.g. "/page" or "/search"
  query?: string; // extra query string without leading ?
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const mk = (p: number) => {
    if (basePath === "/page") return p <= 1 ? `/` : `/page/${p}`;
    const q = new URLSearchParams(query);
    q.set("page", String(p));
    return `${basePath}?${q.toString()}`;
  };
  return (
    <nav className="pager">
      {page > 1 ? (
        <Link className="btn btn-sm" href={mk(page - 1)}>
          ← Prev
        </Link>
      ) : (
        <span className="btn btn-sm dim" aria-disabled>
          ← Prev
        </span>
      )}
      <span className="muted">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link className="btn btn-sm" href={mk(page + 1)}>
          Next →
        </Link>
      ) : (
        <span className="btn btn-sm dim" aria-disabled>
          Next →
        </span>
      )}
    </nav>
  );
}
