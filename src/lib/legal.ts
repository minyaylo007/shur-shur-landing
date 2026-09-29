import type { Locale } from "./i18n";

/**
 * Address of the privacy policy. Its own tiny module because a client
 * component (the form notice) links to it, and importing it from
 * `content/privacy` would ship all four policies in the form's bundle.
 */
export const PRIVACY_SLUG = "privacy";

export function privacyPath(locale: Locale): string {
  return `/${locale}/${PRIVACY_SLUG}`;
}
