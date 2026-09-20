import type { Locale } from "./i18n";

/**
 * The project's whole analytics surface (v3, discrepancy §12).
 *
 * There is NO analytics provider in this repository — no gtag, no Plausible,
 * no PostHog — and v3 deliberately does not add one: choosing a vendor is the
 * owner's decision, and shipping a third-party script uninvited costs the page
 * weight, a consent obligation and a privacy promise nobody made.
 *
 * What is missing without a provider is not the vendor, it is the *wiring*:
 * knowing which element to instrument, with which name, carrying which fields.
 * That work is done here instead. Every conversion element on the page already
 * calls `track()`; with no sink installed the call costs one optional-chained
 * property read and does nothing at all.
 *
 * Installing a provider later is one line in the app shell, e.g.
 *
 *   window.shurTrack = (e) => window.plausible?.(e.name, { props: e });
 *
 * and every event below starts flowing, with no component touched.
 */

/** Where on the page the interaction happened. */
export type EventPlacement = "header" | "hero" | "contact_bar" | "contact_section" | "footer";

/**
 * Which channel the visitor chose. Mirrors `ChannelKey` from `lib/channels`
 * plus the phone, which is a `tel:` link rather than a messenger. Keep the
 * two lists in step: a channel that can be clicked but not named here is a
 * conversion the owner cannot see.
 */
export type EventChannel = "whatsapp" | "telegram" | "instagram" | "viber" | "phone";

export type AnalyticsEvent =
  /** A visitor opened a contact channel. */
  | { name: "contact_click"; channel: EventChannel; locale: Locale; placement: EventPlacement }
  /** The audit form — the page's other conversion — was submitted. */
  | { name: "audit_submit"; locale: Locale; placement: EventPlacement }
  /** The visitor switched the interface language by hand. */
  | { name: "language_switch"; locale: Locale; to: Locale; placement: EventPlacement };

declare global {
  interface Window {
    /** The sink. Undefined until a provider is wired up; see the note above. */
    shurTrack?: (event: AnalyticsEvent) => void;
  }
}

/**
 * Fire an event. Safe on the server, safe with no sink, and safe when the sink
 * throws — analytics must never be able to break a contact click.
 */
export function track(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  try {
    window.shurTrack?.(event);
  } catch {
    /* A broken analytics provider is not allowed to break the page. */
  }
}
