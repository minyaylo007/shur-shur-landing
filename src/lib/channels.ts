import type { Locale } from "@/lib/i18n";
import { messengers } from "@/lib/site";

export type ChannelKey = keyof typeof messengers;

/**
 * The ONE place the readiness contract from `lib/site` is enforced.
 *
 * The flag was honoured in exactly one of the three components that render a
 * messenger link (ContactBar); the footer and the contact section read
 * `site.socials.*` straight through and shipped a dead t.me deep-link for
 * months. A contract that lives in a comment is not a contract: every render
 * site now has to come through `isChannelReady` / `localeChannels`, and the
 * href itself is only reachable from here in ready state.
 */

/**
 * Which messenger sits closest to the thumb, per locale. There is no geo-IP
 * here, so the page language stands in for the region: Ukrainian visitors get
 * Telegram first (≈92% weekly usage in Ukraine), everyone else — English,
 * Hebrew, Romanian — gets WhatsApp first, which dominates in Israel, Romania
 * and most of the rest of our market. Spelled out per locale on purpose: a new
 * language must state its own preference instead of inheriting a `!== "uk"`.
 *
 * The order is the wish; `localeChannels` is what actually renders — a channel
 * that is not launch-ready is dropped wherever it stands in this list.
 */
export const MESSENGER_ORDER: Record<Locale, readonly ChannelKey[]> = {
  uk: ["telegram", "instagram", "whatsapp", "viber"],
  en: ["whatsapp", "telegram", "instagram", "viber"],
  he: ["whatsapp", "telegram", "instagram", "viber"],
  ro: ["whatsapp", "telegram", "instagram", "viber"],
};

export interface Channel {
  key: ChannelKey;
  href: string;
}

/** Is this channel a real, answerable account right now? */
export function isChannelReady(key: ChannelKey): boolean {
  return messengers[key].ready;
}

/** Ready channels for a locale, in that locale's order. Never a dead link. */
export function localeChannels(locale: Locale): Channel[] {
  return MESSENGER_ORDER[locale]
    .filter(isChannelReady)
    .map((key) => ({ key, href: messengers[key].href }));
}
