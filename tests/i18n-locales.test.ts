import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  locales,
  defaultLocale,
  isLocale,
  getDirection,
  ogLocales,
  localeSegmentPattern,
} from "../src/lib/i18n";
import { getDictionary } from "../src/dictionaries";
import sitemap from "../src/app/sitemap";
import { site } from "../src/lib/site";
import { posts } from "../src/lib/posts";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const CYRILLIC = /[Ѐ-ӿ]/;
const HEBREW = /[֐-׿]/;

/** Collects every string in a dictionary as `path` → `value` pairs. */
function flatten(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => flatten(item, `${path}[${i}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      flatten(child, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

/* Strings that are the SAME in every locale by design:
   — the wall of love quotes are verbatim client comments (§9 honesty: we
     translate the attribution, never the quote itself);
   — the «Укр» pill names the Ukrainian language in Ukrainian. */
const isVerbatim = (path: string) =>
  /^socials\.wallOfLove\.quotes\[\d+\]\.text$/.test(path) || path === "langSwitcher.uk";

/* ============================================================
   i18n core — 4 locales, one source of truth (lib/i18n)
   ============================================================ */

describe("i18n — locale list", () => {
  it("ships uk, en, he and ro with uk as the default", () => {
    expect([...locales]).toEqual(["uk", "en", "he", "ro"]);
    expect(defaultLocale).toBe("uk");
    expect(locales).toContain(defaultLocale);
  });

  it("isLocale is a type guard over that list, nothing else", () => {
    for (const locale of locales) expect(isLocale(locale)).toBe(true);
    for (const bad of ["fr", "UK", "he-IL", "", "help"]) {
      expect(isLocale(bad)).toBe(false);
    }
  });
});

describe("i18n — writing direction", () => {
  it("Hebrew reads right-to-left, every other locale left-to-right", () => {
    expect(getDirection("he")).toBe("rtl");
    for (const locale of locales.filter((l) => l !== "he")) {
      expect(getDirection(locale)).toBe("ltr");
    }
  });

  it("every locale has a direction (no undefined leaking into the dir attribute)", () => {
    for (const locale of locales) {
      expect(["ltr", "rtl"]).toContain(getDirection(locale));
    }
  });
});

describe("i18n — Open Graph locale codes", () => {
  it("maps every locale to a language_TERRITORY code", () => {
    for (const locale of locales) {
      expect(ogLocales[locale]).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
      expect(ogLocales[locale].startsWith(locale)).toBe(true);
    }
    expect(ogLocales.he).toBe("he_IL");
    expect(ogLocales.ro).toBe("ro_RO");
  });
});

describe("i18n — locale segment pattern (language switcher)", () => {
  it("strips exactly the leading locale segment", () => {
    expect("/he".replace(localeSegmentPattern, "")).toBe("");
    expect("/he/cases".replace(localeSegmentPattern, "")).toBe("/cases");
    expect("/ro/a/b".replace(localeSegmentPattern, "")).toBe("/a/b");
  });

  it("never eats a path that merely starts with a locale's letters", () => {
    expect("/help".replace(localeSegmentPattern, "")).toBe("/help");
    expect("/roadmap".replace(localeSegmentPattern, "")).toBe("/roadmap");
    expect("/english".replace(localeSegmentPattern, "")).toBe("/english");
  });
});

/* ============================================================
   Dictionaries — one per locale, fully translated
   ============================================================ */

describe("dictionaries — one per locale", () => {
  it("every locale resolves to its own dictionary object", () => {
    const dicts = locales.map((locale) => getDictionary(locale));
    expect(new Set(dicts).size).toBe(locales.length);
    for (const dict of dicts) expect(dict.nav.cases.length).toBeGreaterThan(1);
  });

  it("no locale shares a heading with another (no copy-paste stubs)", () => {
    const headings = locales.map((locale) => getDictionary(locale).pain.heading);
    expect(new Set(headings).size).toBe(locales.length);
  });

  it("no empty or whitespace-only string anywhere (bar unit-less figures)", () => {
    // numbers.items[].suffix is legitimately empty for a bare figure («215»).
    const mayBeEmpty = /^numbers\.items\[\d+\]\.suffix$/;
    for (const locale of locales) {
      for (const [path, value] of flatten(getDictionary(locale))) {
        if (mayBeEmpty.test(path)) continue;
        expect(value.trim(), `${locale}.${path}`).not.toBe("");
      }
    }
  });

  it("langSwitcher names all four languages in all four dictionaries", () => {
    for (const locale of locales) {
      const sw = getDictionary(locale).langSwitcher;
      expect(sw.label.length).toBeGreaterThan(3);
      for (const code of locales) {
        expect(sw[code].length, `${locale}.langSwitcher.${code}`).toBeGreaterThan(1);
      }
      // Each language is named in its OWN script, in every locale.
      expect(sw.uk).toMatch(CYRILLIC);
      expect(sw.he).toMatch(HEBREW);
      expect(sw.ro).toMatch(/^[A-Za-z]+$/);
    }
  });
});

describe("dictionaries — no untranslated leftovers", () => {
  it("he: no Cyrillic outside the verbatim client quotes", () => {
    for (const [path, value] of flatten(getDictionary("he"))) {
      if (isVerbatim(path)) continue;
      expect(value, `he.${path}`).not.toMatch(CYRILLIC);
    }
  });

  it("ro: no Cyrillic outside the verbatim client quotes", () => {
    for (const [path, value] of flatten(getDictionary("ro"))) {
      if (isVerbatim(path)) continue;
      expect(value, `ro.${path}`).not.toMatch(CYRILLIC);
    }
  });

  it("he: the visible copy is really Hebrew, not Latin left in place", () => {
    const he = getDictionary("he");
    for (const value of [
      he.meta.title,
      he.meta.description,
      he.nav.cases,
      he.hero.cta,
      he.hero.audit.submit,
      he.contact.form.submit,
      he.contact.form.errors.name,
      he.contact.form.successTitle,
      he.footer.rights,
      he.fab.label,
      he.stickyCta.cta,
    ]) {
      expect(value).toMatch(HEBREW);
    }
  });

  it("post alt texts exist for every locale (a11y, SEO)", () => {
    for (const post of posts) {
      for (const locale of locales) {
        expect(post.alt[locale].length, `${post.image} / ${locale}`).toBeGreaterThan(10);
      }
    }
  });
});

/* ============================================================
   Routing — four static routes, four sitemap entries
   ============================================================ */

describe("routing — all four locales are prerendered", () => {
  it("layout derives generateStaticParams from the locale list", () => {
    const src = read("../src/app/[locale]/layout.tsx");
    expect(src).toMatch(/generateStaticParams\(\)\s*\{[\s\S]*?locales\.map/);
    expect(src).toContain("export const dynamicParams = false");
  });

  it("layout stamps lang and dir on <html> from the locale", () => {
    const src = read("../src/app/[locale]/layout.tsx");
    expect(src).toContain("lang={locale}");
    expect(src).toContain("dir={getDirection(locale)}");
  });

  it("sitemap lists every locale with a full hreflang map", () => {
    const entries = sitemap();
    expect(entries.map((entry) => entry.url)).toEqual(
      locales.map((locale) => `${site.siteUrl}/${locale}`),
    );
    for (const entry of entries) {
      const languages = entry.alternates?.languages ?? {};
      expect(Object.keys(languages).sort()).toEqual([...locales].sort());
      for (const locale of locales) {
        expect(languages[locale]).toBe(`${site.siteUrl}/${locale}`);
      }
    }
  });

  it("sitemap keeps the default locale at the top priority (/ redirects there)", () => {
    for (const entry of sitemap()) {
      const isDefault = entry.url.endsWith(`/${defaultLocale}`);
      expect(entry.priority).toBe(isDefault ? 1 : 0.9);
    }
  });
});

/* ============================================================
   RTL plumbing — Hebrew fonts, logical utilities, mirrored motion
   ============================================================ */

describe("RTL — Hebrew typography", () => {
  const src = () => read("../src/app/[locale]/layout.tsx");

  it("loads a Hebrew-capable pair through the SAME css variables", () => {
    const layout = src();
    expect(layout).toMatch(/Rubik\(\{[\s\S]*?subsets: \["latin", "hebrew"\][\s\S]*?--font-unbounded/);
    expect(layout).toMatch(/Assistant\(\{[\s\S]*?subsets: \["latin", "hebrew"\][\s\S]*?--font-manrope/);
  });

  it("only `he` gets that pair — uk/en/ro keep Unbounded + Manrope", () => {
    const fonts = src().match(/function fontClasses[\s\S]*?\n\}/)?.[0] ?? "";
    expect(fonts).toMatch(/locale === "he"/);
    expect(fonts).toContain("rubik.variable");
    expect(fonts).toContain("unbounded.variable");
  });

  it("keeps the Cyrillic subset on the Latin pair (uk must not fall back)", () => {
    const layout = src();
    expect(layout).toMatch(/Unbounded\(\{[\s\S]*?subsets: \["latin", "cyrillic"\]/);
    expect(layout).toMatch(/Manrope\(\{[\s\S]*?subsets: \["latin", "cyrillic"\]/);
  });
});

describe("RTL — flipped choreography", () => {
  it("globals.css: neutral display tracking + a mirrored marquee under dir=rtl", () => {
    const css = read("../src/app/globals.css");
    expect(css).toMatch(/--display-tracking:\s*-0\.02em/);
    expect(css).toMatch(/\[dir="rtl"\]\s*\{\s*--display-tracking:\s*0em/);
    expect(css).toContain("@keyframes marquee-rtl");
    expect(css).toMatch(/\[dir="rtl"\] \.marquee-track\s*\{\s*animation-name: marquee-rtl/);
  });

  it("Services: the pinned horizontal scrub runs the other way under rtl", () => {
    const src = read("../src/components/sections/Services.tsx");
    expect(src).toMatch(/document\.documentElement\.dir === "rtl"/);
    expect(src).toMatch(/rtl \? getDistance\(\) : -getDistance\(\)/);
  });

  it("the up-right arrow glyph mirrors itself once, at its definition", () => {
    expect(read("../src/components/ui/icons.tsx")).toMatch(
      /ArrowUpRightIcon[\s\S]*?rtl:scale-x-\[-1\]/,
    );
  });

  it("numeric figures are bidi-isolated so «+4 180» never reorders", () => {
    for (const rel of [
      "../src/components/sections/Cases.tsx",
      "../src/components/sections/Numbers.tsx",
      "../src/components/sections/Hero.tsx",
    ]) {
      expect(read(rel), rel).toContain('dir="ltr"');
    }
  });

  it("layout-bearing utilities are logical, not physical (spot check)", () => {
    expect(read("../src/components/layout/Header.tsx")).toContain("focus-visible:start-2");
    expect(read("../src/components/sections/Contact.tsx")).toContain("border-s-4");
    expect(read("../src/components/conversion/MessengerFab.tsx")).toContain("end-4");
    expect(read("../src/components/ui/Logo.tsx")).toContain("ms-1");
  });
});
