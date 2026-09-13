import type { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/lib/i18n";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  /* One hreflang map shared by every entry — built from `locales`, so adding a
     language adds both its own URL and its alternate on the other pages. */
  const languages = Object.fromEntries(
    locales.map((locale) => [locale, `${site.siteUrl}/${locale}`]),
  );

  return locales.map((locale) => ({
    url: `${site.siteUrl}/${locale}`,
    lastModified,
    changeFrequency: "monthly",
    /* The default locale is what `/` redirects to, hence the higher priority. */
    priority: locale === defaultLocale ? 1 : 0.9,
    alternates: { languages },
  }));
}
