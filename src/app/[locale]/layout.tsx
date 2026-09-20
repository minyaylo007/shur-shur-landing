import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import {
  locales,
  defaultLocale,
  isLocale,
  getDirection,
  ogLocales,
  type Locale,
} from "@/lib/i18n";
import { fontClasses } from "../fonts";
import { getDictionary } from "@/dictionaries";
import { site } from "@/lib/site";
import { buildSha, BUILD_SHA_META } from "@/lib/build";
import "../globals.css";

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
      /* The link card is 1.91:1 (1200x630) and the logotype sits in its
         middle third ON PURPOSE: messengers crop a card to a square, and the
         previous 1080x1350 artwork lost the word «shur-shur» — it stood at
         the bottom edge — in every such crop. width/height below are the
         file's REAL dimensions; tests/og-card asserts that by measuring the
         file, so a replacement asset of another shape cannot slip in.

         v3 arrived here with its own answer to a different problem: the card
         used to be a 2.75 MB lossless PNG, and the branch re-encoded it to a
         444 KB JPEG. Production had already done that AND fixed the crop, so
         the branch's vertical 1080x1350 card is not restored — its file is
         deleted with this merge. The weight argument is satisfied either
         way (og-card.jpg is 203 KB, less than half the branch's file); the
         readable name in a square crop is only satisfied by this one. */
      images: [{ url: "/og-card.jpg", width: 1200, height: 630, alt: dict.meta.ogAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.title,
      description: dict.meta.description,
      images: ["/og-card.jpg"],
    },
    /* Отпечаток сборки — единственное, по чему смока выката может ИЗМЕРИТЬ,
       что край отдаёт именно тот коммит, который мы только что выкатили, а не
       пережившую выкат копию предыдущего (см. lib/build). Живёт в общем
       layout, значит одинаково стоит во всех четырёх локалях; человеку не
       виден — это meta в <head>. Пустой объект, когда переменной сборки нет:
       вне боевого выката отпечатывать нечего. */
    other: buildSha ? { [BUILD_SHA_META]: buildSha } : {},
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
       pinned Services track, and v3 removed GSAP and Lenis entirely — every
       section is static HTML first, and the only motion left is CSS. */
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
        {children}
      </body>
    </html>
  );
}
