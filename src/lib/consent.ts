/**
 * The visitor's cookie choice: «only necessary» or «allow advertising
 * cookies». The default — no record, storage blocked, anything unreadable —
 * is «no»: nothing advertising loads until a visitor says yes.
 *
 * Storing the choice itself is strictly necessary (without it the banner
 * would ask on every page), so it needs no consent of its own. localStorage,
 * not a cookie: the server never needs it, the form sends it explicitly.
 */

export interface ConsentChoice {
  ads: boolean;
  /** ISO time of the choice — shown nowhere, kept so a revision can re-ask. */
  at: string;
}

export const CONSENT_STORAGE_KEY = "shur.consent.v1";
/** Fired on window after the choice changes; `detail` is the ConsentChoice. */
export const CONSENT_EVENT = "shur:consent";
/** Fired on window to bring the banner back (footer link). */
export const CONSENT_OPEN_EVENT = "shur:consent-open";

export function parseConsent(raw: string | null): ConsentChoice | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ConsentChoice> | null;
    if (value && typeof value.ads === "boolean" && typeof value.at === "string") {
      return { ads: value.ads, at: value.at };
    }
  } catch {
    /* fall through */
  }
  return null;
}

/** The stored choice, or null when the visitor has not chosen yet. */
export function readConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** True only after an explicit «allow». */
export function adsAllowed(): boolean {
  return readConsent()?.ads === true;
}

export function saveConsent(ads: boolean): ConsentChoice {
  const choice: ConsentChoice = { ads, at: new Date().toISOString() };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(choice));
  } catch {
    /* Not persisted: the choice still holds for this page view. */
  }
  window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_EVENT, { detail: choice }));
  return choice;
}
