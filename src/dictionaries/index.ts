import type { Locale } from "@/lib/i18n";
import { uk, type Dictionary } from "./uk";
import { en } from "./en";

const dictionaries: Record<Locale, Dictionary> = { uk, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
