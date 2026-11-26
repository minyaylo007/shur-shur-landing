import type { Metadata, Viewport } from "next";
import { PanelLogo } from "@/components/ui/PanelLogo";
import { latinFontClass } from "../fonts";
import "../globals.css";

/**
 * The one login (/login) for the owner's cabinet and the client cabinets.
 * Its own root layout, like the cabinets: no consent layer, no pixel, no
 * analytics. Never indexed (meta here + X-Robots-Tag in next.config.ts).
 */

export const metadata: Metadata = {
  title: "SHUR-SHUR · вхід",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export const viewport: Viewport = { themeColor: "#4a0d14" };

export const dynamic = "force-dynamic";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={latinFontClass}>
      <body className="cabinet min-h-screen font-body antialiased">
        <header className="bg-cherry-deep text-cream-type">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <PanelLogo />
            <span className="text-sm text-cream-type/70">Кабінет</span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">{children}</main>
      </body>
    </html>
  );
}
