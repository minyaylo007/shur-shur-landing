import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "../src/proxy";
import { adsAllowed, CONSENT_STORAGE_KEY, effectiveAds, parseConsent } from "../src/lib/consent";
import {
  DEFAULT_META_PIXEL_ID,
  startMetaPixel,
  type PixelDocument,
  type PixelWindow,
} from "../src/lib/meta-pixel";
import { EU_ZONE_COUNTRIES, zoneForCountry, zoneFromCookie, type ConsentZone } from "../src/lib/zone";

describe("consent zone — who gets the banner (owner's decision, 30.09.2026)", () => {
  it("27 EU + IS, LI, NO + GB + CH are `eu`, 32 in all", () => {
    expect(EU_ZONE_COUNTRIES.size).toBe(32);
    for (const code of ["RO", "DE", "FR", "PL", "IE", "CY", "MT", "IS", "LI", "NO", "GB", "CH"]) {
      expect(zoneForCountry(code), code).toBe("eu");
    }
  });

  it("everything else is `other`: Ukraine, Israel, Moldova, the US…", () => {
    for (const code of ["UA", "IL", "MD", "US", "TR", "RS", "ua"]) {
      expect(zoneForCountry(code), code).toBe("other");
    }
  });

  it("no header, empty, not a country → `eu` (safe by default, locally too)", () => {
    for (const raw of [null, undefined, "", " ", "XX", "ZZ", "EU", "A1", "UKR", "u", "<script>"]) {
      expect(zoneForCountry(raw), String(raw)).toBe("eu");
    }
  });

  it("the client reads the cookie; none or garbled → `eu`", () => {
    expect(zoneFromCookie("shur_zone=other")).toBe("other");
    expect(zoneFromCookie("a=1; shur_zone=other; b=2")).toBe("other");
    expect(zoneFromCookie("shur_zone=eu")).toBe("eu");
    expect(zoneFromCookie("shur_zone=OTHER")).toBe("eu");
    expect(zoneFromCookie("xshur_zone=other")).toBe("eu");
    expect(zoneFromCookie("")).toBe("eu");
    expect(zoneFromCookie(undefined)).toBe("eu");
  });

  it("proxy: header → cookie; no header → `eu`; an unchanged cookie is not set again", () => {
    const zoneSet = (headers: Record<string, string>) =>
      proxy(new NextRequest("https://shur-shur.example/uk", { headers })).cookies.get("shur_zone")?.value;
    expect(zoneSet({ "x-vercel-ip-country": "UA" })).toBe("other");
    expect(zoneSet({ "x-vercel-ip-country": "RO" })).toBe("eu");
    expect(zoneSet({})).toBe("eu");
    expect(zoneSet({ "x-vercel-ip-country": "UA", cookie: "shur_zone=other" })).toBeUndefined();
    expect(zoneSet({ "x-vercel-ip-country": "RO", cookie: "shur_zone=other" })).toBe("eu");
  });
});

describe("consent zone → pixel: the visitor's own choice beats the zone", () => {
  const refused = parseConsent(JSON.stringify({ ads: false, at: "2026-09-30T20:00:00Z" }));
  const allowed = parseConsent(JSON.stringify({ ads: true, at: "2026-09-30T20:00:00Z" }));

  function pageViewsOnLoad(choice: typeof refused, zone: ConsentZone): number {
    const win: PixelWindow = {};
    const doc: PixelDocument = { createElement: () => ({ async: false, src: "" }), head: { appendChild: () => 0 } };
    startMetaPixel({ pixelId: DEFAULT_META_PIXEL_ID, adsAllowed: effectiveAds(choice, zone), win, doc, path: "/uk" });
    return win.fbq?.queue?.filter((c) => c[0] === "track" && c[1] === "PageView").length ?? 0;
  }

  it("`other`, no choice → exactly one PageView with no click", () => {
    expect(pageViewsOnLoad(null, "other")).toBe(1);
  });
  it("`other` + stored «only necessary» → 0", () => {
    expect(pageViewsOnLoad(refused, "other")).toBe(0);
  });
  it("`eu`, no choice → 0", () => {
    expect(pageViewsOnLoad(null, "eu")).toBe(0);
  });
  it("`eu` + «allow» → 1", () => {
    expect(pageViewsOnLoad(allowed, "eu")).toBe(1);
  });

  describe("adsAllowed() — what the lead's consent.ads and click ids follow", () => {
    afterEach(() => vi.unstubAllGlobals());
    const browser = (cookie: string, stored: string | null) => {
      vi.stubGlobal("document", { cookie });
      vi.stubGlobal("window", {
        localStorage: { getItem: (key: string) => (key === CONSENT_STORAGE_KEY ? stored : null) },
      });
    };

    it("`other` without refusal → true; with refusal → false", () => {
      browser("shur_zone=other", null);
      expect(adsAllowed()).toBe(true);
      browser("shur_zone=other", JSON.stringify({ ads: false, at: "x" }));
      expect(adsAllowed()).toBe(false);
    });
    it("`eu` or no cookie without a choice → false; «allow» → true", () => {
      browser("shur_zone=eu", null);
      expect(adsAllowed()).toBe(false);
      browser("", null);
      expect(adsAllowed()).toBe(false);
      browser("", JSON.stringify({ ads: true, at: "x" }));
      expect(adsAllowed()).toBe(true);
    });
  });
});
