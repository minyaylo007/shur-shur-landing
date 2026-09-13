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

  it("navigates to the four v2 destinations and nothing that no longer exists", () => {
    for (const anchor of ['"#work"', '"#services"', '"#about"', '"#contact"']) {
      expect(src).toContain(anchor);
    }
    expect(src).not.toContain('"#cases"');
    expect(src).not.toContain('"#team"');
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
    expect(src).toContain("gsap.matchMedia()");
    expect(src).toContain('mm.add("(prefers-reduced-motion: no-preference)"');
    expect(src).toContain("once: true");
    // dir="auto" per word: without it a Latin word renders mirrored in Hebrew.
    expect(src).toContain('dir="auto"');
  });

  it("Lenis starts only when motion is welcome and hands focus to anchor targets", () => {
    const src = read("../src/components/motion/SmoothScroll.tsx");
    expect(src).toContain('mm.add("(prefers-reduced-motion: no-preference)"');
    expect(src).toContain("focus({ preventScroll: true })");
  });

  it("no dependency was added for visual effects — gsap + lenis only", () => {
    const pkg = JSON.parse(read("../package.json")) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      "gsap",
      "lenis",
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
