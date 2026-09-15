import { Unbounded, Manrope, Rubik, Assistant } from "next/font/google";
import type { Locale } from "@/lib/i18n";

/**
 * The site's two font PAIRS and the rule that picks between them.
 *
 * This lives outside `[locale]/layout.tsx` because the layout is no longer
 * the only document in the app: `global-not-found.tsx` renders its own
 * <html> for addresses that match no route, and a 404 page set in a system
 * font is exactly the «forgotten place» this module exists to prevent. One
 * source of truth means a fifth locale is one line here, not two files.
 */

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
   module, so `<link rel="preload">` would be emitted on EVERY locale — the
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

/** The Hebrew pair as one class string — for documents that pick at runtime. */
export const hebrewFontClass = `${rubik.variable} ${assistant.variable}`;

/** The Latin/Cyrillic pair as one class string. */
export const latinFontClass = `${unbounded.variable} ${manrope.variable}`;

/** Font classes for a locale: the Hebrew pair for `he`, the Latin/Cyrillic
 *  pair for everyone else — only one pair is ever emitted per document. */
export function fontClasses(locale: Locale): string {
  return locale === "he" ? hebrewFontClass : latinFontClass;
}
