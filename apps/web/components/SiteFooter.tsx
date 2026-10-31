import { Footer as ProfullstackFooter } from "@profullstack/footer/react";

export function SiteFooter() {
  return (
    <ProfullstackFooter
      site="https://aiornot.vote/"
      links={[
        { label: "About", href: "/about" },
        { label: "RSS feeds", href: "/feeds" },
        { label: "API", href: "/api-docs" },
        { label: "Pricing", href: "/pricing" },
        { label: "Terms", href: "/terms" },
        { label: "Privacy", href: "/privacy" },
        { label: "Source", href: "https://github.com/profullstack/aiornot.vote", rel: "noopener noreferrer" },
      ]}
    />
  );
}
