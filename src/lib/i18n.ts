export const locales = ["uk", "en", "he", "ro"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "uk";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Writing direction of a locale's script. */
export type Direction = "ltr" | "rtl";

/**
 * Per-locale writing direction. Hebrew is the only right-to-left locale, and
 * everything that flips with it — the `dir` attribute on <html>, the logical
 * Tailwind utilities keyed off `[dir="rtl"]`, the Services horizontal scrub —
 * derives from this map, so another RTL locale costs one line here.
 */
const directions: Record<Locale, Direction> = {
  uk: "ltr",
  en: "ltr",
  he: "rtl",
  ro: "ltr",
};

export function getDirection(locale: Locale): Direction {
  return directions[locale];
}

/**
 * Open Graph locale codes (`language_TERRITORY`) — og:locale and
 * og:locale:alternate reject bare language tags. The BCP-47 tag used by
 * hreflang is the locale code itself (`uk`, `en`, `he`, `ro`).
 */
export const ogLocales: Record<Locale, string> = {
  uk: "uk_UA",
  en: "en_US",
  he: "he_IL",
  ro: "ro_RO",
};

/**
 * Matches the leading `/<locale>` segment of a pathname and nothing more:
 * `/he` and `/he/foo` match, `/help` does not. Built from `locales` so the
 * language switcher can never drift from the list above.
 */
export const localeSegmentPattern = new RegExp(`^/(?:${locales.join("|")})(?=/|$)`);

/**
 * Each language written in itself (autonym). A language list is the one place
 * where translating the names is actively harmful: someone who reads only
 * Hebrew has to find «עברית», not «Hebrew» spelled in Ukrainian. Because the
 * names never change with the page language they live here rather than in the
 * four dictionaries — which is also four fewer strings to keep in sync.
 *
 * No flags anywhere: a flag names a country, not a language.
 */
export const localeNames: Record<Locale, string> = {
  uk: "Українська",
  en: "English",
  he: "עברית",
  ro: "Română",
};

/** Compact form for the collapsed switcher (the ISO code, uppercased). */
export const localeShort: Record<Locale, string> = {
  uk: "UK",
  en: "EN",
  he: "HE",
  ro: "RO",
};

/** Cookie + storage key holding a visitor's manual language choice. */
export const localeStorageKey = "shur.locale";
