/**
 * Consent zone: does this visitor get the cookie banner?
 *
 * Owner's decision, 30.09.2026: the banner is for the EU/EEA (plus the UK and
 * Switzerland, whose laws ask the same); everyone else gets the pixel at once,
 * as on the owner's other sites, and can still refuse through the footer's
 * «cookie settings». Unknown is `eu` — no header (local run, a proxy that did
 * not run), a code that is not a country, no cookie: the safe side is asking.
 *
 * The country comes from Vercel's `x-vercel-ip-country` (ISO 3166-1 alpha-2,
 * upper case): https://vercel.com/docs/headers/request-headers#x-vercel-ip-country
 * src/proxy.ts reads it and leaves the answer in a strictly necessary cookie,
 * so the pages stay static — nothing on the server renders per country.
 */

export type ConsentZone = "eu" | "other";

export const ZONE_COOKIE = "shur_zone";
export const COUNTRY_HEADER = "x-vercel-ip-country";

/** 27 EU members + Iceland, Liechtenstein, Norway (EEA) + UK + Switzerland. */
export const EU_ZONE_COUNTRIES: ReadonlySet<string> = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "IS", "LI", "NO",
  "GB", "CH",
]);

/** Codes that name no country: "unknown" (XX, ZZ), private-use, groupings. */
const NOT_A_COUNTRY = new Set(["XX", "ZZ", "AA", "QM", "QZ", "EU", "UN"]);

export function zoneForCountry(raw: string | null | undefined): ConsentZone {
  const code = raw?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(code) || NOT_A_COUNTRY.has(code)) return "eu";
  return EU_ZONE_COUNTRIES.has(code) ? "eu" : "other";
}

/** The zone from a `document.cookie` string. Missing or garbled → `eu`. */
export function zoneFromCookie(cookie: string | null | undefined): ConsentZone {
  for (const part of (cookie ?? "").split(";")) {
    const [name, value] = part.trim().split("=");
    if (name === ZONE_COOKIE) return value === "other" ? "other" : "eu";
  }
  return "eu";
}

/** This visitor's zone in the browser; `eu` on the server or when unreadable. */
export function readZone(): ConsentZone {
  if (typeof document === "undefined") return "eu";
  try {
    return zoneFromCookie(document.cookie);
  } catch {
    return "eu";
  }
}
