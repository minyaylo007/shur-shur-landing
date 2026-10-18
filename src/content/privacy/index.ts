import type { Locale } from "@/lib/i18n";
import { isComplete, type PrivacyCopy } from "./types";
import { privacyUk } from "./uk";
import { privacyEn } from "./en";
import { privacyRo } from "./ro";
import { privacyHe } from "./he";

const policies: Record<Locale, PrivacyCopy> = {
  uk: privacyUk,
  en: privacyEn,
  he: privacyHe,
  ro: privacyRo,
};

export function getPrivacy(locale: Locale): PrivacyCopy {
  return policies[locale];
}

export { PRIVACY_SLUG, privacyPath } from "@/lib/legal";

/**
 * The ONE switch between «draft» and «published»: a locale's policy may be
 * indexed and listed in the sitemap only when it has no placeholder left.
 * Page metadata and the sitemap both read this; nothing else decides.
 */
export function privacyIndexable(locale: Locale): boolean {
  return isComplete(getPrivacy(locale));
}

export { FILL_MARK } from "./types";
