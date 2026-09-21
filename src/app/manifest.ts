import type { MetadataRoute } from "next";

/**
 * Installed-app identity. Without this file the browser had nothing to install with:
 * no name, no icon, no colours — so a home-screen shortcut fell back to a generic
 * glyph or a screenshot of the page.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HM Stocks — Parts Management",
    short_name: "HM Stocks",
    description: "Stock, sales and customer accounts for HM Mobiles.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches the app's slate background, so the splash screen doesn't flash white.
    background_color: "#0f172a",
    theme_color: "#2563eb",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops this to its own shape; the glyph sits inside the safe zone.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
