import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

/*
 * Page shell (header, footer, layout) and motion discipline.
 *
 * History: this file is `tests/redesign-cycle2.test.ts`, renamed. Three of
 * its assertions describe code that is still shipped and are kept: the
 * Header's SSR-safe `atTop` default, the Footer's juice-300-only contrast
 * rule, and the juice-300 token (now asserted in design-system.test.ts).
 * Everything else in cycle 2 tested components deleted in v2 — HeroSlam,
 * CherryScene, FloatingCherries, GooDrips, SplatCTA, PaperCard, CherryCursor
 * — so instead of asserting how those behaved, this file now asserts that
 * they are gone and that what replaced them obeys brief §14 (no scroll
 * hijacking, no aggressive parallax, no cursor effects, reduced motion
 * respected) and §13 (silent, lazy, dimensioned video).
 */

const srcDir = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel: string) => readFileSync(srcDir(rel), "utf8");
const exists = (rel: string) => existsSync(srcDir(rel));

describe("shell — Header", () => {
  const src = read("../src/components/layout/Header.tsx");

  it("SSR/no-js default is the dark safe background; JS clears it only at the top", () => {
    expect(src).toMatch(/useState\(false\)/);
    expect(src).toMatch(/window\.scrollY <= 24/);
    expect(src).toMatch(/atTop\s*\?\s*"bg-transparent"/);
    expect(src).toContain("bg-cherry-deep/90");
  });

  it("CTA transition list names `translate` (v4 translate-* is NOT `transform`)", () => {
    expect(src).not.toMatch(/transition-\[transform/);
    expect(src).toContain("transition-[translate,box-shadow,background-color]");
  });

  /* The bar is sized by the LONGEST translation, not the shortest. Romanian
     used to wrap "DESPRE NOI" and the CTA onto two lines at 1440 and push the
     whole row off the page at 768; Ukrainian, ~90px shorter, fit and hid the
     problem. These three assertions keep the three rules that fixed it. */
  it("nothing in the bar may wrap — a two-line menu item or CTA is the bug", () => {
    const whitespaceNowrap = src.match(/whitespace-nowrap/g) ?? [];
    expect(whitespaceNowrap.length).toBeGreaterThanOrEqual(3); // menu item, CTA, phone number
    expect(src).toMatch(/text-\[13px\][^"]*whitespace-nowrap/); // menu item
    expect(src).toMatch(/bg-cherry-juice[^"]*whitespace-nowrap/); // CTA
  });

  it("the inline menu waits for `lg` — at `md` the Romanian bar overflowed", () => {
    expect(src).toContain("lg:flex");
    expect(src).not.toContain("md:flex");
    expect(src).toContain("xl:gap-7"); // full spacing only where there is room
  });

  it("the phone yields where the bar is full: no number below `xl`, nothing at `lg`", () => {
    expect(src).toContain("md:inline-flex lg:hidden xl:inline-flex");
    expect(src).toContain("xl:inline");
    expect(src).not.toContain("lg:inline\"");
  });

  it("navigates to the four v2 destinations and nothing that no longer exists", () => {
    for (const anchor of ['"#work"', '"#services"', '"#about"', '"#contact"']) {
      expect(src).toContain(anchor);
    }
    expect(src).not.toContain('"#cases"');
    expect(src).not.toContain('"#team"');
  });
});

describe("shell — LanguageSwitcher", () => {
  const src = read("../src/components/layout/LanguageSwitcher.tsx");

  it("four pills stay compact until `xl` — their full size is what crowded the bar", () => {
    expect(src).toContain("xl:text-xs");
    expect(src).toContain("xl:px-2.5");
    expect(src).not.toContain("sm:text-xs");
    expect(src).not.toContain("sm:px-2.5");
  });
});

describe("shell — Footer", () => {
  const src = read("../src/components/layout/Footer.tsx");

  it("small accents on cherry-black use juice-300 (juice-400 ≈4.4:1 fails AA)", () => {
    expect(src).toContain("juice-300");
    expect(src).not.toContain("juice-400");
    expect(src).not.toContain("juice-500");
  });

  it("mirrors the header's four destinations — one IA, stated twice", () => {
    for (const anchor of ['"#work"', '"#services"', '"#about"', '"#contact"']) {
      expect(src).toContain(anchor);
    }
    expect(src).not.toContain('"#cases"');
  });
});

describe("shell — layout", () => {
  const src = read("../src/app/[locale]/layout.tsx");

  it('opts into the full screen (viewportFit: "cover") for the safe-area maths', () => {
    expect(src).toContain('viewportFit: "cover"');
  });

  it("ships html.no-js and removes it synchronously before paint", () => {
    expect(src).toContain("no-js");
    expect(src).toContain("document.documentElement.classList.remove('no-js')");
  });
});

describe("shell — language switcher (v3 §2)", () => {
  const src = read("../src/components/layout/LanguageSwitcher.tsx");

  it("is a disclosure, not a permanent row of four", () => {
    expect(src).toContain("aria-expanded");
    expect(src).toContain("aria-controls");
    expect(src).toContain('aria-haspopup="listbox"');
    expect(src).toContain('role="listbox"');
    expect(src).toContain('role="option"');
    expect(src).toContain("aria-selected");
  });

  it("names languages in their own language and shows no flag", () => {
    expect(src).toContain("localeNames");
    const i18n = read("../src/lib/i18n.ts");
    for (const autonym of ["Українська", "English", "עברית", "Română"]) {
      expect(i18n).toContain(autonym);
    }
    // A flag is a country, not a language — and Hebrew, English and Romanian
    // are each spoken in more than one of them.
    expect(src).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u);
  });

  it("keeps the path AND the query string — a campaign UTM survives the switch", () => {
    expect(src).toContain("useSearchParams");
    expect(src).toMatch(/searchParams\?\.toString\(\)/);
    expect(src).toMatch(/`\/\$\{code\}\$\{rest\}/);
  });

  it("remembers a manual choice in both a cookie and localStorage", () => {
    expect(src).toContain("localeStorageKey");
    expect(src).toContain("localStorage.setItem");
    expect(src).toContain("document.cookie");
  });

  it("works from the keyboard: roving focus, Escape, outside click, focus return", () => {
    expect(src).toContain('"ArrowDown"');
    expect(src).toContain('"ArrowUp"');
    expect(src).toContain('"Home"');
    expect(src).toContain('"End"');
    expect(src).toContain('"Escape"');
    expect(src).toContain("pointerdown");
    expect(src).toContain("focusin");
  });

  it("the trigger clears the 44px touch floor", () => {
    expect(src).toContain("min-h-11");
  });

  it("a modified click still opens in a new tab instead of being swallowed", () => {
    expect(src).toMatch(/metaKey|ctrlKey/);
  });
});

describe("motion discipline (brief §14)", () => {
  const motionDir = srcDir("../src/components/motion");
  const motionFiles = readdirSync(motionDir);

  it("keeps only the three motion primitives v2 uses", () => {
    expect(motionFiles.sort()).toEqual([
      "KineticHeading.tsx",
      "Reveal.tsx",
      "SmoothScroll.tsx",
    ]);
  });

  it.each([
    "../src/components/motion/CherryCursor.tsx",
    "../src/components/motion/FloatingCherries.tsx",
    "../src/components/motion/HeroSlam.tsx",
    "../src/components/motion/Magnetic.tsx",
    "../src/components/motion/Parallax.tsx",
    "../src/components/motion/RotatingWords.tsx",
    "../src/components/motion/CountUp.tsx",
    "../src/components/ui/GooDrips.tsx",
    "../src/components/ui/SplatCTA.tsx",
    "../src/components/three/CherryScene.tsx",
  ])("%s is gone", (path) => {
    expect(exists(path)).toBe(false);
  });

  it("nothing pins the scroll or scrubs it — the visitor keeps the scrollbar", () => {
    for (const file of motionFiles) {
      const src = readFileSync(`${motionDir}/${file}`, "utf8");
      expect(src).not.toContain("pin:");
      expect(src).not.toContain("scrub:");
    }
  });

  it("Reveal is IO-driven CSS, not a per-element animation library call", () => {
    const src = read("../src/components/motion/Reveal.tsx");
    expect(src).toContain("IntersectionObserver");
    expect(src).toContain("is-inview");
    expect(src).not.toContain("gsap");
  });

  it("KineticHeading plays once and is gated on a LIVE reduced-motion query", () => {
    const src = read("../src/components/motion/KineticHeading.tsx");
    // v3 §11: the same behaviour, without the 124 KB. Two IntersectionObservers
    // replace the GSAP timeline; the reveal one unobserves after it fires, which
    // is what `once: true` used to mean.
    expect(src).toContain("IntersectionObserver");
    expect(src).toContain("unobserve");
    /* The reduced-motion gate moved from JS into the stylesheet, where it is
       live for free: flipping the OS setting needs no reload and no listener,
       which is exactly what `gsap.matchMedia()` was paying bytes for. */
    const css = read("../src/app/globals.css");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toMatch(/html:not\(\.no-js\) \.is-revealed \.char[\s\S]{0,80}animation: none/);
    // dir="auto" per word: without it a Latin word renders mirrored in Hebrew.
    expect(src).toContain('dir="auto"');
  });

  it("§11: smooth scroll is the browser's own, and anchors still take focus", () => {
    const src = read("../src/components/motion/SmoothScroll.tsx");
    // Lenis was itself a mild form of the scroll hijacking §14 rules out: it
    // replaced the wheel with a lerp. The CSS property does the same job.
    expect(src).toContain("scrollIntoView");
    expect(src).toContain("focus({ preventScroll: true })");
    expect(read("../src/app/globals.css")).toContain("scroll-behavior: smooth");
  });

  it("§11: neither GSAP nor Lenis is imported anywhere, in any casing", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk(`${dir}/${entry.name}`)
          : [readFileSync(`${dir}/${entry.name}`, "utf8")],
      );
    for (const file of walk(srcDir("../src"))) {
      // Comments explaining what was removed are fine; imports are not.
      expect(file).not.toMatch(/from\s+["'](gsap|lenis)/i);
      expect(file).not.toMatch(/require\(["'](gsap|lenis)/i);
    }
  });

  it("no dependency ships for visual effects at all", () => {
    const pkg = JSON.parse(read("../package.json")) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      "next",
      "react",
      "react-dom",
      "zod",
    ]);
  });
});

describe("media discipline (brief §13)", () => {
  const src = read("../src/components/media/AutoVideo.tsx");

  it("silent, looping, inline — and never a player the visitor must operate", () => {
    expect(src).toContain("muted");
    expect(src).toContain("loop");
    expect(src).toContain("playsInline");
    expect(src).toContain('role="img"');
    expect(src).toContain("aria-label={label}");
    expect(src).not.toContain("controls");
  });

  it("intrinsic width/height reach the element, so the box never reflows (CLS)", () => {
    expect(src).toContain("width={width}");
    expect(src).toContain("height={height}");
  });

  it("below the fold nothing downloads until it is on screen", () => {
    expect(src).toContain('preload={eager ? "metadata" : "none"}');
    expect(src).toContain("IntersectionObserver");
    expect(src).toContain('if (element.preload === "none") element.preload = "auto"');
  });

  it("reduced motion leaves the poster frame in place instead of swapping markup", () => {
    expect(src).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(src).toContain("if (motionQuery.matches) return;");
  });

  it("no embedded player: no YouTube, no Vimeo, no Drive hotlink anywhere in src", () => {
    const offenders = [/youtube\.com/i, /youtu\.be/i, /vimeo\.com/i, /drive\.google\.com/i];
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk(`${dir}/${entry.name}`)
          : [readFileSync(`${dir}/${entry.name}`, "utf8")],
      );
    const all = walk(srcDir("../src")).join("\n");
    for (const pattern of offenders) expect(all).not.toMatch(pattern);
  });
});

describe("page composition", () => {
  const src = read("../src/app/[locale]/page.tsx");

  it("renders the seven-beat scroll in order (brief §4/§29)", () => {
    const order = [
      "<Header",
      "<Hero",
      "<SelectedWork",
      "<ProcessResult",
      "<Services",
      "<Trust",
      "<AuditCta",
      "<Footer",
      "<ContactBar",
    ].map((tag) => src.indexOf(tag));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("mounts no v1 block that the redesign retired", () => {
    for (const tag of [
      "<Marquee",
      "<Pain",
      "<Cases",
      "<Numbers",
      "<About",
      "<Team",
      "<Socials",
      "<Contact ",
      "<MessengerFab",
      "<StickyCta",
      "<CherryCursor",
    ]) {
      expect(src).not.toContain(tag);
    }
  });

  it("uses two torn-paper boundaries, not seven — the tape was becoming wallpaper", () => {
    expect(src.match(/<TapeDivider/g)).toHaveLength(2);
  });

  it("skip-link target stays focusable (WCAG 2.4.1)", () => {
    expect(src).toContain('<main id="main" tabIndex={-1}');
  });
});
