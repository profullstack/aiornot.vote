import type { NextConfig } from "next";

// Content-Security-Policy — allows our own inline (Next hydration), Google Fonts,
// and the two third-party scripts we load (CrawlProof analytics/ads + Profullstack
// feedback). Media/images come from R2 + user URLs, hence https: for img/media.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' https://crawlproof.com https://feedback.profullstack.com",
  "connect-src 'self' https:",
  "frame-src 'self' https:",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  // @aiornot/db ships raw TS that Next must transpile.
  transpilePackages: ["@aiornot/db", "@aiornot/seed"],
  serverExternalPackages: ["@libsql/client", "@node-rs/argon2", "libsql", "sharp"],
  // Don't advertise the framework/version to attackers.
  poweredByHeader: false,
  images: {
    // Seed + Unsplash + R2 hosts. Kept permissive for MVP.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async redirects() {
    return [{ source: "/i/:slug", destination: "/m/:slug", permanent: true }];
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
