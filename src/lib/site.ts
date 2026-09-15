/** Brand + contact constants. Single source of truth for links and naming. */
export const site = {
  name: "SHUR-SHUR",
  logotype: "shur-shur",
  // `||` (not `??`): an env var set to "" must also fall back to the default.
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://shur-shur.agency",
  city: { uk: "Чернівці", en: "Chernivtsi" },
  /**
   * The agency's single phone number. It already lived inside the wa.me and
   * viber deep-links below; redesign v2 surfaces it as a real `tel:` link
   * (brief §5 — the number must be visible on the page, not buried in a
   * messenger URL). `display` carries NBSPs so the groups never wrap.
   */
  phone: {
    e164: "+380972499107",
    tel: "tel:+380972499107",
    display: "+380\u00a097\u00a0249\u00a091\u00a007",
  },
  socials: {
    instagram: "https://www.instagram.com/shur.shur.agency",
    instagramHandle: "@shur.shur.agency",
    /** Official Instagram DM deep-link (ig.me). */
    instagramDm: "https://ig.me/m/shur.shur.agency",
    /**
     * PLACEHOLDER, and a checked one: `t.me/shur_shur_agency` answers 200
     * (Telegram does that for free usernames too) but its markup has no
     * `tgme_page_title` block, which every live account has — the name is
     * simply unregistered. Nothing renders it while `messengers.telegram`
     * is not ready; the real channel is still a question for the client.
     */
    telegram: "https://t.me/shur_shur_agency",
    telegramHandle: "@shur_shur_agency",
    whatsapp: "https://wa.me/380972499107",
    viber: "viber://chat?number=%2B380972499107",
  },
} as const;

/**
 * Messenger channels with launch readiness (REM-FIX-C4). `ready: false`
 * means the contact detail above is still a placeholder — a dead deep-link
 * silently swallows real enquiries, so the UI must NOT render the channel
 * ANYWHERE. Flip the flag to `true` once the real account is wired; no other
 * code changes are needed.
 *
 * The flag is enforced in `lib/channels` (`isChannelReady`, `localeChannels`),
 * and every component that shows a channel — ContactBar, Footer, AuditCta,
 * AuditForm — goes through it. Do not reach for `site.socials.*` directly in a
 * component: that is exactly how the dead Telegram link stayed on the live
 * page in the footer and the contact section while ContactBar was filtering
 * it out.
 */
export const messengers = {
  // 15.09.2026: the username is not registered — see socials.telegram above.
  telegram: { href: site.socials.telegram, ready: false },
  instagram: { href: site.socials.instagramDm, ready: true },
  whatsapp: { href: site.socials.whatsapp, ready: true },
  viber: { href: site.socials.viber, ready: true },
} as const satisfies Record<string, { href: string; ready: boolean }>;
