import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { uk } from "../src/dictionaries/uk";
import { en } from "../src/dictionaries/en";
import { he } from "../src/dictionaries/he";
import { ro } from "../src/dictionaries/ro";

/** Every shipped dictionary — a new locale joins these assertions by itself. */
const allDicts = [uk, en, he, ro];

const css = readFileSync(
  fileURLToPath(new URL("../src/app/globals.css", import.meta.url)),
  "utf8",
);

describe("cycle 1 — color flip tokens (@theme)", () => {
  it("defines the new brief §2 tokens", () => {
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
});

describe("cycle 1 — dictionaries (uk source, typed parity everywhere else)", () => {
  it("has the §3 rotating hero words in every locale", () => {
    expect(uk.hero.rotatingWords).toEqual(["SMM", "REELS", "ТАРГЕТ", "КОНТЕНТ"]);
    expect(en.hero.rotatingWords).toEqual(["SMM", "REELS", "ADS", "CONTENT"]);
    expect(he.hero.rotatingWords).toEqual(["SMM", "REELS", "ממומן", "תוכן"]);
    expect(ro.hero.rotatingWords).toEqual(["SMM", "REELS", "RECLAME", "CONȚINUT"]);
    for (const dict of allDicts) expect(dict.hero.rotatingWords).toHaveLength(4);
  });

  it("uses the §3B six-item ticker in every locale", () => {
    expect(uk.marquee.items).toEqual(["SMM", "REELS", "ТАРГЕТ", "КОНТЕНТ", "MOTION", "AI"]);
    expect(en.marquee.items).toEqual(["SMM", "REELS", "ADS", "CONTENT", "MOTION", "AI"]);
    expect(he.marquee.items).toEqual(["SMM", "REELS", "ממומן", "תוכן", "MOTION", "AI"]);
    expect(ro.marquee.items).toEqual(["SMM", "REELS", "RECLAME", "CONȚINUT", "MOTION", "AI"]);
    // The ticker is the rotating set plus the two universal craft words.
    for (const dict of allDicts) {
      expect(dict.marquee.items).toEqual([...dict.hero.rotatingWords, "MOTION", "AI"]);
    }
  });
});
