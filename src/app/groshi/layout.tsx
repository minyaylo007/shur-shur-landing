import type { Metadata, Viewport } from "next";
import { latinFontClass } from "../fonts";
import "../globals.css";

/**
 * «Гроші» (/groshi): Sasha's money at one glance. Stage 1 is a demo on
 * made-up data, open by link without a login. Its own root layout — no
 * consent layer, no pixel, no analytics. Never indexed (meta here +
 * X-Robots-Tag in next.config.ts). Installable as an app from the phone's
 * home screen: manifest + apple meta, no service worker (not needed).
 */

export const metadata: Metadata = {
  title: "Гроші",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  manifest: "/groshi.webmanifest",
  appleWebApp: { capable: true, title: "Гроші", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/money/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/money/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = { themeColor: "#4a0d14", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function MoneyLayout({ children }: { children: React.ReactNode }) {
  // bottom padding: the floating «+ Внести» (3.5rem + 1rem) never covers the end of the page
  return (
    <html lang="uk" className={latinFontClass}>
      <body className="cabinet min-h-screen font-body antialiased">
        <main className="mx-auto max-w-md px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">{children}</main>
      </body>
    </html>
  );
}
