import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const css = read("../src/app/globals.css");

describe("cycle 2 — carry-over fixes from cycle-1 review", () => {
  it("adds the juice-300 token for small accents on near-black fields", () => {
    expect(css).toMatch(/--color-juice-300:\s*#f06a76/i);
  });

  it("HeroSlam: explicit SR name + word-safe split + live .char hook", () => {
    const src = read("../src/components/motion/HeroSlam.tsx");
    expect(src).toContain('aria: "none"');
    expect(src).toContain('aria-label={lines.join(" ")}');
    expect(src).toContain('"words,chars"');
    expect(src).toContain('charsClass: "char"');
  });

  it("Header: SSR/no-js default is the dark safe background, JS clears it only at top", () => {
    const src = read("../src/components/layout/Header.tsx");
    expect(src).toMatch(/useState\(false\)/);
    expect(src).toMatch(/window\.scrollY <= 24/);
    expect(src).toMatch(/atTop\s*\?\s*"bg-transparent"/);
    expect(src).toContain("bg-cherry-deep/90");
  });

  it("CherryScene: DPR cap 1.5 + drop-pose initial position (no final-pose flash)", () => {
    const src = read("../src/components/three/CherryScene.tsx");
    expect(src).toContain("dpr={[1, 1.5]}");
    expect(src).toContain("position={[0, DROP_Y, 0]}");
  });

  it("Footer: small accents on cherry-black use juice-300 (juice-400 ≈4.4:1 fails AA)", () => {
    const src = read("../src/components/layout/Footer.tsx");
    expect(src).toContain("juice-300");
    expect(src).not.toContain("juice-400");
    expect(src).not.toContain("juice-500");
  });
});

describe("cycle 2 — juiciness systems (brief §4 #2/#3, §8 cycle 2)", () => {
  it("FloatingCherries: layered parallax decor behind the three gates", () => {
    const src = read("../src/components/motion/FloatingCherries.tsx");
    expect(src).toContain('aria-hidden="true"');
    expect(src).toContain("pointer-events-none");
    expect(src).toContain("(prefers-reduced-motion: no-preference)");
    expect(src).toContain("(pointer: fine)");
    expect(src).toContain("quickTo");
    expect(src).toContain("data-depth");
  });

  it("GooDrips: SVG goo filter (blur + color matrix), decorative + motion-safe", () => {
    const src = read("../src/components/ui/GooDrips.tsx");
    expect(src).toContain("feGaussianBlur");
    expect(src).toContain("feColorMatrix");
    expect(src).toContain('aria-hidden="true"');
    expect(src).toContain("(prefers-reduced-motion: no-preference)");
  });

  it("SplatCTA: hover splat drops, mouse-only and reduced-motion-guarded", () => {
    const src = read("../src/components/ui/SplatCTA.tsx");
    expect(src).toContain("feColorMatrix");
    expect(src).toContain("prefers-reduced-motion: reduce");
    expect(src).toContain('pointerType === "mouse"');
  });

  it("hero wires the new systems in (decor layers + splat on the primary CTA)", () => {
    const src = read("../src/components/sections/Hero.tsx");
    expect(src).toContain("FloatingCherries");
    expect(src).toContain("SplatCTA");
  });

  it("services seam gets the goo drips; socials gets a decor layer", () => {
    expect(read("../src/components/sections/Services.tsx")).toContain("GooDrips");
    expect(read("../src/components/sections/Socials.tsx")).toContain("FloatingCherries");
  });

  it("Button: squash & stretch on hover/press (touch active states included)", () => {
    const src = read("../src/components/ui/Button.tsx");
    expect(src).toMatch(/hover:scale-x-/);
    expect(src).toMatch(/active:scale-x-/);
  });

  it("PaperCard: peels off on hover (lift + straighten + tape reacts)", () => {
    const src = read("../src/components/ui/PaperCard.tsx");
    expect(src).toContain("--card-rotate");
    expect(src).toMatch(/hover:-translate-y-/);
    expect(src).toContain("group-hover:");
  });

  it("CherryCursor: desktop-only trailing cherry behind the three gates", () => {
    const src = read("../src/components/motion/CherryCursor.tsx");
    expect(src).toContain("(min-width: 1024px)");
    expect(src).toContain("(pointer: fine)");
    expect(src).toContain("(prefers-reduced-motion: no-preference)");
    expect(src).toContain("quickTo");
    expect(read("../src/app/[locale]/page.tsx")).toContain("CherryCursor");
  });
});
