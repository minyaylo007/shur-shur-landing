import type { Metadata, Viewport } from "next";
import { PanelLogo } from "@/components/ui/PanelLogo";
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

export const viewport: Viewport = { themeColor: "#4a0d14" };

export const dynamic = "force-dynamic";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={latinFontClass}>
      <body className="cabinet min-h-screen font-body antialiased">
        <header className="bg-cherry-deep text-cream-type">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <PanelLogo />
            <span className="text-sm text-cream-type/70">Кабінет клієнта</span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">{children}</main>
      </body>
    </html>
  );
}
