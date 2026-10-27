/**
 * «This visitor came from a Meta ad» — one boolean for the tab (27.10.2026).
 *
 * Why: the «Ліди чернівці» ads say «Напишіть нам у Direct» and land on the
 * site; 273 visits, zero leads (shur-ads analysis 2026-10-27, hypothesis 1).
 * Campaigns that led straight into a conversation get one for ~8 $. So a
 * visitor who arrived from such an ad gets Direct as the hero's main button.
 *
 * What is kept: the string "1" under one sessionStorage key — no utm value,
 * no fbclid, nothing about the person. It dies with the tab, never leaves the
 * device, and is never written back into the URL or into an analytics event.
 * The click ids themselves stay where they were (lib/attribution, gated by
 * consent); this module only reads the URL to decide.
 */

export const AD_VISIT_STORAGE_KEY = "shur.metaAd";

/** utm_source values Meta's ads arrive with; matched case-insensitively. */
const LONG_MARKS = ["facebook", "instagram", "meta"];
/** Two-letter marks match as a whole token only: «ig_feed», not «digital». */
const SHORT_MARKS = ["ig", "fb"];

export function isMetaAdSource(utmSource: string | null | undefined): boolean {
  const value = utmSource?.trim().toLowerCase();
  if (!value) return false;
  if (LONG_MARKS.some((mark) => value.includes(mark))) return true;
  return value.split(/[^a-z0-9]+/).some((token) => SHORT_MARKS.includes(token));
}

/** Pure: does this URL look like a click on a Meta ad? */
export function isMetaAdUrl(href: string): boolean {
  try {
    const params = new URL(href).searchParams;
    if (params.get("fbclid")) return true;
    return isMetaAdSource(params.get("utm_source"));
  } catch {
    return false;
  }
}

export interface FlagStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * The flag for this tab: already set, or set now from the current URL. Only
 * ever goes false → true, so a later page in the same tab without utm keeps
 * the Direct button. Storage blocked → decided by the URL alone.
 */
export function resolveAdVisit(href: string, storage: FlagStorage | null): boolean {
  try {
    if (storage?.getItem(AD_VISIT_STORAGE_KEY) === "1") return true;
  } catch {
    /* blocked storage reads as «not set» */
  }
  if (!isMetaAdUrl(href)) return false;
  try {
    storage?.setItem(AD_VISIT_STORAGE_KEY, "1");
  } catch {
    /* blocked storage: the button still switches for this page */
  }
  return true;
}

/** Browser snapshot for useSyncExternalStore; `false` on the server. */
export function readAdVisit(): boolean {
  if (typeof window === "undefined") return false;
  let storage: FlagStorage | null = null;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = null;
  }
  return resolveAdVisit(window.location.href, storage);
}
