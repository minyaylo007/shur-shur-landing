import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AD_VISIT_STORAGE_KEY,
  isMetaAdUrl,
  resolveAdVisit,
  type FlagStorage,
} from "../src/lib/ad-visit";
import { ATTRIBUTION_FIELDS, captureAttribution } from "../src/lib/attribution";
import { site } from "../src/lib/site";
import { AdHeroActions, AdHeroActionsView } from "../src/components/conversion/AdHeroActions";
import { ContactLink } from "../src/components/conversion/ContactLink";
import type { AnalyticsEvent } from "../src/lib/analytics";

/*
 * Direct for Meta-ad visitors (27.10.2026). Critical because it changes the
 * first screen's conversion path and touches what is stored on the device:
 * nobody else's hero may change, the ad hero must open the real ig.me DM,
 * and the flag must stay a bare boolean in sessionStorage — never in a URL,
 * never in an analytics event, never next to the click id.
 */

class MemoryStorage implements FlagStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const HOME = "https://shur-shur.com/uk/";
const DEFAULT = createElement("a", { href: "https://wa.me/380972499107" }, "Обговорити проєкт");
const props = { locale: "uk" as const, directLabel: "Написати в Direct", formLabel: "Обговорити проєкт" };

describe("which visits count as «from a Meta ad»", () => {
  it.each([
    "?utm_source=facebook",
    "?utm_source=Instagram&utm_medium=paid",
    "?utm_source=meta",
    "?utm_source=ig",
    "?utm_source=fb_ads",
    "?fbclid=IwAR0abc",
  ])("%s → yes", (query) => {
    expect(isMetaAdUrl(HOME + query)).toBe(true);
  });

  it.each(["", "?utm_source=google", "?utm_source=digital", "?utm_source=newsletter", "?fbclid="])(
    "%s → no",
    (query) => {
      expect(isMetaAdUrl(HOME + query)).toBe(false);
    },
  );
});

describe("the flag — one boolean per tab, no personal data", () => {
  it("a plain visit stores nothing and keeps the usual hero", () => {
    const storage = new MemoryStorage();
    expect(resolveAdVisit(HOME, storage)).toBe(false);
    expect(storage.data.size).toBe(0);
  });

  it("an ad visit stores exactly «1» — not the fbclid, not the utm", () => {
    const storage = new MemoryStorage();
    expect(resolveAdVisit(`${HOME}?utm_source=facebook&fbclid=IwAR0secret`, storage)).toBe(true);
    expect([...storage.data.entries()]).toEqual([[AD_VISIT_STORAGE_KEY, "1"]]);
  });

  it("holds for the session: the next page without utm still counts", () => {
    const storage = new MemoryStorage();
    resolveAdVisit(`${HOME}?fbclid=x`, storage);
    expect(resolveAdVisit("https://shur-shur.com/en/", storage)).toBe(true);
  });

  it("blocked storage decides by the URL and does not throw", () => {
    const blocked: FlagStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(resolveAdVisit(`${HOME}?utm_source=ig`, blocked)).toBe(true);
    expect(resolveAdVisit(HOME, blocked)).toBe(false);
  });

  it("never rewrites the URL and never joins the lead's attribution", () => {
    const src = readFileSync(fileURLToPath(new URL("../src/lib/ad-visit.ts", import.meta.url)), "utf8");
    expect(src).not.toMatch(/history\.|location\.(assign|replace|search\s*=|href\s*=)/);
    expect(ATTRIBUTION_FIELDS as readonly string[]).not.toContain(AD_VISIT_STORAGE_KEY);
    const record = captureAttribution(`${HOME}?utm_source=facebook&fbclid=abc`, "", 0);
    expect(JSON.stringify(record)).not.toContain("metaAd");
  });
});

describe("the hero buttons", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("without the flag the first screen is unchanged — byte for byte", () => {
    const usual = renderToStaticMarkup(DEFAULT);
    expect(renderToStaticMarkup(createElement(AdHeroActionsView, { ...props, fromAd: false }, DEFAULT))).toBe(usual);
    // The prerendered page (server snapshot) is always the usual hero too.
    expect(renderToStaticMarkup(createElement(AdHeroActions, props, DEFAULT))).toBe(usual);
  });

  it("with the flag the main button opens the Instagram DM (ig.me), the form is second", () => {
    const html = renderToStaticMarkup(createElement(AdHeroActionsView, { ...props, fromAd: true }, DEFAULT));
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs[0]).toBe(site.socials.instagramDm);
    expect(hrefs[0]).toMatch(/^https:\/\/ig\.me\/m\//);
    expect(hrefs[1]).toBe("#contact");
    expect(html.indexOf("Написати в Direct")).toBeLessThan(html.indexOf("Обговорити проєкт"));
    expect(html).not.toContain("wa.me");
  });

  it("the Direct click is the existing contact_click — and carries no flag, no utm, no click id", () => {
    const events: AnalyticsEvent[] = [];
    vi.stubGlobal("window", { shurTrack: (e: AnalyticsEvent) => events.push(e) });
    const view = AdHeroActionsView({ ...props, fromAd: true }) as ReactElement<{
      children: ReactElement[];
    }>;
    const link = view.props.children.find((c) => isValidElement(c) && c.type === ContactLink)!;
    const anchor = ContactLink(link.props as Parameters<typeof ContactLink>[0]) as ReactElement<{
      onClick: (e: unknown) => void;
    }>;
    anchor.props.onClick({});
    expect(events).toEqual([{ name: "contact_click", channel: "instagram", locale: "uk", placement: "hero" }]);
  });
});
