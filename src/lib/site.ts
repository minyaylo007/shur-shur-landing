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
    // PLACEHOLDER phone number — replace with the agency's real WhatsApp
    // number (international format, no +) before launch.
    whatsapp: "https://wa.me/380000000000",
    // PLACEHOLDER phone number — replace with the agency's real Viber number
    // (URL-encoded +) before launch.
    viber: "viber://chat?number=%2B380000000000",
  },
} as const;

/**
 * Messenger channels with launch readiness (REM-FIX-C4). `ready: false`
 * means the contact detail above is still a PLACEHOLDER (the 380000000000
 * numbers) and the UI must NOT render the link — a dead wa.me/viber
 * deep-link silently swallows real enquiries. Flip the flag to `true` once
 * the client provides the real number; no other code changes are needed.
 */
export const messengers = {
  telegram: { href: site.socials.telegram, ready: true },
  instagram: { href: site.socials.instagramDm, ready: true },
  whatsapp: { href: site.socials.whatsapp, ready: false },
  viber: { href: site.socials.viber, ready: false },
} as const satisfies Record<string, { href: string; ready: boolean }>;
