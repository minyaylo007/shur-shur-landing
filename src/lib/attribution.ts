import { z } from "zod";

/**
 * Where a lead came from — the site half of the «site → lead ledger»
 * contract (v1, 29.09.2026). Shared by the browser (capture) and the route
 * (validation, market, the Telegram line).
 *
 * STORAGE, and why it is sessionStorage and not a cookie (ePrivacy art. 5(3)).
 * Anything written to the visitor's device needs consent unless it is
 * strictly necessary for a service the visitor asked for. So the record is
 * kept as small and as local as it can be:
 *   - sessionStorage, not a cookie: it is never sent to any server by itself,
 *     it is first-party by construction (one origin), and it dies with the
 *     tab — no lifetime to justify, no cross-visit profile. It leaves the
 *     device only inside the form the visitor chooses to submit.
 *   - it holds only what the visitor's own URL already carried (utm_*, the
 *     click ids), the landing PATH (never the query) and the referrer HOST
 *     (never the full URL) — no identifier of ours, nothing generated.
 *   - the click ids and `fbc`/`fbp` are the advertising part: they are sent
 *     with the lead ONLY when the visitor allowed advertising cookies
 *     (`pickAttribution`). Without consent the lead carries campaign names
 *     and the landing path — enough for «which campaign, which market», not
 *     enough to match a person in an ad platform.
 */

/** The contract's field list, in the contract's order. */
export const ATTRIBUTION_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "fbc",
  "fbp",
  "landing_path",
  "referrer_host",
  "first_seen_at",
] as const;

export type AttributionField = (typeof ATTRIBUTION_FIELDS)[number];
export type Attribution = Partial<Record<AttributionField, string>>;

/** Fields that identify a click or a browser for an ad platform. */
export const AD_FIELDS: readonly AttributionField[] = ["fbclid", "gclid", "fbc", "fbp"];

const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/** Contract: every attribution string is at most 300 characters. */
export const ATTRIBUTION_MAX = 300;

export const ATTRIBUTION_STORAGE_KEY = "shur.attribution";

/*
 * Validation is LENIENT on purpose. Attribution is a passenger on the lead,
 * never a reason to refuse it: an over-long utm is cut, a garbled field is
 * dropped, and the lead still reaches Telegram. Unknown keys are stripped.
 */
const field = z
  .string()
  .transform((value) => value.trim().slice(0, ATTRIBUTION_MAX))
  .optional()
  .catch(undefined);

const attributionShape = Object.fromEntries(
  ATTRIBUTION_FIELDS.map((name) => [name, field]),
) as Record<AttributionField, typeof field>;

export const attributionSchema = z.object(attributionShape).optional().catch(undefined);

export const consentSchema = z
  .object({ ads: z.boolean() })
  .default({ ads: false })
  .catch({ ads: false });

/** Drops empty values so «no source» is `undefined`, not `{}` full of blanks. */
export function compactAttribution(value: Attribution | undefined): Attribution | undefined {
  if (!value) return undefined;
  const out: Attribution = {};
  for (const name of ATTRIBUTION_FIELDS) {
    const v = value[name];
    if (v) out[name] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/* ============================================================
   Market — contract §«Рынки»
   ============================================================ */

export const markets = ["suceava", "tel_aviv", "other"] as const;
export type Market = (typeof markets)[number];

/**
 * 1) the landing path `/ro/suceava…` or `/he/tel-aviv…`;
 * 2) otherwise a `utm_campaign` prefixed `sv_` or `ta_`;
 * 3) otherwise `other`.
 */
export function marketOf(
  attribution: Pick<Attribution, "landing_path" | "utm_campaign"> | undefined,
): Market {
  const path = attribution?.landing_path ?? "";
  if (path.startsWith("/ro/suceava")) return "suceava";
  if (path.startsWith("/he/tel-aviv")) return "tel_aviv";
  const campaign = attribution?.utm_campaign ?? "";
  if (campaign.startsWith("sv_")) return "suceava";
  if (campaign.startsWith("ta_")) return "tel_aviv";
  return "other";
}

/* ============================================================
   Browser side
   ============================================================ */

/**
 * Meta's click-id format: `fb.<subdomainIndex>.<creationTime ms>.<fbclid>`.
 * Subdomain index 1 = the registrable domain (shur-shur.com).
 */
export function fbcFromFbclid(fbclid: string, seenAtMs: number): string {
  return `fb.1.${seenAtMs}.${fbclid}`;
}

const clip = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, ATTRIBUTION_MAX) : undefined;
};

/**
 * One first-touch record from a URL + referrer. Pure, so it is tested without
 * a browser. `fbp` is never set here: it is the pixel's own cookie, read at
 * submit time and only with consent (see `pickAttribution`).
 */
export function captureAttribution(href: string, referrer: string, nowMs: number): Attribution {
  const url = new URL(href);
  const record: Attribution = {};
  for (const name of UTM_PARAMS) {
    const value = clip(url.searchParams.get(name));
    if (value) record[name] = value;
  }
  const fbclid = clip(url.searchParams.get("fbclid"));
  if (fbclid) {
    record.fbclid = fbclid;
    record.fbc = fbcFromFbclid(fbclid, nowMs).slice(0, ATTRIBUTION_MAX);
  }
  const gclid = clip(url.searchParams.get("gclid"));
  if (gclid) record.gclid = gclid;
  // The PATH only — a query string can carry anything, and none of it
  // belongs in a record that travels with a lead.
  record.landing_path = clip(url.pathname);
  if (referrer) {
    try {
      const host = new URL(referrer).host;
      // Our own pages are not a source.
      if (host && host !== url.host) record.referrer_host = clip(host);
    } catch {
      /* A malformed referrer is simply no referrer. */
    }
  }
  record.first_seen_at = new Date(nowMs).toISOString();
  return record;
}

/**
 * What the form sends. Campaign fields always; the ad identifiers only with
 * consent — and `fbp` only when the pixel's cookie exists, which itself only
 * happens after consent.
 */
export function pickAttribution(
  stored: Attribution | null,
  consentAds: boolean,
  fbp: string | undefined,
): Attribution | undefined {
  const out: Attribution = {};
  for (const name of ATTRIBUTION_FIELDS) {
    const value = stored?.[name];
    if (value === undefined || name === "fbp") continue;
    if (!consentAds && AD_FIELDS.includes(name)) continue;
    out[name] = value;
  }
  if (consentAds && fbp) out.fbp = fbp.slice(0, ATTRIBUTION_MAX);
  return compactAttribution(out);
}

/** First touch wins: an existing record for this tab is never overwritten. */
export function rememberFirstTouch(): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window.sessionStorage;
    if (storage.getItem(ATTRIBUTION_STORAGE_KEY) !== null) return;
    const record = captureAttribution(window.location.href, document.referrer, Date.now());
    storage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* Storage blocked (private mode, sandbox): the lead goes without a source. */
  }
}

function readStoredAttribution(): Attribution | null {
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    return attributionSchema.parse(JSON.parse(raw)) ?? null;
  } catch {
    return null;
  }
}

/** The pixel's own browser-id cookie, if the pixel ever ran here. */
function readFbpCookie(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)_fbp=([^;]+)/);
  return match?.[1];
}

/** The attribution a form submitted right now should carry. Browser only. */
export function attributionForSubmit(consentAds: boolean): Attribution | undefined {
  if (typeof window === "undefined") return undefined;
  // Storage blocked or never written: the page the form sits on is still a
  // true landing path — on /ro/suceava it is what makes the lead «suceava».
  const stored = readStoredAttribution() ?? safeCapture();
  return pickAttribution(stored, consentAds, consentAds ? readFbpCookie() : undefined);
}

function safeCapture(): Attribution | null {
  try {
    return captureAttribution(window.location.href, document.referrer, Date.now());
  } catch {
    return null;
  }
}
