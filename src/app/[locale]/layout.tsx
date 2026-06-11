import type { Metadata, Viewport } from "next";
import { Unbounded, Manrope } from "next/font/google";
import { notFound } from "next/navigation";
import { locales, isLocale, type Locale } from "@/lib/i18n";
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

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

type LayoutParams = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: LayoutParams): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "uk";
  const dict = getDictionary(locale);

  return {
    metadataBase: new URL(site.siteUrl),
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: {
      canonical: `/${locale}`,
      languages: {
        uk: "/uk",
        en: "/en",
        "x-default": "/uk",
      },
    },
    openGraph: {
      type: "website",
      url: `/${locale}`,
      siteName: site.name,
      title: dict.meta.title,
      description: dict.meta.description,
      locale: locale === "uk" ? "uk_UA" : "en_US",
      alternateLocale: locale === "uk" ? "en_US" : "uk_UA",
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
     screen — StickyCta/MessengerFab bottom offsets rely on it (REM-FIX-C4). */
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
       content visible and the Services track stacked. The class mismatch on
       purpose → suppressHydrationWarning (scoped to this element only). */
    <html lang={locale} className={`no-js ${unbounded.variable} ${manrope.variable}`} suppressHydrationWarning>
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
