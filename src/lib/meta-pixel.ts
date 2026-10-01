import type { AnalyticsEvent } from "./analytics";

/**
 * Meta Pixel 1133465872469034 — loads only after the visitor pressed
 * «allow advertising cookies». No choice, or «only necessary» → no script
 * tag, no `fbq`, no request to Meta.
 *
 * What it sends (event scheme from the targetologist, 01.10.2026):
 *   - `PageView` — see below;
 *   - `Lead` — once, on the thank-you page, after an ACCEPTED form, with
 *     `eventID` = the server's lead id (`trackMetaLead`, components/thanks);
 *   - `Contact` — a click on a contact channel, carrying the channel name
 *     and nothing else (`sendToPixel` via the analytics sink);
 *   - Meta's automatic button events (autoConfig, see `startMetaPixel`).
 *
 * PageView:
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
  /** Lead ids already sent from this page. */
  leads?: string[];
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
 * `contact_click → Contact` through the analytics sink — ON since the
 * targetologist's scheme of 01.10.2026. Lead does NOT ride this sink: it is
 * sent by the thank-you page (`trackMetaLead`), so `audit_submit` maps to
 * nothing here — otherwise one lead would be counted twice.
 */
export const CONVERSION_EVENTS_ENABLED = true;

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
 * Maps a site event to a pixel call. Only `contact_click` maps (→ Contact,
 * the channel name and nothing else); every other event — `audit_submit`
 * included, see CONVERSION_EVENTS_ENABLED — is ignored.
 */
export function sendToPixel(fbq: Fbq, event: AnalyticsEvent): void {
  if (event.name === "contact_click") {
    fbq("track", "Contact", { content_category: event.channel });
  }
}

/**
 * The one Lead of an accepted form, on the thank-you page. `eventID` is the
 * server's random lead id — the id the ledger gets, so a later Conversions
 * API event deduplicates; no custom data at all. Same consent as PageView:
 * no granted pixel → nothing. The caller guarantees «once» by taking the id
 * out of sessionStorage (lib/thanks); the same id is also never sent twice
 * from one page. Returns true when a Lead was queued.
 */
export function trackMetaLead(win: PixelWindow, leadId: string): boolean {
  const state = win.__shurPixel;
  if (!state?.granted || !win.fbq || !leadId || state.leads?.includes(leadId)) return false;
  state.leads = [...(state.leads ?? []), leadId];
  win.fbq("track", "Lead", {}, { eventID: leadId });
  return true;
}

/**
 * A page's arrival: count it if the pixel already runs, start the pixel if
 * advertising is allowed and it does not run yet. Shared by ConsentLayer and
 * the thank-you page, so whichever effect comes first, the result is one
 * start and one PageView (`lastPath` dedups the second caller).
 */
export function pixelArrive(win: PixelWindow, doc: PixelDocument, path: string, adsAllowed: () => boolean): void {
  if (win.__shurPixel) {
    trackMetaPageView(win, path);
    return;
  }
  if (adsAllowed()) {
    startMetaPixel({ pixelId: configuredPixelId(), adsAllowed: true, win, doc, path });
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
  // Meta's automatic events (autoConfig) stay at Meta's default — ON — by
  // the targetologist's scheme of 01.10.2026: SubscribedButtonClick goes out
  // with the text of the SITE's button pressed (our copy, not the visitor's
  // input). Switched off 30.09 before the scheme existed.
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
