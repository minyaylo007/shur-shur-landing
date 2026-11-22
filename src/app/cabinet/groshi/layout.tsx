import type { Metadata } from "next";

/* «Гроші» inside the cabinet: the cabinet's root layout (no consent layer, no
   pixel, never indexed), narrowed to the phone column of /groshi. */

export const metadata: Metadata = {
  title: "Гроші",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  icons: {
    icon: [{ url: "/money/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/money/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function CabinetMoneyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="uk" className="-mx-4 -my-8 sm:-mx-6">
      <div className="mx-auto max-w-md px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">{children}</div>
    </div>
  );
}
