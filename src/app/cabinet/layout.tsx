import type { Metadata, Viewport } from "next";
import { latinFontClass } from "../fonts";
import "../globals.css";

/**
 * The owner's private stats cabinet: outside the locales, Russian only, view
 * only. Its own root layout — no consent layer, no pixel, no analytics: the
 * page is for one person and is not a marketing page. Never indexed (meta
 * here + X-Robots-Tag in next.config.ts), not in the sitemap.
 */

export const metadata: Metadata = {
  title: "SHUR-SHUR · кабинет",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export const viewport: Viewport = { themeColor: "#2a0a0e" };

export const dynamic = "force-dynamic";

export default function CabinetLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={latinFontClass}>
      <body className="cabinet min-h-screen font-body antialiased">
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
