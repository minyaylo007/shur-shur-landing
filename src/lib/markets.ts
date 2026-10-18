import type { Metadata } from "next";
import type { Locale } from "./i18n";
import type { Market } from "./attribution";
import { workItems, type WorkItem } from "./work";
import { site } from "./site";

/**
 * Market landing pages — one per advertised market (contract «site → lead
 * ledger», §«Рынки»). The market of a lead is read from the LANDING PATH
 * (`lib/attribution` → `marketOf`), so the path of each page below is part
 * of the contract, not a design choice: `/ro/suceava`, `/he/tel-aviv`.
 *
 * WHAT THE PAGES MAY NOT SAY (owner, 29.09.2026). We have a colleague in
 * Suceava who speaks Romanian — that is true and may be said. We do NOT have
 * a Romanian number, an office, a company, prices in RON or reviews from
 * Romanian clients, and nothing on the page may state or hint otherwise.
 * For Tel Aviv we have no crew on the ground, so the page sells the work
 * that is done remotely.
 *
 * The two things that are missing today are CONFIG, not copy: a local number
 * and published prices. While a value is `null` its block does not render at
 * all — no «coming soon», no empty slot. The day the owner has a real +40
 * number, it goes here and the block appears; no component changes.
 *
 * `approved` is the owner's sign-off on the texts, after a native speaker
 * read them. Until then the page is `noindex`, stays out of the sitemap and
 * is linked from no menu — it exists only for the ads that point at it.
 */

export interface LocalPhone {
  /** E.164, digits only after the plus: "+40…" / "+972…". */
  e164: string;
  /** How it is shown, grouped. Rendered pinned LTR. */
  display: string;
}

export interface LocalPrice {
  /** ISO 4217 — formatted by Intl, so no currency word lives in the copy. */
  currency: "RON" | "ILS";
  /** «From» price of the entry offer (a shooting day), whole units. */
  from: number;
}

export interface MarketLanding {
  market: Exclude<Market, "other">;
  locale: Locale;
  /** Path segment after the locale. */
  slug: string;
  /** A real local number with WhatsApp — null until one exists. */
  localPhone: LocalPhone | null;
  /** Published local prices — null until the owner sets them. */
  price: LocalPrice | null;
  /** Owner approved the texts after a native read → indexable, in sitemap. */
  approved: boolean;
}

export const marketLandings = {
  suceava: {
    market: "suceava",
    locale: "ro",
    slug: "suceava",
    localPhone: null, // +40 with WhatsApp — не существует на 29.09.2026
    price: null, // цены в RON — не утверждены
    approved: false, // тексты ждут проверки носителем
  },
  tel_aviv: {
    market: "tel_aviv",
    locale: "he",
    slug: "tel-aviv",
    localPhone: null, // +972 — не существует на 29.09.2026
    price: null, // цены в ₪ — не утверждены
    approved: false, // черновик, ждёт проверки носителем
  },
} as const satisfies Record<Exclude<Market, "other">, MarketLanding>;

export type LandingKey = keyof typeof marketLandings;

export const landingList: readonly MarketLanding[] = Object.values(marketLandings);

export function landingPath(landing: Pick<MarketLanding, "locale" | "slug">): string {
  return `/${landing.locale}/${landing.slug}`;
}

/** Only an approved page may be indexed or listed in the sitemap. */
export function landingIndexable(landing: MarketLanding): boolean {
  return landing.approved;
}

/**
 * The portfolio pieces a landing shows, by id. Throws on an unknown id, so
 * a case that is not in `lib/work` (i.e. not real) fails the build instead
 * of rendering an empty tile.
 */
export function workByIds(ids: readonly string[]): WorkItem[] {
  return ids.map((id) => {
    const item = workItems.find((w) => w.id === id);
    if (!item) throw new Error(`market landing: unknown work item "${id}"`);
    return item;
  });
}

/**
 * Metadata of a landing. It overrides everything the locale layout sets that
 * points at the home page — canonical, hreflang, og:url — because a landing
 * has no language siblings and must not claim the home page's address.
 */
export function landingMetadata(
  landing: MarketLanding,
  copy: { title: string; description: string },
): Metadata {
  const path = landingPath(landing);
  const indexable = landingIndexable(landing);
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: path },
    /* Replaces the layout's openGraph as a whole (Next merges metadata one
       key deep), so the card is restated here — same file, same size. */
    openGraph: {
      type: "website",
      url: path,
      siteName: site.name,
      title: copy.title,
      description: copy.description,
      images: [{ url: "/og-card.jpg", width: 1200, height: 630 }],
    },
    robots: { index: indexable, follow: indexable },
  };
}
