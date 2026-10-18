import type { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/lib/i18n";
import { site } from "@/lib/site";
import { privacyIndexable, privacyPath } from "@/content/privacy";
import { landingList, landingIndexable, landingPath } from "@/lib/markets";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  /* One hreflang map shared by every entry — built from `locales`, so adding a
     language adds both its own URL and its alternate on the other pages. */
  const languages = Object.fromEntries(
    locales.map((locale) => [locale, `${site.siteUrl}/${locale}`]),
  );

  const home: MetadataRoute.Sitemap = locales.map((locale) => ({
    url: `${site.siteUrl}/${locale}`,
    lastModified,
    changeFrequency: "monthly",
    /* The default locale is what `/` redirects to, hence the higher priority. */
    priority: locale === defaultLocale ? 1 : 0.9,
    alternates: { languages },
  }));

  /* Drafts stay out: a policy page joins only once it has no «[ЗАПОЛНИТЬ: …]»
     left, a market landing only once the owner flips `approved` in
     lib/markets. The same two switches decide their robots meta. */
  const privacy: MetadataRoute.Sitemap = locales.filter(privacyIndexable).map((locale) => ({
    url: `${site.siteUrl}${privacyPath(locale)}`,
    lastModified,
    changeFrequency: "yearly",
    priority: 0.2,
  }));

  const landings: MetadataRoute.Sitemap = landingList
    .filter(landingIndexable)
    .map((landing) => ({
      url: `${site.siteUrl}${landingPath(landing)}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    }));

  return [...home, ...privacy, ...landings];
}
