"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Dictionary } from "@/dictionaries";
import { rememberFirstTouch } from "@/lib/attribution";
import {
  CONSENT_EVENT,
  CONSENT_OPEN_EVENT,
  CONSENT_STORAGE_KEY,
  adsAllowed,
  parseConsent,
  saveConsent,
} from "@/lib/consent";
import {
  configuredPixelId,
  revokeMetaPixel,
  startMetaPixel,
  trackMetaPageView,
  type PixelWindow,
} from "@/lib/meta-pixel";
import { readZone } from "@/lib/zone";

const SERVER = "\u0000server";

function readConsentRaw(): string | null {
  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribeConsent(onChange: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab chose
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// The zone cookie is set by the proxy before the page arrives and does not
// change while it is open: nothing to subscribe to.
const subscribeNothing = () => () => {};

interface ConsentLayerProps {
  dict: Dictionary["consent"];
}

/**
 * Everything the site does before a visitor touches anything, in one place:
 *   1. remembers the first-touch source for this tab (lib/attribution —
 *      sessionStorage, campaign names and the landing path);
 *   2. in the `eu` zone (lib/zone) asks about advertising cookies, with two
 *      EQUAL buttons — saying no is exactly as easy as saying yes, and no
 *      answer means no. Outside it the banner does not come up by itself,
 *      advertising is on until refused, and the footer's «cookie settings»
 *      brings the same banner back to refuse;
 *   3. starts the Meta Pixel only when advertising is allowed — «allow» in
 *      the `eu` zone, no refusal elsewhere (lib/meta-pixel) — and counts
 *      a PageView per client-side path change — `usePathname()` has no
 *      search and no hash, so `#anchor` jumps never count.
 *
 * Direction comes from <html dir>, so the Hebrew banner lays out right to
 * left through the same logical utilities as the rest of the page.
 */
export function ConsentLayer({ dict }: ConsentLayerProps) {
  // The stored choice as an external store: null = not chosen yet, and on the
  // server (and in the first client render) «unknown», so the static HTML
  // never carries the banner and hydration never mismatches.
  const stored = useSyncExternalStore(subscribeConsent, readConsentRaw, () => SERVER);
  const zone = useSyncExternalStore(subscribeNothing, readZone, () => null);
  const [reopened, setReopened] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    rememberFirstTouch();
    const reopen = () => setReopened(true);
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  // The first load with advertising allowed — a stored «allow», or the
  // `other` zone with no refusal — starts the pixel (one PageView);
  // every later client-side path change — the language switcher's
  // router.push — is one more. Same path again (StrictMode, a remount of the
  // [locale] layout) counts nothing: lib/meta-pixel remembers the last path.
  useEffect(() => {
    const win = window as PixelWindow;
    if (win.__shurPixel) {
      trackMetaPageView(win, pathname);
      return;
    }
    if (adsAllowed()) {
      startMetaPixel({ pixelId: configuredPixelId(), adsAllowed: true, win, doc: document, path: pathname });
    }
  }, [pathname]);

  const choose = (ads: boolean) => {
    saveConsent(ads);
    if (ads) {
      startMetaPixel({ pixelId: configuredPixelId(), adsAllowed: true, win: window, doc: document, path: pathname });
    } else {
      revokeMetaPixel(window);
    }
    // `dismissed` also closes it when storage is blocked and nothing was saved.
    setDismissed(true);
    setReopened(false);
  };

  const undecided = stored !== SERVER && zone === "eu" && parseConsent(stored) === null && !dismissed;
  if (!reopened && !undecided) return null;

  const buttonClass =
    "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border-2 border-paper-50 px-5 py-2 font-display text-xs font-bold tracking-wide uppercase transition-colors duration-200";

  return (
    <section
      role="region"
      aria-label={dict.label}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-md bg-cherry-black p-4 text-paper-100 shadow-[4px_4px_0_rgb(28_26_25)] sm:p-5"
    >
      <p className="text-sm text-paper-100">{dict.text}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => choose(false)}
          className={`${buttonClass} text-paper-50 hover:bg-paper-50 hover:text-cherry-900`}
        >
          {dict.necessary}
        </button>
        <button
          type="button"
          onClick={() => choose(true)}
          className={`${buttonClass} text-paper-50 hover:bg-paper-50 hover:text-cherry-900`}
        >
          {dict.allowAds}
        </button>
      </div>
    </section>
  );
}

/** Footer link that brings the banner back — withdrawing must stay one click. */
export function ConsentSettingsButton({ label, className }: { label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}
      className={className}
    >
      {label}
    </button>
  );
}
