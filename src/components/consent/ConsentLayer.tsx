"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Dictionary } from "@/dictionaries";
import { rememberFirstTouch } from "@/lib/attribution";
import {
  CONSENT_EVENT,
  CONSENT_OPEN_EVENT,
  CONSENT_STORAGE_KEY,
  parseConsent,
  readConsent,
  saveConsent,
} from "@/lib/consent";
import { configuredPixelId, revokeMetaPixel, startMetaPixel } from "@/lib/meta-pixel";

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

interface ConsentLayerProps {
  dict: Dictionary["consent"];
}

/**
 * Everything the site does before a visitor touches anything, in one place:
 *   1. remembers the first-touch source for this tab (lib/attribution —
 *      sessionStorage, campaign names and the landing path);
 *   2. asks about advertising cookies, with two EQUAL buttons — saying no is
 *      exactly as easy as saying yes, and no answer means no;
 *   3. starts the Meta Pixel only after «allow» AND only when a pixel id was
 *      configured for the build (lib/meta-pixel). Neither holds by default.
 *
 * Direction comes from <html dir>, so the Hebrew banner lays out right to
 * left through the same logical utilities as the rest of the page.
 */
export function ConsentLayer({ dict }: ConsentLayerProps) {
  // The stored choice as an external store: null = not chosen yet, and on the
  // server (and in the first client render) «unknown», so the static HTML
  // never carries the banner and hydration never mismatches.
  const stored = useSyncExternalStore(subscribeConsent, readConsentRaw, () => SERVER);
  const [reopened, setReopened] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    rememberFirstTouch();
    const choice = readConsent();
    if (choice !== null) {
      startMetaPixel({ pixelId: configuredPixelId(), adsAllowed: choice.ads, win: window, doc: document });
    }
    const reopen = () => setReopened(true);
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  const choose = (ads: boolean) => {
    saveConsent(ads);
    if (ads) startMetaPixel({ pixelId: configuredPixelId(), adsAllowed: true, win: window, doc: document });
    else revokeMetaPixel(window);
    // `dismissed` also closes it when storage is blocked and nothing was saved.
    setDismissed(true);
    setReopened(false);
  };

  const undecided = stored !== SERVER && parseConsent(stored) === null && !dismissed;
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
