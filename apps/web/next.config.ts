import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @aiornot/db ships raw TS that Next must transpile.
  transpilePackages: ["@aiornot/db", "@aiornot/seed"],
  serverExternalPackages: ["@libsql/client", "@node-rs/argon2", "libsql"],
  images: {
    // Seed + Unsplash + R2 hosts. Kept permissive for MVP.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async redirects() {
    return [{ source: "/i/:slug", destination: "/m/:slug", permanent: true }];
  },
};

export default nextConfig;
