import type { AnalyticsEvent } from "./analytics";

/**
 * Meta Pixel — written, and OFF. It loads only when BOTH hold:
 *   1. `NEXT_PUBLIC_META_PIXEL_ID` is set for the build (it is not, as of
 *      29.09.2026 — the owner has not named a pixel), and
 *   2. the visitor pressed «allow advertising cookies».
 * Either one missing → no script tag, no `fbq`, no request to Meta.
 *
 * It plugs into the one analytics sink the site already has
 * (`window.shurTrack`, lib/analytics), so no component calls Meta directly:
 *   contact_click             → Contact
 *   audit_submit (+ lead_id)  → Lead, eventID = lead_id — the SAME id the
 *                               server sends to the ledger, so a later
 *                               Conversions API event deduplicates against
 *                               this one instead of counting the lead twice.
 * Nothing personal is ever passed: no name, no contact, no handle — only the
 * channel name and the server's random lead id.
 */

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  push?: unknown;
  loaded?: boolean;
  version?: string;
};

export interface PixelWindow {
  fbq?: Fbq;
  _fbq?: Fbq;
  shurTrack?: (event: AnalyticsEvent) => void;
}

export interface PixelDocument {
  createElement(tag: "script"): { async: boolean; src: string };
  head: { appendChild(node: unknown): unknown };
}

export const META_PIXEL_SRC = "https://connect.facebook.net/en_US/fbevents.js";

/** A pixel id is digits. Anything else is a misconfiguration, not an id. */
export function normalizePixelId(raw: string | undefined): string | null {
  const id = raw?.trim() ?? "";
  return /^\d{5,20}$/.test(id) ? id : null;
}

/**
 * Must be read through the literal `process.env.NEXT_PUBLIC_…` expression:
 * that is what Next inlines into the client bundle at build time.
 */
export function configuredPixelId(): string | null {
  return normalizePixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);
}

/** Maps a site event to a pixel call. Unknown events are ignored. */
export function sendToPixel(fbq: Fbq, event: AnalyticsEvent): void {
  if (event.name === "contact_click") {
    fbq("track", "Contact", { content_category: event.channel });
  } else if (event.name === "audit_submit" && event.lead_id) {
    fbq("track", "Lead", {}, { eventID: event.lead_id });
  }
}

/**
 * The standard Meta bootstrap (a queueing `fbq` stub + the async script),
 * written out instead of pasted as a minified string so it can be read and
 * tested. Returns true when the pixel was started by THIS call.
 */
export function startMetaPixel(options: {
  pixelId: string | null;
  adsAllowed: boolean;
  win: PixelWindow;
  doc: PixelDocument;
}): boolean {
  const { pixelId, adsAllowed, win, doc } = options;
  if (!pixelId || !adsAllowed) return false;
  if (win.fbq) {
    // Already on the page (the visitor re-granted after a revoke).
    win.fbq("consent", "grant");
    return false;
  }

  const fbq: Fbq = (...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue!.push(args);
  };
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  win.fbq = fbq;
  win._fbq = fbq;

  const script = doc.createElement("script");
  script.async = true;
  script.src = META_PIXEL_SRC;
  doc.head.appendChild(script);

  fbq("consent", "grant");
  fbq("init", pixelId);
  fbq("track", "PageView");

  // Chain, never replace: another provider may already own the sink.
  const previous = win.shurTrack;
  win.shurTrack = (event) => {
    try {
      previous?.(event);
    } finally {
      if (win.fbq) sendToPixel(win.fbq, event);
    }
  };
  return true;
}

/** Withdrawn consent: the loaded pixel stops sending from this moment. */
export function revokeMetaPixel(win: PixelWindow): void {
  win.fbq?.("consent", "revoke");
}
