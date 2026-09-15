import type { Locale } from "@/lib/i18n";
import { messengers } from "@/lib/site";

export type ChannelKey = keyof typeof messengers;

/**
 * The ONE place the readiness contract from `lib/site` is enforced.
 *
 * The flag was honoured in exactly one of the FOUR components that render a
 * messenger link (ContactBar); the hero, the footer and the contact section
 * read `site.socials.*` straight through and shipped a dead t.me deep-link
 * for months — the hero one survived the first fix, because that fix went
 * down a list of known places instead of asking who reads the constant.
 *
 * So this module hands out the whole channel — link, public profile and the
 * visible @handle — and only while it is ready. Outside this file and
 * `lib/site.ts` there is no other way to reach any of the three, which is what
 * the source scan in tests/conversion.test.ts checks, file by file, over all
 * of `src/**` — the rest of `lib` included, since 15.09.2026.
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
  /** Where «write to us» goes: the DM deep-link. */
  href: string;
  /** Visible @name, or null for the two channels that are just the phone. */
  handle: string | null;
  /** Public page of the account, when it has one (Instagram). */
  profile: string | null;
}

/** Is this channel a real, answerable account right now? */
export function isChannelReady(key: ChannelKey): boolean {
  return messengers[key].ready;
}

/**
 * The channel — or `null`, which means render nothing at all. `null` is the
 * whole point: a caller that wants the href or the handle has to deal with
 * the not-ready case first, instead of being free to forget a flag.
 */
export function readyChannel(key: ChannelKey): Channel | null {
  const channel = messengers[key];
  if (!channel.ready) return null;
  return { key, href: channel.href, handle: channel.handle, profile: channel.profile };
}

/** Ready channels for a locale, in that locale's order. Never a dead link. */
export function localeChannels(locale: Locale): Channel[] {
  return MESSENGER_ORDER[locale]
    .map(readyChannel)
    .filter((channel): channel is Channel => channel !== null);
}
