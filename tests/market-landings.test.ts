import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { marketOf } from "../src/lib/attribution";
import { getDirection } from "../src/lib/i18n";
import {
  landingIndexable,
  landingList,
  landingMetadata,
  landingPath,
  marketLandings,
  workByIds,
} from "../src/lib/markets";
import { workItems } from "../src/lib/work";
import { suceavaRo } from "../src/content/landings/suceava.ro";
import { telAvivHe } from "../src/content/landings/tel-aviv.he";
import sitemap from "../src/app/sitemap";

/* Market landings (task 29.09.2026, ads contract v2): /ro/suceava and
   /he/tel-aviv. Critical because the market of a lead is decided by the
   landing path — a renamed route would silently file every Suceava lead
   under «other» — and because a draft that gets indexed puts unreviewed
   Romanian/Hebrew copy in front of real people. */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const copies = [
  ["suceava", suceavaRo, "../src/content/landings/suceava.ro.ts"],
  ["tel_aviv", telAvivHe, "../src/content/landings/tel-aviv.he.ts"],
] as const;

const PAGE_FILES = [
  "../src/components/landing/MarketLandingPage.tsx",
  "../src/app/[locale]/suceava/page.tsx",
  "../src/app/[locale]/tel-aviv/page.tsx",
  "../src/app/[locale]/privacy/page.tsx",
];

describe("market by path", () => {
  it.each(landingList)("$slug is filed under its own market", (landing) => {
    expect(marketOf({ landing_path: landingPath(landing) })).toBe(landing.market);
    // A visitor who clicks around inside the landing keeps the market.
    expect(marketOf({ landing_path: `${landingPath(landing)}/` })).toBe(landing.market);
  });

  it("the routes are exactly where marketOf looks", () => {
    expect(landingPath(marketLandings.suceava)).toBe("/ro/suceava");
    expect(landingPath(marketLandings.tel_aviv)).toBe("/he/tel-aviv");
  });

  it("the home page and other locales are not a market", () => {
    expect(marketOf({ landing_path: "/ro" })).toBe("other");
    expect(marketOf({ landing_path: "/uk/suceava" })).toBe("other");
  });

  it("each route renders only in its own locale", () => {
    for (const [file, locale] of [
      ["../src/app/[locale]/suceava/page.tsx", "suceava"],
      ["../src/app/[locale]/tel-aviv/page.tsx", "tel_aviv"],
    ] as const) {
      const src = read(file);
      expect(src).toContain(`marketLandings.${locale}`);
      expect(src).toMatch(/locale !== landing\.locale\) notFound\(\)/);
    }
  });

  it("a lead is sent from the page itself when storage is empty", () => {
    const src = read("../src/lib/attribution.ts");
    expect(src).toMatch(/readStoredAttribution\(\) \?\? safeCapture\(\)/);
  });
});

describe("drafts are invisible until approved", () => {
  it("no landing is approved yet — texts wait for native speakers", () => {
    for (const landing of landingList) expect(landing.approved).toBe(false);
  });

  it.each(copies)("%s: metadata says noindex, nofollow", (market, copy) => {
    const meta = landingMetadata(marketLandings[market], copy.meta);
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.alternates?.canonical).toBe(landingPath(marketLandings[market]));
  });

  it("an unapproved landing is never in the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const landing of landingList) {
      const inMap = urls.some((url) => url.endsWith(landingPath(landing)));
      expect(inMap).toBe(landingIndexable(landing));
    }
  });

  it("no menu, header or footer of the site links to a landing", () => {
    for (const file of [
      "../src/components/layout/Header.tsx",
      "../src/components/layout/Footer.tsx",
      "../src/app/[locale]/page.tsx",
    ]) {
      const src = read(file);
      expect(src).not.toMatch(/suceava|tel-aviv|marketLandings|landingPath/);
    }
  });
});

describe("honesty: only what is true", () => {
  it.each(copies)("%s: every case is a real item of lib/work", (_market, copy) => {
    const ids = new Set(workItems.map((item) => item.id));
    for (const segment of copy.segments) {
      for (const id of segment.work) expect(ids.has(id)).toBe(true);
      expect(() => workByIds(segment.work)).not.toThrow();
    }
  });

  it("the local phone and the price are config, and switched off", () => {
    for (const landing of landingList) {
      expect(landing.localPhone).toBeNull();
      expect(landing.price).toBeNull();
    }
  });

  it.each(copies)("%s: no local number, price, office or client quotes in the copy", (_m, copy) => {
    const text = JSON.stringify({ ...copy, whenConfigured: undefined });
    expect(text).not.toMatch(/\+40|\+972|\bRON\b|\blei\b|₪|ש"ח|NIS|\bILS\b/i);
    expect(text).not.toMatch(/\d{2,}\s?%/);
  });

  it("phone and price render only from config, never from the copy", () => {
    const src = read("../src/components/landing/MarketLandingPage.tsx");
    expect(src).toContain("{localPhone ? (");
    expect(src).toContain("{price ? (");
    expect(src).not.toContain("site.phone");
  });
});

describe("direction and phone width", () => {
  it("Tel Aviv is a Hebrew, right-to-left page; Suceava is left-to-right", () => {
    expect(marketLandings.tel_aviv.locale).toBe("he");
    expect(getDirection(marketLandings.tel_aviv.locale)).toBe("rtl");
    expect(getDirection(marketLandings.suceava.locale)).toBe("ltr");
  });

  it.each(PAGE_FILES)("%s uses logical sides only (RTL-safe)", (file) => {
    const src = read(file);
    expect(src).not.toMatch(/\b-?(ml|mr|pl|pr|left|right)-(\d|\[|auto|px|full)/);
    expect(src).not.toMatch(/\btext-(left|right)\b/);
    expect(src).not.toMatch(/\brounded-[lr]-/);
  });

  /* No browser in the suite, so the 390 px rule is checked at its causes:
     nothing may be wider than a phone, and every heading may wrap. */
  it.each(PAGE_FILES)("%s has nothing wider than 390 px", (file) => {
    const src = read(file);
    for (const match of src.matchAll(/\b(?:min-)?w-\[(\d+)px\]/g)) {
      expect(Number(match[1])).toBeLessThanOrEqual(390 - 32);
    }
    expect(src).not.toMatch(/whitespace-nowrap|\btruncate\b/);
    for (const heading of src.matchAll(/<h[12][^>]*className="([^"]*)"/g)) {
      expect(heading[1]).toContain("break-words");
    }
  });
});

describe("every Romanian and Hebrew line waits for a native speaker", () => {
  const MARK = "ждёт проверки носителем";
  const files = [
    ...readdirSync(fileURLToPath(new URL("../src/content/landings", import.meta.url)))
      .filter((name) => /\.(ro|he)\.ts$/.test(name))
      .map((name) => `../src/content/landings/${name}`),
    "../src/content/privacy/ro.ts",
    "../src/content/privacy/he.ts",
  ];

  it("covers both landings and both policies", () => {
    expect(files).toHaveLength(4);
  });

  it.each(files)("%s: each visible string carries the mark", (file) => {
    const lines = read(file).split("\n");
    const unmarked = lines.filter(
      (line) =>
        /["`]/.test(line) &&
        /\p{L}{2,}/u.test(line.replace(/\/\/.*$/, "").replace(/^\s*\w+:/, "")) &&
        !/^\s*(import|export|key:|work:|\*|\/\/)/.test(line) &&
        !line.includes(MARK),
    );
    expect(unmarked).toEqual([]);
  });

  it("the new dictionary lines in ro and he are marked", () => {
    for (const file of ["../src/dictionaries/ro.ts", "../src/dictionaries/he.ts"]) {
      const lines = read(file)
        .split("\n")
        .filter((line) => /^\s*(privacyNote|privacyLink|privacy):/.test(line));
      expect(lines).toHaveLength(3);
      for (const line of lines) expect(line).toContain(MARK);
    }
  });
});
