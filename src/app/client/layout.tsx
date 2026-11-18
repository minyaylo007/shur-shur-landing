import type { Metadata, Viewport } from "next";
import { latinFontClass } from "../fonts";
import "../globals.css";

/**
 * A client's private cabinet (/client/<id>): the results of their bot and
 * their subscription. Outside the locales, Ukrainian only. Its own root
 * layout — no consent layer, no pixel, no analytics: the page may show
 * personal data of the people the bot talked to, and nothing on it reports
 * anywhere. Never indexed (meta here + X-Robots-Tag in next.config.ts).
 */

export const metadata: Metadata = {
  title: "SHUR-SHUR · кабінет клієнта",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export const viewport: Viewport = { themeColor: "#2a0a0e" };

export const dynamic = "force-dynamic";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={latinFontClass}>
      <body className="cabinet min-h-screen font-body antialiased">
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
