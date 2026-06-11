import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { uk } from "../src/dictionaries/uk";
import { en } from "../src/dictionaries/en";
import { site } from "../src/lib/site";
import { posts, knownHandles } from "../src/lib/posts";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/* ============================================================
   PART A — carry-over fixes mandated by the cycle-2 review
   ============================================================ */
describe("cycle 3 — carry-over fixes from cycle-2 review", () => {
  it("CherryCursor: first mousemove jumps to the pointer BEFORE revealing (no fly-in from 0,0)", () => {
    const src = read("../src/components/motion/CherryCursor.tsx");
    // gsap.set to the pointer position must live inside the `!shown` branch,
    // before the autoAlpha reveal tween.
    expect(src).toMatch(/if\s*\(!shown\)\s*\{[\s\S]*?gsap\.set\(el,\s*\{\s*x[\s\S]*?autoAlpha:\s*1/);
  });

  it("Header CTA: transition list names `translate` (v4 translate-* is NOT covered by `transform`)", () => {
    const src = read("../src/components/layout/Header.tsx");
    expect(src).not.toMatch(/transition-\[transform/);
    expect(src).toContain("transition-[translate,box-shadow,background-color]");
  });

  it("Socials buttons: transition lists name `translate`, not `transform`", () => {
    const src = read("../src/components/sections/Socials.tsx");
    expect(src).not.toMatch(/transition-\[transform/);
    expect(src).not.toMatch(/transition-transform/);
    expect(src).toMatch(/transition-\[translate/);
  });

  it("FloatingCherries: section-variant scrubs refresh after the Services pin (refreshPriority)", () => {
    const src = read("../src/components/motion/FloatingCherries.tsx");
    expect(src).toMatch(/refreshPriority:\s*variant === "section" \? -1 : 0/);
  });

  it("GooDrips / SplatCTA: SVG filter ids come from useId (no hardcoded #goo-* aliasing)", () => {
    const drips = read("../src/components/ui/GooDrips.tsx");
    const splat = read("../src/components/ui/SplatCTA.tsx");
    for (const src of [drips, splat]) {
      expect(src).toContain("useId");
      expect(src).toContain("url(#${");
      expect(src).not.toMatch(/id="goo-/);
    }
  });

  it("Socials: content container stacks above the decor without relying on Reveal transforms", () => {
    const src = read("../src/components/sections/Socials.tsx");
    expect(src).toMatch(/className="relative z-10 mx-auto flex/);
  });
});

/* ============================================================
   PART B — proof layer data (brief §5/§6 + APPENDIX verified)
   ============================================================ */
describe("cycle 3 — lib/posts.ts (Instagram Approach A, verified URLs)", () => {
  const VERIFIED = [
    "https://www.instagram.com/p/C93H517INJt/",
    "https://www.instagram.com/reel/DHGtrkJoO8E/",
    "https://www.instagram.com/reel/DLhQNcgIOGb/",
  ];

  it("curates exactly 6 tiles: 3 verified posts + 3 profile links", () => {
    expect(posts).toHaveLength(6);
    const hrefs = posts.map((p) => p.href);
    for (const url of VERIFIED) expect(hrefs).toContain(url);
    const profileLinks = hrefs.filter((h) => h === site.socials.instagram);
    expect(profileLinks).toHaveLength(3);
  });

  it("every tile uses an owned /brand asset (not smm.png — that is the Socials backdrop) with both alts", () => {
    for (const post of posts) {
      expect(post.image).toMatch(/^\/brand\/[\w-]+\.png$/);
      expect(post.image).not.toBe("/brand/smm.png");
      expect(post.alt.uk.length).toBeGreaterThan(3);
      expect(post.alt.en.length).toBeGreaterThan(3);
    }
  });

  it("knownHandles: the 4 VERIFIED clients/partners from the appendix, linked to Instagram", () => {
    expect(knownHandles.map((k) => k.handle)).toEqual([
      "@100fmcv",
      "@tulpan_cv",
      "@terrasa_ace",
      "@irony_ua",
    ]);
    for (const known of knownHandles) {
      expect(known.href).toMatch(/^https:\/\/www\.instagram\.com\/[\w.]+\/$/);
    }
  });
});

describe("cycle 3 — dictionaries (uk source, en typed parity)", () => {
  it("nav gains the #cases anchor in both locales", () => {
    expect(uk.nav.cases.length).toBeGreaterThan(2);
    expect(en.nav.cases.length).toBeGreaterThan(2);
  });

  it("cases: 4 anonymized metric cards (placeholder strategy §5) with Obys numbering", () => {
    for (const dict of [uk, en]) {
      expect(dict.cases.items).toHaveLength(4);
      expect(dict.cases.items.map((i) => i.num)).toEqual(["01", "02", "03", "04"]);
      for (const item of dict.cases.items) {
        expect(item.niche.length).toBeGreaterThan(3);
        expect(item.value.length).toBeGreaterThan(2);
        expect(item.context.length).toBeGreaterThan(5);
      }
    }
    // Brief §5 placeholder set (REM-FIX-C3): illustrative niches; spaced
    // figures use the NBSP group separator.
    expect(uk.cases.items[0].value).toBe("+4 180");
    expect(uk.cases.items[1].value).toBe("×3.2");
  });

  it("cases: knownBy names align 1:1 with knownHandles; reels alts align with the 4 phones", () => {
    for (const dict of [uk, en]) {
      expect(dict.cases.knownBy.names).toHaveLength(knownHandles.length);
      expect(dict.cases.reels.alts).toHaveLength(4);
    }
  });

  it("numbers: the §5 counter strip values, SSR'd as finals", () => {
    for (const dict of [uk, en]) {
      expect(dict.numbers.items.map((i) => i.value)).toEqual([27, 4.2, 850, 11]);
      expect(dict.numbers.items.map((i) => i.decimals)).toEqual([0, 1, 0, 0]);
    }
  });

  it("socials: curated framing «Найсоковитіше з @shur.shur.agency» + follow CTA", () => {
    expect(uk.socials.heading.toLowerCase()).toContain("@shur.shur.agency");
    expect(en.socials.heading.toLowerCase()).toContain("@shur.shur.agency");
    expect(uk.socials.ctaInstagram).toBe("Підписатися");
  });

  it("wall of love: 3 REAL community quotes, honestly sourced (§9: no fake social proof)", () => {
    for (const dict of [uk, en]) {
      expect(dict.socials.wallOfLove.quotes).toHaveLength(3);
      expect(dict.socials.wallOfLove.caption.length).toBeGreaterThan(10);
      for (const quote of dict.socials.wallOfLove.quotes) {
        expect(quote.source.length).toBeGreaterThan(5);
      }
    }
    // Verbatim comments from the appendix-verified team-intro post.
    const texts = uk.socials.wallOfLove.quotes.map((q) => q.text);
    expect(texts).toContain("Дай Боже");
    expect(texts.some((t) => t.includes("Горжусь"))).toBe(true);
  });
});

/* ============================================================
   PART B — proof layer components
   ============================================================ */
describe("cycle 3 — proof sections (brief §8 cycle 3)", () => {
  it("CountUp: IO-triggered, motion-gated, React-Compiler-safe (DOM refs, no setState)", () => {
    const src = read("../src/components/motion/CountUp.tsx");
    expect(src).toContain("IntersectionObserver");
    expect(src).toContain("(prefers-reduced-motion: no-preference)");
    expect(src).toContain("textContent");
    expect(src).not.toContain("useState");
    // SSR markup carries the FINAL value (SEO / no-js).
    expect(src).toMatch(/<span[^>]*>\s*\{format\(value, decimals\)\}\s*<\/span>/);
  });

  it("Numbers: dark statement strip with 4 giant cream count-ups", () => {
    const src = read("../src/components/sections/Numbers.tsx");
    expect(src).toContain("CountUp");
    expect(src).toContain("bg-cherry-deep");
    expect(src).toContain("sr-only");
    expect(src).toContain("text-cream-type");
  });

  it("Cases: photographic dark chapter — duotone bg, anchored, micro-CTAs to #contact", () => {
    const src = read("../src/components/sections/Cases.tsx");
    expect(src).toContain('id="cases"');
    expect(src).toContain("scroll-mt-20");
    expect(src).toContain("mix-blend-color");
    expect(src).not.toContain("/brand/smm.png");
    expect(src).toContain('href="#contact"');
    expect(src).toContain("PhoneReels");
    expect(src).toContain("knownHandles");
  });

  it("PhoneReels: CSS phone mockups, mobile snap-scroll, play + views stickers", () => {
    const src = read("../src/components/sections/PhoneReels.tsx");
    expect(src).toContain("overflow-x-auto");
    expect(src).toContain("snap-x");
    expect(src).toContain("aspect-[9/19.5]");
    expect(src).toContain("PlayIcon");
    expect(src).toMatch(/transition-\[rotate,translate\]/);
  });

  it("InstaGrid: 6 linked tiles from posts.ts with maroon hover overlay + tape frame", () => {
    const src = read("../src/components/sections/InstaGrid.tsx");
    expect(src).toContain("posts");
    expect(src).toContain('target="_blank"');
    expect(src).toContain("group-hover:opacity-100");
    expect(src).toContain("sizes=");
    expect(src).toContain("tape");
  });

  it("WallOfLove: crumpled paper notes with honest sourcing line", () => {
    const src = read("../src/components/sections/WallOfLove.tsx");
    expect(src).toContain("blockquote");
    expect(src).toContain("PaperCard");
  });

  it("Socials hosts the grid and the wall of love", () => {
    const src = read("../src/components/sections/Socials.tsx");
    expect(src).toContain("InstaGrid");
    expect(src).toContain("WallOfLove");
  });

  it("page rhythm: Services (paper) → Cases (photo dark) → Numbers (deep) → About (paper)", () => {
    const src = read("../src/app/[locale]/page.tsx");
    const order = ["<Services", "<Cases", "<Numbers", "<About"].map((tag) => src.indexOf(tag));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("header + footer navigate to #cases", () => {
    expect(read("../src/components/layout/Header.tsx")).toContain('"#cases"');
    expect(read("../src/components/layout/Footer.tsx")).toContain('"#cases"');
  });
});

/* ============================================================
   REM-FIX-C3 — cycle-3 review remediation (§9: honest social
   proof; hunter typography/a11y findings)
   ============================================================ */
describe("REM-FIX-C3 — §9 honest social proof", () => {
  it("case-card niches never deanonymize the verified «Нас знають» clients", () => {
    const ukNiches = uk.cases.items.map((i) => i.niche).join(" ");
    const enNiches = en.cases.items.map((i) => i.niche).join(" ");
    expect(ukNiches).not.toMatch(/текстил|теніс|одяг|радіо/i);
    expect(enNiches).not.toMatch(/textile|tennis|clothing|radio/i);
  });

  it("uses the brief §5 illustrative niche set", () => {
    expect(uk.cases.items.map((i) => i.niche)).toEqual([
      "Кав’ярня, Чернівці",
      "Салон краси",
      "Магазин товарів для дому",
      "Ресторан",
    ]);
  });

  it("cases sub frames the figures as typical format results, not «real client results»", () => {
    expect(uk.cases.sub).not.toContain("Реальні результати");
    expect(uk.cases.sub).toContain("Типові");
    expect(en.cases.sub).not.toMatch(/real client results/i);
    expect(en.cases.sub.toLowerCase()).toContain("typical");
  });

  it("spaced figures use NBSP, never a breaking space", () => {
    for (const dict of [uk, en]) {
      for (const item of dict.cases.items) {
        expect(item.value).not.toMatch(/\d \d/);
      }
    }
  });

  it("PhoneReels: no fabricated numeric view counts — non-numeric stickers only", () => {
    const src = read("../src/components/sections/PhoneReels.tsx");
    expect(src).not.toMatch(/\d+K/);
    expect(src).not.toContain("views:");
  });

  it("wall of love: verbatim appendix quotes («Дай Боже» unembellished, quote 3 marks truncation with «…»)", () => {
    for (const dict of [uk, en]) {
      const texts = dict.socials.wallOfLove.quotes.map((q) => q.text);
      expect(texts).toContain("Дай Боже");
      expect(texts).not.toContain("Дай Боже!");
      // The caption promises «дослівно» — the trailing ellipsis honestly
      // signals the excerpt is cut, not the post's full text (REM-FIX-C4).
      expect(texts).toContain(
        "Навчання з @lexi.brzvsk Кольорокорекція, робота зі стабілізатором, правильні налаштування камери…",
      );
    }
    expect(uk.socials.wallOfLove.quotes[2].source).toBe(
      "@pafos.art — допис про навчання з нашою командою",
    );
    expect(uk.socials.wallOfLove.caption).toContain("дописів");
  });
});

describe("REM-FIX-C3 — hunter typography/a11y fixes", () => {
  it("PhoneReels: scroller is a keyboard-reachable labelled region", () => {
    const src = read("../src/components/sections/PhoneReels.tsx");
    expect(src).toContain('role="region"');
    expect(src).toContain("tabIndex={0}");
    expect(src).toContain("aria-label={dict.kicker}");
  });

  it("InstaGrid: sizes capped at the real lg tile width", () => {
    const src = read("../src/components/sections/InstaGrid.tsx");
    expect(src).toContain(
      'sizes="(min-width: 1024px) 330px, (min-width: 640px) 33vw, 50vw"',
    );
  });

  it("Cases: micro-CTA carries niche context for screen readers", () => {
    const src = read("../src/components/sections/Cases.tsx");
    expect(src).toContain("aria-label={`${dict.micro} — ${item.niche}`}");
  });

  it("Numbers: suffix sized down so «4.2 млн» fits the lg column", () => {
    const src = read("../src/components/sections/Numbers.tsx");
    expect(src).not.toContain("text-[0.5em]");
    expect(src).toContain("text-[0.35em]");
  });
});
