import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { uk } from "../src/dictionaries/uk";
import { en } from "../src/dictionaries/en";
import { he } from "../src/dictionaries/he";
import { ro } from "../src/dictionaries/ro";
import { locales } from "../src/lib/i18n";
import { knownHandles } from "../src/lib/posts";
import { workItems, workGroupOrder, itemsInGroup, processPair, heroVideo } from "../src/lib/work";

/*
 * Content integrity — every claim on the page traces back to something real.
 *
 * History: this file is `tests/redesign-cycle3.test.ts`, renamed. Its
 * `lib/posts.ts` assertions (the four verified «Нас знають» accounts) are
 * kept as they were. Everything else in cycle 3 guarded content that v2
 * deleted rather than restyled — the four «кейси» metric cards (+4 180, ×3.2,
 * 215, 4.7%) and the aggregate counters (27 / 4.2 млн / 850+). Those were
 * marked in the v1 source itself as an illustrative placeholder set, and
 * brief §16/§28 forbid presenting unverified figures as client results, so
 * the assertions that pinned their exact wording are replaced by assertions
 * that no such figure can come back unnoticed.
 *
 * The wall-of-love quotes moved from `socials.wallOfLove.quotes` to
 * `trust.quotes.items` when the four proof sections merged into one; their
 * verbatim-ness is still asserted below, at the new path.
 */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const publicFile = (webPath: string) =>
  fileURLToPath(new URL(`../public${webPath}`, import.meta.url));

/** Every shipped dictionary — a new locale joins these assertions by itself. */
const allDicts = [uk, en, he, ro];

/** Every visible string in a dictionary, flattened. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const allStrings = allDicts.flatMap(strings);

/* The numeric guards below run over the copy MINUS anything containing the
   agency's own country code. The only «+<digits>» in the dictionaries is the
   real phone number and its placeholder, which conversion.test.ts pins to
   lib/site; excluding it here keeps «+4 180 підписників» detectable. */
const claims = allStrings.filter((s) => !s.includes("+380"));

describe("no invented numbers (brief §16, §28)", () => {
  it("the only figures in the copy are the three the agency reports about itself", () => {
    for (const dict of allDicts) {
      expect(dict.trust.facts.map((f) => f.value)).toEqual(["11", "7", "3"]);
    }
  });

  it.each([
    ["a percentage", /%/],
    ["a multiplier", /×|\bx\d|\d\s?x\b/i],
    ["a ROAS/CTR/CPM claim", /\b(roas|ctr|cpm|cpl|cac)\b/i],
    ["a millions-of-views claim", /млн|million|מיליון|milioane/i],
    ["a followers/leads delta", /[+＋]\s?\d/],
    ["a K/M shorthand count", /\b\d+[KM]\b/],
  ])("no dictionary string carries %s", (_label, pattern) => {
    const offenders = claims.filter((s) => pattern.test(s));
    expect(offenders).toEqual([]);
  });

  it("no urgency theatre: no countdown, no «залишилось N місць»", () => {
    for (const string of allStrings) {
      expect(string).not.toMatch(/таймер|годин залишилось|hours left|hurry|осталось|places left/i);
    }
    // …and no machinery to drive one.
    for (const file of [
      "../src/components/conversion/ContactBar.tsx",
      "../src/components/sections/AuditCta.tsx",
      "../src/components/forms/AuditForm.tsx",
    ]) {
      expect(read(file)).not.toContain("setInterval");
    }
  });

  it("Trust.tsx records WHY the v1 figures are absent, so nobody restores them by accident", () => {
    const src = read("../src/components/sections/Trust.tsx");
    expect(src).toContain("§16");
    expect(src).toContain("placeholder");
  });
});

describe("social proof is verbatim, not manufactured (brief §28)", () => {
  it("three real Instagram quotes, unembellished, in every locale", () => {
    for (const dict of allDicts) {
      const texts = dict.trust.quotes.items.map((q) => q.text);
      expect(texts).toHaveLength(3);
      expect(texts).toContain("Дай Боже");
      expect(texts).not.toContain("Дай Боже!");
      // The caption promises «дослівно» — the trailing ellipsis honestly
      // signals the third quote is an excerpt, not the post's full text.
      expect(texts).toContain(
        "Навчання з @lexi.brzvsk Кольорокорекція, робота зі стабілізатором, правильні налаштування камери…",
      );
      for (const quote of dict.trust.quotes.items) {
        expect(quote.source.length).toBeGreaterThan(5);
      }
    }
  });

  it("quotes stay Ukrainian in every locale, so they render with dir=\"auto\"", () => {
    for (const dict of allDicts) {
      expect(dict.trust.quotes.items.map((q) => q.text)).toEqual(
        uk.trust.quotes.items.map((q) => q.text),
      );
    }
    expect(read("../src/components/sections/Trust.tsx")).toContain('blockquote dir="auto"');
  });

  it("knownHandles: the four verified accounts, linked to Instagram", () => {
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

  it("«Нас знають» names line up 1:1 with those handles in every locale", () => {
    for (const dict of allDicts) {
      expect(dict.trust.knownBy.names).toHaveLength(knownHandles.length);
      for (const name of dict.trust.knownBy.names) expect(name.length).toBeGreaterThan(2);
    }
  });
});

describe("portfolio data (brief §7–§13)", () => {
  /* v3 §9: the re-synced Drive folder added whole industries the site could
     not show before, so the clusters are now by INDUSTRY rather than by
     format. A visitor recognises their own business in a row of tiles. */
  it("curates five industry groups, each with something in it", () => {
    expect(workGroupOrder).toEqual(["beauty", "food", "fashion", "interior", "estate"]);
    for (const group of workGroupOrder) {
      expect(itemsInGroup(group).length).toBeGreaterThan(0);
    }
    // §9: curated, not an archive dump — 30 of the 43 shared files.
    expect(workItems.length).toBeLessThanOrEqual(32);
  });

  it("every group key is a short one-word chip in every locale", () => {
    for (const dict of allDicts) {
      for (const group of workGroupOrder) {
        const label = dict.work.groups[group].label;
        expect(label.length).toBeGreaterThan(2);
        /* §8: a chip, not a sentence. Two words is the ceiling — English
           «REAL ESTATE» has no shorter honest form — and there is no
           punctuation, which is what turns a label into prose. */
        expect(label.trim().split(/\s+/).length).toBeLessThanOrEqual(2);
        expect(label.length).toBeLessThanOrEqual(16);
        expect(label).not.toMatch(/[.,;:!?]/);
      }
    }
  });

  it("§12: the portfolio is framed as work made FOR clients — once, in every locale", () => {
    /* These are finished client creatives with client branding inside the
       frame. Without the framing they read as the agency's own promo. v3
       says it ONE time for the whole section instead of under every row. */
    expect(uk.work.note).toContain("клієнт");
    expect(en.work.note.toLowerCase()).toContain("client");
    expect(he.work.note).toContain("לקוח");
    // «clienți», not «clients» — match the stem, not an English spelling.
    expect(ro.work.note.toLowerCase()).toContain("clien");
  });

  it("every tile is localized — alt text in all four locales, no placeholders", () => {
    for (const item of [...workItems, processPair.bts, processPair.result, heroVideo]) {
      for (const locale of locales) {
        expect(item.alt[locale].length).toBeGreaterThan(10);
      }
      // Alts must actually differ per language, not be copy-pasted Ukrainian.
      expect(item.alt.en).not.toBe(item.alt.uk);
      expect(item.alt.he).not.toBe(item.alt.uk);
      expect(item.alt.ro).not.toBe(item.alt.uk);
    }
  });

  it("every media file referenced actually ships in /public", () => {
    for (const item of [...workItems, processPair.bts, processPair.result, heroVideo]) {
      expect(existsSync(publicFile(item.src))).toBe(true);
      if (item.kind === "video") expect(existsSync(publicFile(item.poster))).toBe(true);
    }
  });

  it("no original upload leaks into prod: WebP stills, MP4 loops, WebP posters", () => {
    for (const item of [...workItems, processPair.bts, processPair.result, heroVideo]) {
      if (item.kind === "photo") {
        expect(item.src).toMatch(/^\/work\/photo\/[a-z0-9-]+\.webp$/);
      } else {
        expect(item.src).toMatch(/^\/work\/video\/[a-z0-9-]+\.mp4$/);
        expect(item.poster).toMatch(/^\/work\/poster\/[a-z0-9-]+\.webp$/);
      }
    }
  });

  it("every tile declares intrinsic size, and all of it is 9:16 portrait", () => {
    for (const item of [...workItems, processPair.bts, processPair.result, heroVideo]) {
      expect(item.width).toBeGreaterThan(0);
      expect(item.height).toBeGreaterThan(item.width);
      // The whole archive is Instagram-native vertical; the grid is built for
      // it rather than cropping tall footage into wide boxes.
      expect(item.height / item.width).toBeGreaterThan(1.3);
    }
  });

  it("the process→result pair is the same shoot, so it belongs to one group", () => {
    expect(processPair.bts.group).toBe(processPair.result.group);
    expect(processPair.bts.kind).toBe("video");
    expect(processPair.result.kind).toBe("photo");
  });
});

describe("services (brief §15) — grouped, nothing invented, nothing dropped", () => {
  it("four categories in every locale, each with a tagline and its bullets", () => {
    for (const dict of allDicts) {
      expect(dict.services.items).toHaveLength(4);
      for (const item of dict.services.items) {
        expect(item.title.length).toBeGreaterThan(3);
        expect(item.tagline.length).toBeGreaterThan(10);
        expect(item.points.length).toBe(3);
      }
    }
  });

  it("the seven real v1 service lines all survive inside the four groups", () => {
    /* v1 shipped seven cards; §15 asked for 3–5 categories WITHOUT inventing
       or deleting services. v3 §8 then MERGED the 22 bullets into 12 — the
       micro-services that used to be ranked alongside whole directions now
       sit inside the line they belong to, so the proof that nothing was
       dropped is no longer the count but the keywords below. */
    for (const dict of allDicts) {
      const points = dict.services.items.flatMap((i) => i.points);
      expect(points).toHaveLength(12);
      expect(new Set(points).size).toBe(points.length);
    }
    const ukPoints = uk.services.items.flatMap((i) => i.points).join(" | ").toLowerCase();
    for (const line of [
      "мобільна", // mobile shoot — was its own v1 card
      "модел", // model casting
      "монтаж", // editing
      "reels",
      "стратегі", // strategy / consulting
      "telegram ads",
      "motion",
      "сайт", // websites & shops
      "бот", // chat-bots
      "crm",
    ]) {
      expect(ukPoints).toContain(line);
    }
    // trust.facts still says «7 напрямів послуг» — that claim must stay true.
    expect(uk.trust.facts[1]).toEqual({ value: "7", label: "напрямів послуг" });
  });

  it("the disclosure is HTML, not a scroll-jacking track (brief §14)", () => {
    const src = read("../src/components/sections/Services.tsx");
    expect(src).toContain("<details");
    expect(src).toContain("<summary");
    expect(src).not.toContain("ScrollTrigger");
    expect(src).not.toContain("gsap");
  });
});
