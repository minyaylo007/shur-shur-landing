import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { uk } from "../src/dictionaries/uk";
import { en } from "../src/dictionaries/en";
import { he } from "../src/dictionaries/he";
import { ro } from "../src/dictionaries/ro";
import { locales } from "../src/lib/i18n";
import { workItems, workGroupOrder, itemsInGroup, processPair, heroVideo } from "../src/lib/work";

/*
 * Content integrity — every claim on the page traces back to something real.
 *
 * Cut from 26 to 10 assertions on 13.10.2026 (audit P-2026-10-13-03). Kept:
 * brief §16/§28 (no invented figures — the v1 placeholder metrics must not
 * come back), the owner's cleanup of 23.09.2026 (the «Нас знають» row and the
 * Instagram quotes stay removed), the portfolio rules that came from the
 * owner's own content passes, and the services that must not be silently
 * dropped. Assertions that pinned the same thing from several angles are one.
 */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const publicFile = (webPath: string) => fileURLToPath(new URL(`../public${webPath}`, import.meta.url));

const allDicts = [uk, en, he, ro];
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}
const allStrings = allDicts.flatMap(strings);
/* The only «+<digits>» in the dictionaries is the real phone number, pinned
   elsewhere; excluding it keeps «+4 180 підписників» detectable. */
const claims = allStrings.filter((s) => !s.includes("+380"));
const allMedia = [...workItems, processPair.bts, processPair.result, heroVideo];

describe("no invented numbers (brief §16, §28)", () => {
  it("the only figures in the copy are the three the agency reports about itself", () => {
    for (const dict of allDicts) expect(dict.trust.facts.map((f) => f.value)).toEqual(["11", "7", "3"]);
    const src = read("../src/components/sections/Trust.tsx");
    expect(src).toContain("§16"); // records WHY the v1 figures are absent
  });

  it("no percentage, multiplier, ROAS/CTR, millions, followers delta or K/M count in any locale", () => {
    for (const pattern of [/%/, /×|\bx\d|\d\s?x\b/i, /\b(roas|ctr|cpm|cpl|cac)\b/i, /млн|million|מיליון|milioane/i, /[+＋]\s?\d/, /\b\d+[KM]\b/]) {
      expect(claims.filter((s) => pattern.test(s)), String(pattern)).toEqual([]);
    }
  });

  it("no urgency theatre: no countdown copy and no interval to drive one", () => {
    for (const string of allStrings) expect(string).not.toMatch(/таймер|годин залишилось|hours left|hurry|осталось|places left/i);
    for (const file of ["../src/components/conversion/ContactBar.tsx", "../src/components/sections/AuditCta.tsx", "../src/components/forms/AuditForm.tsx"]) {
      expect(read(file)).not.toContain("setInterval");
    }
  });

  it("the proof blocks cut on 23.09.2026 stay cut: no keys, no strings, no module, no markup", () => {
    for (const dict of allDicts) expect([...Object.keys(dict.trust)].sort()).toEqual(["facts", "heading", "kicker", "paragraphs"]);
    for (const string of allStrings) {
      expect(string).not.toMatch(/Дай Боже|lexi\.brzvsk|@100fmcv|Нас знають|Known by|מכירים אותנו|Ne cunosc/i);
    }
    expect(existsSync(fileURLToPath(new URL("../src/lib/known.ts", import.meta.url)))).toBe(false);
    const src = read("../src/components/sections/Trust.tsx");
    expect(src).not.toContain("blockquote");
    expect(src).not.toMatch(/dict\.trust\.(knownBy|quotes)/);
  });
});

describe("portfolio data (brief §7–§13)", () => {
  it("five industry groups, rows that fill out, beauty pinned at eight, fashion alternating photo/video", () => {
    expect(workGroupOrder).toEqual(["beauty", "food", "fashion", "interior", "estate"]);
    expect(workItems.length).toBeLessThanOrEqual(32); // §9: curated, not an archive dump
    for (const group of workGroupOrder) {
      expect(itemsInGroup(group).length).toBeGreaterThan(0);
      expect(itemsInGroup(group).length % 4, group).not.toBe(1); // no orphan tile at four across
    }
    expect(itemsInGroup("beauty").slice(-2).map((i) => i.id)).toEqual(["reel-massage", "story-massage"]);
    expect(itemsInGroup("beauty")).toHaveLength(8);
    expect(itemsInGroup("fashion").map((i) => i.kind)).toEqual(["photo", "video", "photo", "video", "photo", "video", "photo", "video"]);
    expect(itemsInGroup("fashion").map((i) => i.id)).not.toContain("fashion-dress"); // removed 23.09.2026
  });

  it("every group is a short chip in every locale, and the work is framed as made FOR clients (§12)", () => {
    for (const dict of allDicts) {
      for (const group of workGroupOrder) {
        const label = dict.work.groups[group].label;
        expect(label.trim().split(/\s+/).length).toBeLessThanOrEqual(2);
        expect(label.length).toBeLessThanOrEqual(16);
        expect(label).not.toMatch(/[.,;:!?]/);
      }
    }
    expect(uk.work.note).toContain("клієнт");
    expect(en.work.note.toLowerCase()).toContain("client");
    expect(he.work.note).toContain("לקוח");
    expect(ro.work.note.toLowerCase()).toContain("clien");
  });

  it("every tile is localized — real alt text in all four locales, not copy-pasted Ukrainian", () => {
    for (const item of allMedia) {
      for (const locale of locales) expect(item.alt[locale].length).toBeGreaterThan(10);
      expect(item.alt.en).not.toBe(item.alt.uk);
      expect(item.alt.he).not.toBe(item.alt.uk);
      expect(item.alt.ro).not.toBe(item.alt.uk);
    }
  });

  it("every media file ships in /public as WebP/MP4, declares intrinsic 9:16 size; the process pair is one shoot", () => {
    for (const item of allMedia) {
      expect(existsSync(publicFile(item.src)), item.src).toBe(true);
      if (item.kind === "photo") {
        expect(item.src).toMatch(/^\/work\/photo\/[a-z0-9-]+\.webp$/);
      } else {
        expect(item.src).toMatch(/^\/work\/video\/[a-z0-9-]+\.mp4$/);
        expect(item.poster).toMatch(/^\/work\/poster\/[a-z0-9-]+\.webp$/);
        expect(existsSync(publicFile(item.poster)), item.poster).toBe(true);
      }
      expect(item.width).toBeGreaterThan(0);
      expect(item.height / item.width).toBeGreaterThan(1.3);
    }
    expect(processPair.bts.group).toBe(processPair.result.group);
    expect(processPair.bts.kind).toBe("video");
    expect(processPair.result.kind).toBe("photo");
  });
});

describe("services (brief §15) — grouped, nothing invented, nothing dropped", () => {
  it("four categories × three points in every locale; the seven real v1 lines survive; «7 напрямів» stays true", () => {
    for (const dict of allDicts) {
      expect(dict.services.items).toHaveLength(4);
      const points = dict.services.items.flatMap((i) => i.points);
      expect(points).toHaveLength(12);
      expect(new Set(points).size).toBe(points.length);
      for (const item of dict.services.items) {
        expect(item.tagline.length).toBeGreaterThan(10);
        expect(item.points.length).toBe(3);
      }
    }
    const ukPoints = uk.services.items.flatMap((i) => i.points).join(" | ").toLowerCase();
    for (const line of ["мобільна", "модел", "монтаж", "reels", "стратегі", "telegram ads", "motion", "сайт", "бот", "crm"]) {
      expect(ukPoints).toContain(line);
    }
    expect(uk.trust.facts[1]).toEqual({ value: "7", label: "напрямів послуг" });
  });

  it("the disclosure is HTML, not a scroll-jacking track (brief §14)", () => {
    const src = read("../src/components/sections/Services.tsx");
    expect(src).toContain("<details");
    expect(src).toContain("<summary");
    expect(src).not.toMatch(/ScrollTrigger|gsap/);
  });
});
