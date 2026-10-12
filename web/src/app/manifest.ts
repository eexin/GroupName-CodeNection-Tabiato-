import type { MetadataRoute } from "next";

/** Makes Tabiato installable: "Add to Home Screen" gives a full-screen app with its own icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tabiato 旅跡",
    short_name: "Tabiato",
    description: "Where a trip goes after it ends.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eff6f5",
    theme_color: "#0e4c55",
    categories: ["travel", "lifestyle", "photo"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
