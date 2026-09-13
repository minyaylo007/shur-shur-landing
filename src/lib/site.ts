/** Brand + contact constants. Single source of truth for links and naming. */
export const site = {
  name: "SHUR-SHUR",
  logotype: "shur-shur",
  // `||` (not `??`): an env var set to "" must also fall back to the default.
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://shur-shur.agency",
  city: { uk: "Чернівці", en: "Chernivtsi" },
  socials: {
    instagram: "https://www.instagram.com/shur.shur.agency",
    instagramHandle: "@shur.shur.agency",
    /** Official Instagram DM deep-link (ig.me). */
    instagramDm: "https://ig.me/m/shur.shur.agency",
    // Placeholder until the client provides the real channel/username.
    telegram: "https://t.me/shur_shur_agency",
    telegramHandle: "@shur_shur_agency",
    whatsapp: "https://wa.me/380972499107",
    viber: "viber://chat?number=%2B380972499107",
  },
} as const;

/**
 * Messenger channels with launch readiness (REM-FIX-C4). `ready: false`
 * means the contact detail above is still a placeholder number and the UI
 * must NOT render the link — a dead wa.me/viber deep-link silently swallows
 * real enquiries. Flip the flag to `true` once the real number is wired;
 * no other code changes are needed.
 */
export const messengers = {
  telegram: { href: site.socials.telegram, ready: true },
  instagram: { href: site.socials.instagramDm, ready: true },
  whatsapp: { href: site.socials.whatsapp, ready: true },
  viber: { href: site.socials.viber, ready: true },
} as const satisfies Record<string, { href: string; ready: boolean }>;
