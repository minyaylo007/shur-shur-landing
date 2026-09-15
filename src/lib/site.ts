/** Brand + contact constants. Single source of truth for links and naming. */
export const site = {
  name: "SHUR-SHUR",
  logotype: "shur-shur",
  // `||` (not `??`): an env var set to "" must also fall back to the default.
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://shur-shur.agency",
  city: { uk: "Чернівці", en: "Chernivtsi" },
  /**
   * The agency's single phone number.
   *
   * v3: the phone is NO LONGER a conversion path. It appears exactly once, in
   * the footer, as a detail — not in the header, not on the first screen, not
   * in the sticky contact control. A call costs the visitor more than a
   * message, reaches nobody outside office hours, and on a landing page whose
   * whole funnel is messengers it was competing with the one action that
   * matters. `display` carries NBSPs so the groups never wrap.
   */
  phone: {
    e164: "+380972499107",
    tel: "tel:+380972499107",
    display: "+380 97 249 91 07",
  },
  socials: {
    instagram: "https://www.instagram.com/shur.shur.agency",
    instagramHandle: "@shur.shur.agency",
    /** Official Instagram DM deep-link (ig.me). */
    instagramDm: "https://ig.me/m/shur.shur.agency",
    // Placeholder until the owner confirms the real channel/username.
    // Gated by `messengers.telegram.ready === false` below — nothing renders
    // it while this value is a guess.
    telegram: "https://t.me/shur_shur_agency",
    telegramHandle: "@shur_shur_agency",
    whatsapp: "https://wa.me/380972499107",
  },
} as const;

/**
 * Messenger channels with launch readiness.
 *
 * `ready: false` means the contact detail is still a placeholder and the UI
 * must NOT render the link — a dead deep-link silently swallows real
 * enquiries, which is worse than not offering the channel at all.
 *
 * v3 state:
 *   whatsapp  — real number, primary action everywhere.
 *   instagram — real account, offered as a social/portfolio link.
 *   telegram  — `t.me/shur_shur_agency` was never confirmed by the owner, so
 *               it is OFF. When the real address arrives, write it into
 *               `site.socials.telegram` and flip this flag; the contact
 *               control turns itself from a single direct link into a
 *               two-channel sheet with no other code change.
 *   viber     — removed in v3: the channel does not exist in the project.
 */
export const messengers = {
  whatsapp: { href: site.socials.whatsapp, ready: true },
  telegram: { href: site.socials.telegram, ready: false },
  instagram: { href: site.socials.instagramDm, ready: true },
} as const satisfies Record<string, { href: string; ready: boolean }>;

export type MessengerKey = keyof typeof messengers;

/**
 * The ONE primary action of the whole page (v3, discrepancy §6). Everything
 * labelled «Обговорити проєкт» — header, hero, contact control, contact
 * section — points here. There is deliberately no second filled button
 * anywhere: Instagram is a portfolio link, and the audit form is a different,
 * differently-labelled offer.
 */
export const primaryChannel = {
  key: "whatsapp" as const,
  href: messengers.whatsapp.href,
};
