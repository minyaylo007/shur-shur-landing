import type { AnalyticsEvent } from "./analytics";

/**
 * Meta Pixel 1133465872469034 — loads only after the visitor pressed
 * «allow advertising cookies». No choice, or «only necessary» → no script
 * tag, no `fbq`, no request to Meta.
 *
 * What it sends, as of 30.09.2026: `PageView` and nothing else.
 *   - once on the first load (after consent);
 *   - once per client-side path change (the language switcher's
 *     `router.push`) — ConsentLayer feeds `usePathname()` to
 *     `trackMetaPageView`;
 *   - never for `#anchor` jumps, a re-render, React StrictMode's double
 *     effect, or a second «allow»: the last counted path is remembered and
 *     the same path is never counted twice.
 * Meta's own History listener is switched off (`disablePushState`): it fires
 * on every `href` change — `#…` included, since it compares the full href —
 * and on `replaceState`, which Next calls on its own. One source of
 * PageViews, ours. See the SPA note:
 * https://developers.facebook.com/ads/blog/post/2017/05/29/tagging-a-single-page-application-facebook-pixel/
 *
 * No <noscript> image pixel, deliberately: without JavaScript the consent
 * banner cannot be answered, so a noscript <img> would fire for exactly the
 * visitors who never said yes — it would walk around the refusal.
 */

/** The owner's pixel (30.09.2026). Not a secret: it is visible in every page's traffic. */
export const DEFAULT_META_PIXEL_ID = "1133465872469034";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  push?: unknown;
  loaded?: boolean;
  version?: string;
  disablePushState?: boolean;
  allowDuplicatePageViews?: boolean;
};

/** What this page has told Meta so far. Lives on window, not in the module:
 *  it must survive a remount of ConsentLayer (a new [locale] layout). */
export interface PixelState {
  granted: boolean;
  lastPath: string | null;
}

export interface PixelWindow {
  fbq?: Fbq;
  _fbq?: Fbq;
  shurTrack?: (event: AnalyticsEvent) => void;
  __shurPixel?: PixelState;
}

export interface PixelDocument {
  createElement(tag: "script"): { async: boolean; src: string };
  head: { appendChild(node: unknown): unknown };
}

export const META_PIXEL_SRC = "https://connect.facebook.net/en_US/fbevents.js";

/**
 * `contact_click → Contact` and `audit_submit → Lead` — written and OFF.
 * The event scheme (which action is a Lead, which is a Contact, value and
 * dedup with the server-side Conversions API) is not agreed with the
 * targetologist yet; an unagreed Lead would train the ad optimiser on the
 * wrong signal. Flip only after that agreement.
 */
export const CONVERSION_EVENTS_ENABLED = false;

/** A pixel id is digits. Anything else is a misconfiguration, not an id. */
export function normalizePixelId(raw: string | undefined): string | null {
  const id = raw?.trim() ?? "";
  return /^\d{5,20}$/.test(id) ? id : null;
}

/**
 * `NEXT_PUBLIC_META_PIXEL_ID` overrides the default. It must be read through
 * the literal `process.env.NEXT_PUBLIC_…` expression: that is what Next
 * inlines into the client bundle at build time.
 */
export function configuredPixelId(): string | null {
  return normalizePixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID || DEFAULT_META_PIXEL_ID);
}

/**
 * Maps a site event to a pixel call. Unknown events are ignored. Only
 * reachable when CONVERSION_EVENTS_ENABLED. Nothing personal is ever passed —
 * only the channel name and the server's random lead id (eventID = the id
 * the ledger gets, so a later Conversions API event deduplicates).
 */
export function sendToPixel(fbq: Fbq, event: AnalyticsEvent): void {
  if (event.name === "contact_click") {
    fbq("track", "Contact", { content_category: event.channel });
  } else if (event.name === "audit_submit" && event.lead_id) {
    fbq("track", "Lead", {}, { eventID: event.lead_id });
  }
}

/**
 * One PageView for `path`, unless consent is not (or no longer) granted or
 * this path was already counted. No URL parameters are passed — the event
 * carries no custom data at all. Returns true when a PageView was queued.
 */
export function trackMetaPageView(win: PixelWindow, path: string): boolean {
  const state = win.__shurPixel;
  if (!state?.granted || !win.fbq || state.lastPath === path) return false;
  state.lastPath = path;
  win.fbq("track", "PageView");
  return true;
}

/**
 * The standard Meta bootstrap (a queueing `fbq` stub + the async script),
 * written out instead of pasted as a minified string so it can be read and
 * tested. Returns true when the pixel was started by THIS call; a repeated
 * call (StrictMode, remount, second «allow») only re-grants and counts
 * `path` if it is new.
 */
export function startMetaPixel(options: {
  pixelId: string | null;
  adsAllowed: boolean;
  win: PixelWindow;
  doc: PixelDocument;
  path: string;
}): boolean {
  const { pixelId, adsAllowed, win, doc, path } = options;
  if (!pixelId || !adsAllowed) return false;

  const existing = win.__shurPixel;
  if (existing && win.fbq) {
    if (!existing.granted) {
      win.fbq("consent", "grant");
      existing.granted = true;
    }
    trackMetaPageView(win, path);
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
  // Ours is the only PageView source (see the header): no automatic History
  // PageViews, and our explicit repeats are not swallowed as duplicates —
  // the dedup is `lastPath`.
  fbq.disablePushState = true;
  fbq.allowDuplicatePageViews = true;
  win.fbq = fbq;
  win._fbq = fbq;
  win.__shurPixel = { granted: true, lastPath: null };

  const script = doc.createElement("script");
  script.async = true;
  script.src = META_PIXEL_SRC;
  doc.head.appendChild(script);

  fbq("consent", "grant");
  // Meta's automatic events off, before `init` as Meta requires: without this
  // the pixel sends SubscribedButtonClick on every button press, with the
  // button's text — events nobody agreed to (seen in the live check, 30.09).
  fbq("set", "autoConfig", false, pixelId);
  fbq("init", pixelId);
  trackMetaPageView(win, path);

  if (CONVERSION_EVENTS_ENABLED) {
    // Chain, never replace: another provider may already own the sink.
    const previous = win.shurTrack;
    win.shurTrack = (event) => {
      try {
        previous?.(event);
      } finally {
        if (win.fbq && win.__shurPixel?.granted) sendToPixel(win.fbq, event);
      }
    };
  }
  return true;
}

/** Withdrawn consent: the loaded pixel stops sending from this moment. */
export function revokeMetaPixel(win: PixelWindow): void {
  if (!win.fbq) return;
  win.fbq("consent", "revoke");
  if (win.__shurPixel) win.__shurPixel.granted = false;
}
