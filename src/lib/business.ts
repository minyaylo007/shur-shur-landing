import type { Locale } from "./i18n";

/**
 * Facts about the business that ONLY the owner and Sasha can supply
 * (redesign v4, brief A5 and B5). Every slot is empty on purpose: an empty
 * slot renders nothing at all — no «від …», no placeholder name, no grey
 * box. The section around it still makes sense without it.
 *
 * Idea taken from the market-landings draft (PR #21, `lib/markets.ts`):
 * `null` means «not confirmed», and «not confirmed» means «not on the page».
 *
 * To fill a slot, put the real value here — nothing else changes:
 *   - prices: the «від» figure as it should read, currency included,
 *     per locale (the brief: USD/EUR, ILS/RON converted by us);
 *   - team: a photo in public/team/ plus a role per locale;
 *   - reviews: a verbatim quote, a name, and the person's permission;
 *   - email / requisites: shown in the footer.
 */

export type PackageKey = "shoot" | "social" | "ads";

export interface TeamMember {
  name: string;
  /** /team/<file>.webp, 4:5. */
  photo: string;
  role: Record<Locale, string>;
}

export interface Review {
  /** Verbatim, in the language it was written in. */
  quote: string;
  author: string;
  /** Business and city, as the author agreed to be named. */
  business: string;
}

export interface Business {
  prices: Record<PackageKey, Record<Locale, string> | null>;
  team: TeamMember[];
  reviews: Review[];
  email: string | null;
  /** ФОП / company line for invoices to foreign clients. */
  requisites: string | null;
}

export const business: Business = {
  prices: { shoot: null, social: null, ads: null },
  team: [],
  reviews: [],
  email: null,
  requisites: null,
};
