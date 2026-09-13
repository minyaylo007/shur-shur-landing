import type { Locale } from "@/lib/i18n";
import { uk, type Dictionary } from "./uk";
import { en } from "./en";
import { he } from "./he";
import { ro } from "./ro";

/**
 * Every locale from `lib/i18n` needs an entry here: the `Record<Locale, …>`
 * turns a missing translation into a compile error rather than a runtime
 * `undefined` somewhere deep in a section.
 */
const dictionaries: Record<Locale, Dictionary> = { uk, en, he, ro };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
