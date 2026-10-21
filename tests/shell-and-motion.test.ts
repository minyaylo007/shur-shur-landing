import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

/*
 * Page shell (header, footer, layout) and motion discipline — the short form.
 *
 * Cut from 46 to 13 assertions on 13.10.2026 (audit P-2026-10-13-03): the
 * tests that listed deleted v1 components one by one are folded into the
 * exact directory listing, and the per-property checks of one component are
 * one test per component. What is kept is the set of rules that each came
 * from a shipped defect: the Romanian header that wrapped, the phone that
 * crowded the bar, the UTM lost on a language switch, GSAP/Lenis creeping
 * back, a video the visitor would have to operate (brief §13/§14).
 */

const srcDir = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel: string) => readFileSync(srcDir(rel), "utf8");
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [readFileSync(`${dir}/${entry.name}`, "utf8")],
  );
const anchors = ['"#work"', '"#services"', '"#about"', '"#contact"'];

describe("shell — Header", () => {
  const src = read("../src/components/layout/Header.tsx");

  it("nothing in the bar wraps, and the inline menu waits for `lg` (Romanian overflowed at `md`)", () => {
    expect(src.match(/whitespace-nowrap/g) ?? []).toHaveLength(2); // menu item, CTA
    expect(src).toContain("lg:flex");
    expect(src).not.toContain("md:flex");
  });

  it("three groups — logo, menu + language, one action — and no phone in the bar", () => {
    expect(src.match(/<nav\b/g)).toHaveLength(1);
    expect(src.match(/<ContactLink\b/g)).toHaveLength(1);
    expect(src).toContain("<LanguageSwitcher");
    expect(src).not.toContain("tel:");
    expect(src).not.toContain("site.phone");
  });

  it("header and footer name the same four destinations and nothing retired", () => {
    const footer = read("../src/components/layout/Footer.tsx");
    for (const anchor of anchors) {
      expect(src).toContain(anchor);
      expect(footer).toContain(anchor);
    }
    for (const gone of ['"#cases"', '"#team"']) {
      expect(src).not.toContain(gone);
      expect(footer).not.toContain(gone);
    }
  });
});

describe("shell — Footer and layout", () => {
  it("small accents on cherry-black use juice-300 (juice-400 ≈4.4:1 fails AA)", () => {
    const src = read("../src/components/layout/Footer.tsx");
    expect(src).toContain("juice-300");
    expect(src).not.toMatch(/juice-(400|500)/);
  });

  it("layout covers the full screen and clears html.no-js before paint", () => {
    const src = read("../src/app/[locale]/layout.tsx");
    expect(src).toContain('viewportFit: "cover"');
    expect(src).toContain("document.documentElement.classList.remove('no-js')");
  });
});

describe("shell — LanguageSwitcher (v3 §2)", () => {
  const src = read("../src/components/layout/LanguageSwitcher.tsx");

  it("is one accessible disclosure out of flow, with a 44px trigger, RTL-safe", () => {
    expect(src.match(/aria-expanded=/g)).toHaveLength(1);
    for (const attr of ["aria-controls", 'aria-haspopup="listbox"', 'role="listbox"', 'role="option"', "aria-selected"]) {
      expect(src).toContain(attr);
    }
    expect(src).toContain("absolute end-0");
    expect(src).toContain("min-h-11");
    expect(src).not.toMatch(/\bright-0\b|\bleft-0\b/);
  });

  it("keeps path and query on switch (a campaign UTM survives) and remembers the choice", () => {
    expect(src).toContain("useSearchParams");
    expect(src).toMatch(/`\/\$\{code\}\$\{rest\}/);
    expect(src).toContain("localStorage.setItem");
    expect(src).toContain("document.cookie");
  });

  it("works from the keyboard and names languages in their own language, no flags", () => {
    for (const key of ['"ArrowDown"', '"ArrowUp"', '"Escape"', "pointerdown", "focusin"]) {
      expect(src).toContain(key);
    }
    expect(src).toMatch(/metaKey|ctrlKey/);
    expect(src).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u);
    const i18n = read("../src/lib/i18n.ts");
    for (const autonym of ["Українська", "English", "עברית", "Română"]) expect(i18n).toContain(autonym);
  });
});

describe("motion discipline (brief §14)", () => {
  const motionDir = srcDir("../src/components/motion");

  it("keeps exactly the three motion primitives, none of which pins or scrubs the scroll", () => {
    expect(readdirSync(motionDir).sort()).toEqual(["KineticHeading.tsx", "Reveal.tsx", "SmoothScroll.tsx"]);
    for (const file of walk(motionDir)) {
      expect(file).not.toContain("pin:");
      expect(file).not.toContain("scrub:");
    }
    expect(read("../src/components/motion/Reveal.tsx")).toContain("IntersectionObserver");
    expect(read("../src/components/motion/KineticHeading.tsx")).toContain('dir="auto"');
    expect(read("../src/app/globals.css")).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("§11: no GSAP, no Lenis, and no dependency at all for visual effects", () => {
    for (const file of walk(srcDir("../src"))) {
      expect(file).not.toMatch(/from\s+["'](gsap|lenis)/i);
      expect(file).not.toMatch(/require\(["'](gsap|lenis)/i);
    }
    const pkg = JSON.parse(read("../package.json")) as { dependencies: Record<string, string> };
    // @vercel/analytics: cookieless visitor count, not a visual effect.
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      "@vercel/analytics",
      "next",
      "react",
      "react-dom",
      "zod",
    ]);
  });
});

describe("media discipline (brief §13)", () => {
  it("AutoVideo is silent, looping, inline, lazy, dimensioned, and honours reduced motion", () => {
    const src = read("../src/components/media/AutoVideo.tsx");
    for (const needle of ["muted", "loop", "playsInline", 'role="img"', "width={width}", "height={height}", "IntersectionObserver"]) {
      expect(src).toContain(needle);
    }
    expect(src).toContain('preload={eager ? "metadata" : "none"}');
    expect(src).toContain("if (motionQuery.matches) return;");
    expect(src).not.toContain("controls");
  });

  it("no embedded player anywhere in src: no YouTube, Vimeo or Drive hotlink", () => {
    const all = walk(srcDir("../src")).join("\n");
    for (const pattern of [/youtube\.com/i, /youtu\.be/i, /vimeo\.com/i, /drive\.google\.com/i]) {
      expect(all).not.toMatch(pattern);
    }
  });
});

describe("page composition", () => {
  const src = read("../src/app/[locale]/page.tsx");

  it("renders the seven-beat scroll in order (brief §4/§29)", () => {
    const order = ["<Header", "<Hero", "<SelectedWork", "<ProcessResult", "<Services", "<Trust", "<AuditCta", "<Footer", "<ContactBar"]
      .map((tag) => src.indexOf(tag));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("mounts no retired v1 block, uses two torn-paper boundaries, keeps the skip-link target", () => {
    for (const tag of ["<Marquee", "<Pain", "<Cases", "<Numbers", "<Team", "<Socials", "<MessengerFab", "<StickyCta", "<CherryCursor"]) {
      expect(src).not.toContain(tag);
    }
    expect(src.match(/<TapeDivider/g)).toHaveLength(2);
    expect(src).toContain('<main id="main" tabIndex={-1}');
  });
});
