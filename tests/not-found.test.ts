import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { NotFoundView, localeFromPath } from "../src/components/layout/NotFoundDocument";
import { locales, defaultLocale, getDirection } from "../src/lib/i18n";
import { getDictionary } from "../src/dictionaries";

/**
 * A wrong address must land on OUR page, in a language, with a way out.
 *
 * Cut from 28 to 8 assertions on 13.10.2026 (audit P-2026-10-13-03): one test
 * per locale, one for the unknown-locale case, one for dead links, one for
 * the routing shape that keeps the STATUS at 404, one for the discovered
 * documents. The defect it guards («the 404 is the stock Next page: no lang,
 * no text, no link») came back once already in a different shape, so the
 * documents are DISCOVERED by reading `src/`, not enumerated. The status code
 * itself is checked over HTTP by `scripts/check-404.sh` in CI after the build.
 */

const appDir = fileURLToPath(new URL("../src/app", import.meta.url));
const srcDir = fileURLToPath(new URL("../src", import.meta.url));
const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/** The addresses the site actually serves — derived, never hardcoded. */
const livePages = locales.map((locale) => `/${locale}`);
const fontClasses = { latinFontClass: "latin-pair", hebrewFontClass: "hebrew-pair" };
const render = (pathname: string | null) => renderToStaticMarkup(NotFoundView({ pathname, ...fontClasses }));
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

describe("404 — the language is in the address", () => {
  for (const locale of locales) {
    it(`/${locale}/xxx speaks ${locale} in its own direction, with its own font pair, and leads home`, () => {
      const html = render(`/${locale}/xxx`);
      const dict = getDictionary(locale).notFound;
      expect(html).toContain(`lang="${locale}"`);
      expect(html).toContain(`dir="${getDirection(locale)}"`);
      expect(html).toContain(dict.heading);
      expect(html).toContain(`<title>${dict.metaTitle}</title>`);
      expect(html).toContain(locale === "he" ? "hebrew-pair" : "latin-pair");
      expect(html).not.toContain(locale === "he" ? "latin-pair" : "hebrew-pair");
      expect(hrefs(html)).toContain(`/${locale}`);
      expect(html).toContain(dict.home);
    });
  }
});

describe("404 — the language is unknown", () => {
  it("/fr, /ukk, /, (empty), null: bilingual, every language one click away; a prefix is not a locale", () => {
    for (const path of ["/fr", "/ukk", "/qwerty", "/fr/prix", "/", "", null]) {
      const html = render(path);
      expect(html, `rendered for ${path}`).toContain(`lang="${defaultLocale}"`);
      expect(html).toContain(getDictionary(defaultLocale).notFound.heading);
      expect(html).toContain(getDictionary("en").notFound.heading);
      for (const page of livePages) expect(hrefs(html)).toContain(page);
    }
    expect(localeFromPath("/ukk")).toBeNull();
    expect(localeFromPath("/EN")).toBeNull();
    expect(localeFromPath("/uk/tsiny")).toBe("uk");
  });

  it("every link is a live page of this site, and no messenger is offered on a dead address", () => {
    for (const path of ["/uk/tsiny", "/he/x", "/fr", "/", null]) {
      const html = render(path);
      for (const href of hrefs(html)) expect(livePages, `href ${href} rendered for ${path}`).toContain(href);
      for (const marker of ["t.me", "wa.me", "whatsapp", "viber", "tg://", "telegram"]) {
        expect(html.toLowerCase(), `${marker} on the 404 rendered for ${path}`).not.toContain(marker);
      }
    }
  });
});

describe("404 — the shape that keeps the STATUS at 404", () => {
  it("no catch-all route, the locale segment refuses unknown locales, the 404 is a whole document", () => {
    expect(walk(appDir).filter((file) => /\[\.\.\./.test(file))).toEqual([]);
    expect(read("../src/app/[locale]/layout.tsx")).toContain("export const dynamicParams = false");
    const html = render("/fr");
    expect(html).toMatch(/^<html[\s>]/);
    expect(html).toContain("<body");
    expect(html).toContain("<title>");
    expect(html).toContain("</html>");
  });

  it("whatever renders an <html> in src/ — found by reading, not by name — declares a lang", () => {
    const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const documents = walk(srcDir)
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => ({ file, source: code(readFileSync(file, "utf8")) }))
      .filter(({ source }) => /<html[\s>]/.test(source));
    // More than one: the locale layout cannot cover unmatched routes.
    expect(documents.length).toBeGreaterThan(1);
    for (const { file, source } of documents) {
      const openings = source.match(/<html[\s>][\s\S]*?>/g) ?? [];
      expect(openings.length).toBeGreaterThan(0);
      for (const opening of openings) expect(opening, `<html> without lang in ${file}`).toMatch(/lang=/);
    }
  });
});
