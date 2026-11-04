import type { Locale } from "./i18n";
import type { EventChannel, EventPlacement } from "./analytics";

/**
 * The site funnel counter, browser half (B3.2, 04.11.2026): a visit, the
 * visitor reaching `#contact`, a messenger click — each one beacon to
 * `/api/funnel`, which forwards it to the ads-engine's DAILY aggregate.
 *
 * It does not wait for cookie consent: the beacon carries no personal data
 * and sets or reads no cookie or storage — the event name, the locale, the
 * page path without its query and, for a click, the channel and placement;
 * the ledger keeps only per-day sums, so nobody can be told apart or followed.
 *
 * Fire-and-forget: no beacon support, a blocked request or a dead ledger
 * changes nothing on the page.
 */

export type FunnelBeacon =
  | { event: "visit" | "form_reached"; locale: Locale }
  | { event: "contact_click"; locale: Locale; channel: EventChannel; placement: EventPlacement };

export function sendFunnel(beacon: FunnelBeacon): void {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  try {
    // The path only: the query (utm, fbclid…) and the hash never leave the page here.
    const body = JSON.stringify({ ...beacon, path: window.location.pathname.slice(0, 120) });
    navigator.sendBeacon?.("/api/funnel", new Blob([body], { type: "application/json" }));
  } catch {
    /* A counter is not allowed to break the page. */
  }
}
