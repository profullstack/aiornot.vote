import { env } from "@/lib/env";
import { CopyButton } from "./CopyButton";

const RSS_ICON = (
  <svg className="rss-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 11a9 9 0 0 1 9 9h2.5A11.5 11.5 0 0 0 4 8.5V11zm0 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0-9a13 13 0 0 1 13 13h2.5C19.5 8.6 13.4 2.5 4 2.5V7z" />
  </svg>
);

/** Prominent RSS subscribe bar shown at the top of every list view. */
export function RssBar({
  feedPath,
  title = "Follow this list by RSS",
  copy = "Every list has a feed. Subscribe in Feedly, NetNewsWire, Thunderbird, or any reader.",
}: {
  feedPath: string;
  title?: string;
  copy?: string;
}) {
  const full = feedPath.startsWith("http") ? feedPath : `${env.appUrl}${feedPath}`;
  return (
    <div className="rss-bar">
      <div>
        <div className="rss-title">{title}</div>
        <div className="rss-copy">{copy}</div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <a className="rss-link" href={feedPath}>
          {RSS_ICON} Subscribe via RSS
        </a>
        <CopyButton text={full} />
      </div>
    </div>
  );
}
