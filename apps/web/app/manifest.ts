import type { MetadataRoute } from "next";

/**
 * Web app manifest, served by Next at /manifest.webmanifest and linked from
 * every page's head, so the game installs as a PWA (and lists on pwamart.com).
 * Icons are PNG renders of app/icon.svg; the maskable pair is the same art
 * without the rounded corners, its content inside the 80% safe zone.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "AIorNot.vote",
    short_name: "AIorNot",
    description:
      "Can you tell AI from real? Vote on images, videos and posts in the crowd-sourced AI-detection game.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#08080c",
    theme_color: "#08080c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
