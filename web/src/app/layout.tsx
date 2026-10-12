import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "@/app/globals.css";
import { RegisterServiceWorker } from "@/components/pwa";

// Poppins is bundled locally (OFL licence) so builds never depend on a font CDN.
const poppins = localFont({
  src: [
    { path: "./fonts/Poppins-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Poppins-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Poppins-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tabiato 旅跡",
  description: "Where a trip goes after it ends.",
  applicationName: "Tabiato",
  appleWebApp: { capable: true, title: "Tabiato", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#eff6f5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
      {/* browser extensions add their own attributes to <body> before React loads. This ignores
          attribute differences on <body> only; mismatches anywhere inside the page still show. */}
      <body suppressHydrationWarning>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-[13px] focus:font-bold focus:text-white">
          Skip to content
        </a>
        <div id="main">{children}</div>
        {/* real-user page views and Core Web Vitals on Vercel; no-ops locally */}
        <RegisterServiceWorker />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
