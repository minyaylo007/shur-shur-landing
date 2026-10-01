import type { Locale } from "./i18n";

/**
 * The thank-you page and the hand-over of the lead id (event scheme from the
 * targetologist, 01.10.2026: a lead = the form was ACCEPTED → the visitor
 * lands on the thank-you page; the pixel's Lead fires there).
 *
 * The address carries nothing — no query, no lead id, no form field: what
 * travels in a URL ends up in Meta's `dl` parameter, in referrers and in
 * logs. The lead id goes through sessionStorage instead, one-shot: the
 * thank-you page reads it and deletes it in the same breath, so a reload,
 * «back», or a direct visit finds nothing and sends no Lead.
 */

/** The thank-you page of a locale. Exactly the path — never a `?`. */
export function thanksPath(locale: Locale): string {
  return `/${locale}/thanks`;
}

export const THANKS_LEAD_KEY = "shur.thanks.lead";

/** Older than this, a stored id is not «this submission» any more. The
 *  redirect follows the server's answer at once; minutes are plenty. */
export const THANKS_LEAD_TTL_MS = 10 * 60 * 1000;

/** The server's lead id is a UUID (crypto.randomUUID in /api/lead). */
const LEAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Leaves the id for the thank-you page. Blocked storage → no Lead, nothing else breaks. */
export function stashThanksLead(storage: Store | null, leadId: string | undefined, now = Date.now()): void {
  if (!storage || !leadId || !LEAD_ID.test(leadId)) return;
  try {
    storage.setItem(THANKS_LEAD_KEY, JSON.stringify({ id: leadId, at: now }));
  } catch {
    /* private mode, quota: the visitor still gets the page */
  }
}

/** Reads AND deletes. Returns the id only when it is fresh and well-formed. */
export function takeThanksLead(storage: Store | null, now = Date.now()): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(THANKS_LEAD_KEY);
    storage.removeItem(THANKS_LEAD_KEY);
    if (!raw) return null;
    const { id, at } = JSON.parse(raw) as { id?: unknown; at?: unknown };
    if (typeof id !== "string" || !LEAD_ID.test(id)) return null;
    if (typeof at !== "number" || now - at < 0 || now - at > THANKS_LEAD_TTL_MS) return null;
    return id;
  } catch {
    return null;
  }
}

/** sessionStorage, or null where reading it throws (blocked site data). */
export function sessionStore(): Store | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * What the form does with the server's answer. Only an ACCEPTED submission
 * (HTTP ok AND `ok: true` in the body) hands the id over and leaves for the
 * thank-you page; a 429, a 400, a 502 or a body without `ok` stays on the
 * form with its error. Returns whether it navigated.
 */
export function afterLeadResponse(options: {
  responseOk: boolean;
  data: { ok?: boolean; lead_id?: unknown } | null;
  locale: Locale;
  storage: Store | null;
  navigate: (path: string) => void;
}): boolean {
  const { responseOk, data, locale, storage, navigate } = options;
  if (!responseOk || data?.ok !== true) return false;
  stashThanksLead(storage, typeof data.lead_id === "string" ? data.lead_id : undefined);
  navigate(thanksPath(locale));
  return true;
}
