import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run dev` only answers its own hostname (localhost). A phone on the same Wi-Fi opens
  // http://192.168.x.x:3000, which Next 16 treats as a foreign origin: the page HTML arrives but
  // the JavaScript is refused, so nothing interactive runs — no map, no buttons. These are the
  // private home/office network ranges. Development only; production builds ignore this setting.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // camera for QR scanning and photos, location for pinning — this site only
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
        ],
      },
      {
        // the service worker must always be re-checked, or a deploy can't replace it
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
