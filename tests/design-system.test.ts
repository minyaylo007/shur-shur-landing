import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

/*
 * Design system — tokens, base layer and the CSS that survived redesign v2.
 *
 * History: this file is `tests/redesign-cycle1.test.ts`, renamed. Its token
 * assertions (brief §2 palette, the legacy scales, the dark-field body flip,
 * the 2–4% grain) still describe the shipped design and are kept verbatim.
 * What went is the pair of dictionary assertions about `hero.rotatingWords`
 * and `marquee.items`: both sections were removed in v2, so those keys no
 * longer exist. They are replaced by guards that the CSS they needed went
 * with them — a stylesheet that keeps `marquee-rtl` keyframes for a marquee
 * nobody renders is exactly the kind of dead RTL surface this project cannot
 * afford to carry.
 */

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const css = read("../src/app/globals.css");

describe("design tokens (@theme)", () => {
  it("defines the brief §2 tokens", () => {
    expect(css).toMatch(/--color-cherry-deep:\s*#4a0d14/i);
    expect(css).toMatch(/--color-cherry-black:\s*#2a0a0e/i);
    expect(css).toMatch(/--color-cherry-juice:\s*#c8102e/i);
    expect(css).toMatch(/--color-paper:\s*#f4efe6/i);
    expect(css).toMatch(/--color-cream-type:\s*#fff8f0/i);
  });

  it("keeps the legacy cherry-*/juice-*/paper-* scales for compatibility", () => {
    expect(css).toContain("--color-cherry-900");
    expect(css).toContain("--color-paper-50");
    expect(css).toContain("--color-juice-500");
  });

  it("keeps juice-300 — the only juice light enough for AA on near-black", () => {
    expect(css).toMatch(/--color-juice-300:\s*#f06a76/i);
  });

  it("flips the page base: cherry-deep background, cream type", () => {
    const body = css.match(/body\s*\{[^}]*\}/)?.[0] ?? "";
    expect(body).toContain("background: var(--color-cherry-deep)");
    expect(body).toContain("color: var(--color-cream-type)");
  });

  it("keeps grain in the 2–4% range of the brief", () => {
    const grain = css.match(/\.grain::after\s*\{[^}]*\}/)?.[0] ?? "";
    const opacity = Number(grain.match(/opacity:\s*([\d.]+)/)?.[1]);
    expect(opacity).toBeGreaterThanOrEqual(0.02);
    expect(opacity).toBeLessThanOrEqual(0.04);
  });

  it("restrains itself to two brand colours plus ink/paper (brief §21/§22)", () => {
    /* §21 says CTA competition is solved with whitespace, contrast, scale and
       typography — NOT by introducing a third brand colour. Every --color-*
       token must therefore stay inside the cherry/juice/paper/ink families. */
    const families = [...css.matchAll(/--color-([a-z]+)-?[\w-]*:/g)].map((m) => m[1]);
    expect(new Set(families)).toEqual(new Set(["cherry", "juice", "paper", "cream", "ink"]));
  });
});

describe("base layer", () => {
  it("ships the two-layer focus ring (readable on dark AND on paper)", () => {
    const ring = css.match(/:focus-visible\s*\{[^}]*\}/)?.[0] ?? "";
    expect(ring).toContain("outline: 3px solid var(--color-cream-type)");
    expect(ring).toContain("var(--color-cherry-juice)");
  });

  it("honeypot stays visually hidden rather than display:none (bots skip those)", () => {
    const hidden = css.match(/\.visually-hidden\s*\{[^}]*\}/)?.[0] ?? "";
    expect(hidden).toContain("clip-path: inset(50%)");
    expect(hidden).not.toContain("display: none");
  });

  it("reduced motion kills every decorative transition, not just the obvious ones", () => {
    const block = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toContain(".reveal");
    expect(block).toContain(".kinetic");
    expect(block).toContain("animation-duration: 0.01ms !important");
    expect(block).toContain("transition-duration: 0.01ms !important");
    expect(block).toContain("scroll-behavior: auto !important");
  });
});

describe("v2 pruning — removed sections took their CSS with them", () => {
  /* Each name below belonged to a v1 component that no longer exists. A
     leftover rule is not merely dead weight: `marquee-rtl` in particular was
     a hand-written RTL mirror, i.e. a surface that would need maintaining in
     four locales for a section nobody renders. */
  const gone = [
    "marquee",
    "float-slow",
    "wiggle",
    "rotating-word",
    "word-in",
    "hero-slam",
    "services-track",
    ".tape",
  ];

  it.each(gone)("globals.css no longer defines %s", (name) => {
    expect(css).not.toContain(name);
  });

  it("keeps exactly the utilities the v2 components still use", () => {
    for (const kept of [
      ".grain::after",
      ".paper-texture",
      ".torn-edge",
      ".display-type",
      ".kinetic",
      ".char-line",
      ".char",
      ".reveal",
      ".visually-hidden",
    ]) {
      expect(css).toContain(kept);
    }
  });

  it("stays under 320 lines — v1 shipped 342 (brief §26: less CSS to parse)", () => {
    /* The v2 budget was 250. Production raised it to 260 on 19.09 for the
       comment that records WHY the display line-height is 1.12 and not 0.96
       (the ink of neighbouring heading lines) — comments never reach the
       browser and no rule was added.

       v3 §11 then spent ~25 real lines: the per-char reveal that used to be a
       GSAP timeline is now a keyframe, and its reduced-motion gate a media
       query. ~25 lines of CSS against ~124 KB gzip of JavaScript, which is
       why the ceiling moved instead of the feature.

       And ~40 more for the masks that stop the reveal beheading Й, Ă and the
       comma under Ț — they clip with slack, closed only while the letters
       travel. Same trade: the alternative was Ukrainian headings that read
       «ЯКИИ».

       What the number still guards is the thing brief §26 cares about — the
       stylesheet does not creep. Every raise above is a named feature with
       the bytes it bought. */
    expect(css.split("\n").length).toBeLessThan(320);
  });
});

describe("Button — brand physics survive the redesign", () => {
  const src = read("../src/components/ui/Button.tsx");

  it("squash & stretch on hover/press (touch active states included)", () => {
    expect(src).toMatch(/hover:scale-x-/);
    expect(src).toMatch(/active:scale-x-/);
  });

  it("transition list names `translate`/`scale` — v4 emits those, not `transform`", () => {
    expect(src).not.toMatch(/transition-\[transform/);
    expect(src).toContain("transition-[background-color,box-shadow,color,translate,scale]");
  });
});
