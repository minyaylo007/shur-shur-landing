import type { Metadata, Viewport } from "next";
import { Unbounded, Manrope, Rubik, Assistant } from "next/font/google";
import { notFound } from "next/navigation";
import {
  locales,
  defaultLocale,
  isLocale,
  getDirection,
  ogLocales,
  type Locale,
} from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { site } from "@/lib/site";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import "../globals.css";

/* Cyrillic subset is REQUIRED — without it Ukrainian text silently
   falls back to a system font. */
const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
});

/* Hebrew pair. Unbounded/Manrope ship no Hebrew glyphs, so `he` would fall
   back to whatever the OS has — different metrics on every device and none of
   the brand character. Rubik keeps the heavy geometric display voice and
   Assistant the neutral grotesk body voice, both with a real `hebrew` subset.
   They bind to the SAME CSS variables, so every component and the Tailwind
   `--font-display`/`--font-body` theme keep working unchanged.

   `preload: false` on purpose: all four families live in this one shared
   layout, so `<link rel="preload">` would be emitted on EVERY locale — the
   Ukrainian page would start four Hebrew font downloads at highest priority.
   Hebrew therefore loads its faces when the CSS first uses them (one hop
   later, `display: swap` covers the gap) and uk/en/ro keep exactly the head
   they had before this locale existed. */
const rubik = Rubik({
  subsets: ["latin", "hebrew"],
  variable: "--font-unbounded",
  display: "swap",
  preload: false,
});

const assistant = Assistant({
  subsets: ["latin", "hebrew"],
  variable: "--font-manrope",
  display: "swap",
  preload: false,
});

/** Font classes for a locale: the Hebrew pair for `he`, the Latin/Cyrillic
 *  pair for everyone else — only one pair is ever emitted per document. */
function fontClasses(locale: Locale): string {
  return locale === "he"
    ? `${rubik.variable} ${assistant.variable}`
    : `${unbounded.variable} ${manrope.variable}`;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

type LayoutParams = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: LayoutParams): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const dict = getDictionary(locale);

  /* hreflang map built from `locales`, so a new language needs no edit here.
     x-default points at the default locale — the same target as `/`. */
  const languages: Record<string, string> = Object.fromEntries([
    ...locales.map((code) => [code, `/${code}`]),
    ["x-default", `/${defaultLocale}`],
  ]);

  return {
    metadataBase: new URL(site.siteUrl),
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: {
      canonical: `/${locale}`,
      languages,
    },
    openGraph: {
      type: "website",
      url: `/${locale}`,
      siteName: site.name,
      title: dict.meta.title,
      description: dict.meta.description,
      locale: ogLocales[locale],
      alternateLocale: locales.filter((code) => code !== locale).map((code) => ogLocales[code]),
      images: [{ url: "/og.png", width: 500, height: 600, alt: dict.meta.ogAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.title,
      description: dict.meta.description,
      images: ["/og.png"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#4a0d14",
  /* env(safe-area-inset-*) stays 0 unless the page opts into the full iOS
     screen — the ContactBar's bottom offset relies on it (REM-FIX-C4). */
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode }> & LayoutParams) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    /* `no-js` is removed synchronously by the inline script below before the
       page paints; while it stays (JS disabled/failed) CSS keeps `.reveal`
       content visible. The class mismatch is on purpose →
       suppressHydrationWarning (scoped to this element only).
       `dir` comes from the locale: it drives the logical Tailwind utilities
       and the `[dir="rtl"]` rules in globals.css. Redesign v2 removed the
       pinned Services track, so nothing left on the page depends on GSAP for
       readable layout — every section is static HTML first. */
    <html
      lang={locale}
      dir={getDirection(locale)}
      className={`no-js ${fontClasses(locale)}`}
      suppressHydrationWarning
    >
      <body className="grain antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.remove('no-js')",
          }}
        />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
