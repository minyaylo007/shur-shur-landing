import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { NotFoundView, localeFromPath } from "../src/components/layout/NotFoundDocument";
import { locales, defaultLocale, getDirection, type Locale } from "../src/lib/i18n";
import { getDictionary } from "../src/dictionaries";

/**
 * A wrong address must land on OUR page, in a language, with a way out.
 *
 * These tests know as little as possible about file names on purpose. The
 * defect they guard against («the 404 is the stock Next page: no lang, no
 * text, no link») came back once already in a different shape, and a test
 * that lists the four files it knows cannot see a fifth place appear. So:
 *
 *   • the document is rendered for real addresses and inspected as HTML;
 *   • every place in `src/` that renders an <html> is DISCOVERED by reading
 *     the sources, not enumerated here, and each one must carry a `lang`;
 *   • the routing shape that keeps the STATUS at 404 is asserted as a rule
 *     («no route may match an unknown address»), not as a list of files.
 *
 * The status code itself is checked over HTTP against a real production
 * build — `scripts/check-404.sh`, run in CI right after `npm run build`.
 * It cannot be checked here: `npm test` runs before anything is built.
 */

const appDir = fileURLToPath(new URL("../src/app", import.meta.url));
const srcDir = fileURLToPath(new URL("../src", import.meta.url));
const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/** Every file under a directory, recursively. */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/** The addresses the site actually serves — derived, never hardcoded. */
const livePages = locales.map((locale) => `/${locale}`);

const fontClasses = { latinFontClass: "latin-pair", hebrewFontClass: "hebrew-pair" };
const render = (pathname: string | null) =>
  renderToStaticMarkup(NotFoundView({ pathname, ...fontClasses }));

/** Every href the rendered document offers. */
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

/* ============================================================
   Case 1 — the address names a language we speak
   ============================================================ */

describe("404 — the language is in the address (/uk/tsiny, /he/xxx)", () => {
  const paths: Record<Locale, string> = {
    uk: "/uk/tsiny",
    en: "/en/contact",
    he: "/he/xxx",
    ro: "/ro/preturi",
  };

  for (const locale of locales) {
    const path = paths[locale];

    it(`${path}: the page speaks ${locale}, in its own direction`, () => {
      const html = render(path);
      expect(html).toContain(`lang="${locale}"`);
      expect(html).toContain(`dir="${getDirection(locale)}"`);
      const dict = getDictionary(locale).notFound;
      expect(html).toContain(dict.heading);
      expect(html).toContain(dict.text);
      expect(html).toContain(`<title>${dict.metaTitle}</title>`);
    });

    it(`${path}: leads back to a page the site really serves`, () => {
      const html = render(path);
      /* The way out is a LIVE page, and it must be the visitor's own
         language — sending a Hebrew reader to the Ukrainian home page is a
         second dead end. */
      expect(hrefs(html)).toContain(`/${locale}`);
      expect(html).toContain(getDictionary(locale).notFound.home);
    });
  }

  it("Hebrew is the only one that flips the document", () => {
    expect(render("/he/xxx")).toContain('dir="rtl"');
    for (const locale of locales.filter((code) => code !== "he")) {
      expect(render(`/${locale}/xxx`)).toContain('dir="ltr"');
    }
  });

  it("only the Hebrew document loads the Hebrew font pair", () => {
    expect(render("/he/xxx")).toContain("hebrew-pair");
    expect(render("/he/xxx")).not.toContain("latin-pair");
    expect(render("/uk/xxx")).toContain("latin-pair");
    expect(render("/uk/xxx")).not.toContain("hebrew-pair");
  });
});

/* ============================================================
   Case 2 — the address names no language of ours
   ============================================================ */

describe("404 — the language is unknown (/fr, /ukk, /qwerty)", () => {
  const strangers = ["/fr", "/ukk", "/qwerty", "/fr/prix", "/", ""];

  for (const path of strangers) {
    it(`${path || "(empty)"}: bilingual, with every language one click away`, () => {
      const html = render(path);
      /* The document still declares a language — «no lang» is the defect. */
      expect(html).toContain(`lang="${defaultLocale}"`);
      expect(html).toContain(getDictionary(defaultLocale).notFound.heading);
      expect(html).toContain(getDictionary("en").notFound.heading);
      for (const page of livePages) {
        expect(hrefs(html)).toContain(page);
      }
    });
  }

  it("an unreadable address is still a page, not a blank", () => {
    const html = render(null);
    expect(html).toContain(`lang="${defaultLocale}"`);
    expect(hrefs(html)).toContain(`/${defaultLocale}`);
  });

  it("`/ukk` is not read as `uk` — a prefix is not a locale", () => {
    expect(localeFromPath("/ukk")).toBeNull();
    expect(localeFromPath("/uk")).toBe("uk");
    expect(localeFromPath("/uk/tsiny")).toBe("uk");
    expect(localeFromPath("/he")).toBe("he");
    expect(localeFromPath("/EN")).toBeNull();
  });
});

/* ============================================================
   Every link on the page must go somewhere alive
   ============================================================ */

describe("404 — no dead ends and no dead links", () => {
  const everyPath = ["/uk/tsiny", "/en/x", "/he/x", "/ro/x", "/fr", "/ukk", "/", null];

  it("every link on the page is a page of this site", () => {
    for (const path of everyPath) {
      for (const href of hrefs(render(path))) {
        expect(livePages, `href ${href} rendered for ${path}`).toContain(href);
      }
    }
  });

  it("no messenger is offered here", () => {
    /* A dead address is the worst possible place for a link that may itself
       be dead, and the channels live on the page we send the visitor to. */
    for (const path of everyPath) {
      const html = render(path).toLowerCase();
      for (const marker of ["t.me", "wa.me", "whatsapp", "viber", "tg://", "telegram"]) {
        expect(html, `${marker} on the 404 rendered for ${path}`).not.toContain(marker);
      }
    }
  });

  it("all four languages are offered, whatever the address was", () => {
    for (const path of everyPath) {
      const html = render(path);
      for (const locale of locales) {
        expect(html).toContain(`href="/${locale}"`);
      }
    }
  });
});

/* ============================================================
   The shape that keeps the STATUS at 404
   ============================================================ */

describe("404 — nothing may answer an unknown address with 200", () => {
  it("no route in the app matches an arbitrary path", () => {
    /* A catch-all segment would RENDER for `/uk/tsiny` — and a rendered page
       answers 200. Then the page above would look right and the site would
       still be dropped from search results. */
    const catchAll = walk(appDir).filter((file) => /\[\.\.\./.test(file));
    expect(catchAll).toEqual([]);
  });

  it("the locale segment refuses a locale it does not know", () => {
    /* Without this `/fr` would be built on demand as if `fr` were a language
       of ours. With it, `fr` matches no route and Next serves the 404. */
    expect(read("../src/app/[locale]/layout.tsx")).toContain("export const dynamicParams = false");
  });

  it("the 404 is a whole document, not a fragment waiting for a layout", () => {
    /* This is what actually keeps the page alive on an unmatched address.
       The only layout in this app lives under `[locale]`, and `/fr` never
       reaches it — a 404 that rendered a fragment would be wrapped by Next's
       own bare shell instead, which is the production defect: <html> with no
       `lang`, no text of ours, no way back. So the document must bring its
       own <html>, <body> and <title>. Which FILE Next picks is not asserted
       here: that is HTTP behaviour, and `scripts/check-404.sh` asks a real
       production server for it in CI. */
    const html = render("/fr");
    expect(html).toMatch(/^<html[\s>]/);
    expect(html).toContain("<body");
    expect(html).toContain("<title>");
    expect(html).toContain("</html>");
  });
});

/* ============================================================
   Discovery — every document in the app, found by reading, not by name
   ============================================================ */

describe("documents — whatever renders an <html>, it declares a language", () => {
  /* Comments talk ABOUT <html> — this one does. Strip them, or the scan
     finds documents that do not exist. */
  const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const documents = walk(srcDir)
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => ({ file, source: code(readFileSync(file, "utf8")) }))
    .filter(({ source }) => /<html[\s>]/.test(source));

  it("there is more than one — the locale layout cannot cover unmatched routes", () => {
    expect(documents.length).toBeGreaterThan(1);
  });

  for (const { file, source } of documents) {
    const name = file.slice(srcDir.length + 1);

    it(`${name}: <html> carries a lang`, () => {
      const openings = source.match(/<html[\s>][\s\S]*?>/g) ?? [];
      expect(openings.length).toBeGreaterThan(0);
      for (const opening of openings) {
        expect(opening, `<html> without lang in ${name}`).toMatch(/lang=/);
      }
    });
  }
});
