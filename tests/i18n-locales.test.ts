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
  localeNames,
  localeShort,
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

/* Strings that are the SAME in every locale by design: the proof quotes are
   verbatim Ukrainian comments and post excerpts from real Instagram posts
   (§28 honesty: we translate the attribution and the caption that frames
   them, never the quote itself).

   v3 §2: the language NAMES left the dictionaries entirely. They are autonyms
   in lib/i18n — a language is called what its own speakers call it, in every
   interface language, so translating them was always wrong. */
const isVerbatim = (path: string) => /^trust\.quotes\.items\[\d+\]\.text$/.test(path);

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
    for (const dict of dicts) expect(dict.nav.work.length).toBeGreaterThan(1);
  });

  it("no locale shares a heading with another (no copy-paste stubs)", () => {
    const headings = locales.map((locale) => getDictionary(locale).work.heading);
    expect(new Set(headings).size).toBe(locales.length);
  });

  it("no empty or whitespace-only string anywhere", () => {
    for (const locale of locales) {
      for (const [path, value] of flatten(getDictionary(locale))) {
        expect(value.trim(), `${locale}.${path}`).not.toBe("");
      }
    }
  });

  it("langSwitcher ships only the labels a screen reader needs", () => {
    for (const locale of locales) {
      const sw = getDictionary(locale).langSwitcher;
      expect(sw.label.length).toBeGreaterThan(3);
      expect(sw.current.length).toBeGreaterThan(3);
      // The names themselves are NOT here — see localeNames below.
      for (const code of locales) expect(sw).not.toHaveProperty(code);
    }
  });

  it("language names are autonyms in lib/i18n, each in its own script", () => {
    expect(localeNames.uk).toMatch(CYRILLIC);
    expect(localeNames.he).toMatch(HEBREW);
    expect(localeNames.ro).toMatch(/^[A-Za-zĂÂÎȘȚăâîșț]+$/);
    expect(localeNames.en).toBe("English");
    for (const locale of locales) {
      expect(localeNames[locale].length).toBeGreaterThan(1);
      // Two letters, for the collapsed trigger.
      expect(localeShort[locale]).toMatch(/^[A-Z]{2}$/);
    }
    expect(new Set(Object.values(localeNames)).size).toBe(locales.length);
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
      he.nav.work,
      he.hero.cta,
      he.work.heading,
      he.process.btsLabel,
      he.trust.heading,
      he.audit.form.submit,
      he.audit.form.errors.igHandle,
      he.audit.form.successTitle,
      he.footer.rights,
      he.contactBar.label,
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
  it("globals.css: Hebrew gets neutral display tracking, LTR keeps the tight one", () => {
    const css = read("../src/app/globals.css");
    expect(css).toMatch(/--display-tracking:\s*-0\.02em/);
    expect(css).toMatch(/\[dir="rtl"\]\s*\{\s*--display-tracking:\s*0em/);
  });

  /* Redesign v2 deleted the marquee and the pinned Services track — the two
     places that needed a hand-mirrored animation. Nothing on the page now
     mirrors itself in JS or in keyframes, so the RTL surface is smaller: it
     is the `dir` attribute plus logical utilities, both checked below. This
     test guards the deletion, so a re-introduced physical animation has to
     bring its own RTL story rather than silently inheriting none. */
  it("no animation is mirrored by hand any more (nothing left to mirror)", () => {
    const css = read("../src/app/globals.css");
    expect(css).not.toContain("marquee");
    expect(read("../src/components/sections/Services.tsx")).not.toContain("ScrollTrigger");
  });

  it("the up-right arrow glyph mirrors itself once, at its definition", () => {
    expect(read("../src/components/ui/icons.tsx")).toMatch(
      /ArrowUpRightIcon[\s\S]*?rtl:scale-x-\[-1\]/,
    );
  });

  it("numerals and @handles are bidi-isolated so «+380 97…» never reorders", () => {
    /* Three files left this list in v3, all for the same reason — they no
       longer print a number or an @handle at all. The hero is one heading,
       one line and one button (§1, §8); the header CTA is a word (§4); the
       contact control is one labelled pill (§4, §6). What still prints Latin
       or digits inside a possibly-RTL line must still isolate it. */
    for (const rel of [
      "../src/components/sections/Trust.tsx",
      "../src/components/sections/AuditCta.tsx",
      "../src/components/layout/Footer.tsx",
      "../src/components/forms/AuditForm.tsx",
      "../src/components/layout/LanguageSwitcher.tsx",
    ]) {
      expect(read(rel), rel).toContain('dir="ltr"');
    }
    // …and the three that dropped it print no bare number to isolate.
    for (const rel of [
      "../src/components/sections/Hero.tsx",
      "../src/components/layout/Header.tsx",
      "../src/components/conversion/ContactBar.tsx",
    ]) {
      expect(read(rel), rel).not.toContain("site.phone");
    }
  });

  it("mixed-language quotes let the browser decide their direction", () => {
    // The proof quotes stay Ukrainian in every locale — a Hebrew page must
    // still lay each one out LTR, which only dir="auto" gets right.
    expect(read("../src/components/sections/Trust.tsx")).toContain('dir="auto"');
  });

  it("layout-bearing utilities are logical, not physical (spot check)", () => {
    expect(read("../src/components/layout/Header.tsx")).toContain("focus-visible:start-2");
    // The hero video frame and the contact control both sit on the inline
    // edge — in Hebrew they must swap sides without a mirrored copy.
    expect(read("../src/components/sections/Hero.tsx")).toContain("lg:end-10");
    expect(read("../src/components/conversion/ContactBar.tsx")).toContain("end-4");
    expect(read("../src/components/ui/Logo.tsx")).toContain("ms-1");
  });

  it("no physical left/right utility sneaks into the new sections", () => {
    /* Matches the utilities that hard-code a side — `ml-4`, `pr-[2px]`,
       `left-1/2`, `text-right` — while leaving prose like "right-to-left"
       and logical `ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-` alone. */
    const physical =
      /\b(?:ml|mr|pl|pr)-(?:\d|\[|auto|px|full)|\b(?:left|right)-(?:\d|\[|auto|full)|\btext-(?:left|right)\b/;
    for (const rel of [
      "../src/components/sections/Hero.tsx",
      "../src/components/sections/SelectedWork.tsx",
      "../src/components/sections/ProcessResult.tsx",
      "../src/components/sections/Services.tsx",
      "../src/components/sections/Trust.tsx",
      "../src/components/sections/AuditCta.tsx",
      "../src/components/conversion/ContactBar.tsx",
    ]) {
      expect(read(rel), rel).not.toMatch(physical);
    }
  });
});
