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
 * The flag is enforced in `lib/channels` (`isChannelReady`, `readyChannel`,
 * `localeChannels`), and NO file but this one and `lib/channels.ts` may read
 * `site.socials.*` or import `messengers`: the href AND the visible @handle
 * are only reachable through the gate, so a render site cannot print a name
 * whose link it was not allowed to draw. Naming the components here was not
 * enough — the first fix listed ContactBar, Footer and AuditCta and missed the
 * hero, which kept the dead t.me link on the first screen of all four locales.
 * The rule is now checked by walking `src/**` instead of by listing files
 * (tests/conversion).
 *
 * 15.09.2026: the exemption used to read «outside `lib/`», and `lib` holds
 * data as well as the gate. `lib/posts.ts` — a grid nothing rendered any more
 * — reached `site.socials.instagram` on three of its tiles and the scan let it
 * through by address. Two files are exempt now, by name, and both are here.
 */
export const messengers = {
  // 15.09.2026: the username is not registered — see socials.telegram above.
  telegram: {
    href: site.socials.telegram,
    handle: site.socials.telegramHandle,
    profile: site.socials.telegram,
    ready: false,
  },
  instagram: {
    href: site.socials.instagramDm,
    handle: site.socials.instagramHandle,
    profile: site.socials.instagram,
    ready: true,
  },
  // WhatsApp and Viber have no @name of their own: they are the phone number,
  // which the page already shows as a `tel:` link of its own.
  whatsapp: { href: site.socials.whatsapp, handle: null, profile: null, ready: true },
  viber: { href: site.socials.viber, handle: null, profile: null, ready: true },
} as const satisfies Record<
  string,
  { href: string; handle: string | null; profile: string | null; ready: boolean }
>;
