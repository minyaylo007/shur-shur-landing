import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return locales.map((locale) => ({
    url: `${site.siteUrl}/${locale}`,
    lastModified,
    changeFrequency: "monthly",
    priority: locale === "uk" ? 1 : 0.9,
    alternates: {
      languages: {
        uk: `${site.siteUrl}/uk`,
        en: `${site.siteUrl}/en`,
      },
    },
  }));
}
