import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { uk } from "../src/dictionaries/uk";
import { en } from "../src/dictionaries/en";
import { he } from "../src/dictionaries/he";
import { ro } from "../src/dictionaries/ro";
import { locales } from "../src/lib/i18n";
import { site, messengers } from "../src/lib/site";
import {
  MESSENGER_ORDER,
  isChannelReady,
  localeChannels,
  readyChannel,
  primaryAction,
  CONTACT_ANCHOR,
} from "../src/lib/channels";

/*
 * Conversion path — ONE main action, one form, one endpoint.
 *
 * History: this file is `tests/redesign-cycle4.test.ts`, renamed once already
 * when `MessengerFab` + `StickyCta` merged into `ContactBar`.
 *
 * v3 rewrote what it guards, because the v2 conversion architecture was the
 * thing under review — but it rewrote it against a `main` that had moved
 * underneath it, so the merge of 21.09 keeps BOTH contracts:
 *
 *  §3 Viber. The branch removed it, saying the channel does not exist. It
 *     does: it is live in production on the same number as WhatsApp, and the
 *     form's deliveries are currently not reaching Telegram at all, so a live
 *     way to reach a human is not something to switch off. The branch's «Viber
 *     is gone» test is therefore replaced by its opposite — the channel exists
 *     EVERYWHERE or nowhere: lib/site, the gate's order, the icon map, the
 *     four dictionaries. Half a channel is the failure mode worth a test.
 *  §4 The phone is no longer a conversion. It appears exactly once, in the
 *     footer, as a detail — plus once as the accessible name of the tel: link
 *     inside the form's failure state, which is a way out of a dead end and
 *     not a competing action. The old "reachable from everywhere" suite
 *     asserted the opposite, so it is inverted here rather than deleted: the
 *     number must NOT come back to the header, the hero, the contact section
 *     or the sticky control.
 *  §6 One primary action («Обговорити проєкт» → WhatsApp), Telegram second,
 *     Instagram a portfolio link. Three equal buttons are forbidden. The
 *     action resolves through `primaryAction()`, i.e. through the same
 *     readiness gate as every other link — it can degrade to #contact, it can
 *     never become a link to nowhere.
 *  §7 Telegram's address was never confirmed, so `ready: false` keeps it out
 *     of the DOM. "Every channel is ready" is therefore no longer true — the
 *     assertion becomes "nothing unready renders".
 *
 * The readiness contract below (the tree walk, the two gate files, the
 * deep-link literal count) is production's and is kept verbatim: it is the
 * thing that closed the dead t.me link on the first screen.
 */

const srcPath = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel: string) => readFileSync(srcPath(rel), "utf8");

const allDicts = [uk, en, he, ro];

/**
 * Every source file under `src/`, as repo-relative paths. Walked, not listed:
 * the first version of the readiness test named the four components it knew
 * about, so the fifth render site — the hero — sailed straight past it and
 * kept a dead t.me link on the first screen of all four locales.
 */
function sourceFiles(dir = "../src"): string[] {
  return readdirSync(srcPath(dir), { withFileTypes: true }).flatMap((entry) => {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(child);
    return /\.tsx?$/.test(entry.name) ? [child.replace("../", "")] : [];
  });
}

/**
 * The file with comments removed, so «this block used to read site.socials.*»
 * in a comment is not mistaken for code. Quote-aware on purpose: the thing
 * being searched for is a URL, and a naive strip of `//` would cut every
 * `https://` in half.
 */
function stripComments(src: string): { code: string; balanced: boolean } {
  let out = "";
  let quote: string | null = null;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (quote !== null) {
      if (ch === "\\") { out += ch + (next ?? ""); i += 2; continue; }
      if (ch === quote) quote = null;
      out += ch; i += 1; continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; out += ch; i += 1; continue; }
    if (ch === "/" && next === "/") { while (i < src.length && src[i] !== "\n") i += 1; continue; }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i += 1;
      i += 2; continue;
    }
    out += ch; i += 1;
  }
  return { code: out, balanced: quote === null };
}

const codeOf = (repoPath: string) => stripComments(read(`../${repoPath}`)).code;



/** Every visible string under a dictionary branch, flattened. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

/** Everywhere the phone is NOT allowed to reappear (§4). */
const NOT_THE_PHONE = [
  ["header", "../src/components/layout/Header.tsx"],
  ["hero", "../src/components/sections/Hero.tsx"],
  ["contact section", "../src/components/sections/AuditCta.tsx"],
  ["contact bar", "../src/components/conversion/ContactBar.tsx"],
] as const;

describe("lib/site — the one real phone number, demoted (v3 §4)", () => {
  it("still exists, still real, still a tel: link", () => {
    expect(site.phone.e164).toBe("+380972499107");
    expect(site.phone.tel).toBe("tel:+380972499107");
  });

  it("the displayed number is the same digits, grouped with NBSPs so it never wraps", () => {
    expect(site.phone.display.replace(/\s/gu, "")).toBe(site.phone.e164);
    // NBSP (U+00A0), not a plain space: the groups must never wrap apart.
    expect(site.phone.display).toContain("\u00a0");
  });

  it("nothing was invented: wa.me carries that same number", () => {
    const digits = site.phone.e164.replace("+", "");
    expect(site.socials.whatsapp).toBe(`https://wa.me/${digits}`);
    expect(read("../src/lib/site.ts")).not.toContain("380000000000");
  });

  it("Viber reaches that same number, and is not a second phone number", () => {
    // `%2B` — the deep-link carries the «+» percent-encoded inside a query.
    const digits = site.phone.e164.replace("+", "");
    expect(site.socials.viber).toBe(`viber://chat?number=%2B${digits}`);
  });

  /*
   * Viber, whole or not at all. The branch deleted the channel on the grounds
   * that it does not exist in the project; it does exist, in production, on
   * the agency's own number, and it was kept on 21.09 precisely because the
   * form's deliveries are down. What a merge CAN leave behind is half of it —
   * a key in lib/site with no dictionary label, or an icon nothing can reach.
   * So the test is the shape, not the opinion: every layer or no layer.
   */
  it("a channel exists in every layer or in none — no orphaned halves", () => {
    const icons = codeOf("src/components/ui/icons.tsx");
    const iconMap = icons.match(/CHANNEL_ICONS = \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(iconMap).not.toBe("");

    for (const key of Object.keys(messengers) as (keyof typeof messengers)[]) {
      // lib/site knows it → the gate's order lists it, in every locale …
      for (const locale of locales) expect(MESSENGER_ORDER[locale]).toContain(key);
      // … something can draw it …
      expect(iconMap).toContain(key);
      // … and every locale can name it.
      for (const dict of allDicts) {
        expect(dict.contactBar.channels[key].length).toBeGreaterThan(3);
      }
    }
    // And nothing in the order table is a channel lib/site never heard of.
    for (const locale of locales) {
      for (const key of MESSENGER_ORDER[locale]) expect(messengers).toHaveProperty(key);
    }
  });

  it("§7: an unconfirmed address is OFF, and the guard is a flag, not a comment", () => {
    expect(messengers.telegram.ready).toBe(false);
    expect(messengers.whatsapp.ready).toBe(true);
    expect(messengers.instagram.ready).toBe(true);
  });

  it("the Instagram DM deep-link is the official ig.me form", () => {
    expect(site.socials.instagramDm).toBe("https://ig.me/m/shur.shur.agency");
  });

  it("§6: one primary action, it goes through the gate, and it is never dead", () => {
    const primary = primaryAction();
    expect(primary.key).toBe("whatsapp");
    expect(primary.href).toBe(messengers.whatsapp.href);
    expect(messengers.whatsapp.ready).toBe(true);
    expect(primary.external).toBe(true);
    // The degraded destination exists as a real anchor on the page, so the
    // day WhatsApp goes not-ready the main action still lands somewhere.
    expect(CONTACT_ANCHOR).toBe("#contact");
    expect(read("../src/components/sections/AuditCta.tsx")).toContain('id="contact"');
  });
});

/*
 * The readiness contract, and why it is tested by walking the tree rather
 * than by naming files. `ready: false` means «this account is not real yet,
 * render it nowhere». Before 15.09.2026 exactly one of the FIVE places that
 * print a messenger link honoured it. The first fix listed the three it knew
 * about and checked those three — and the hero, which nobody had listed, went
 * on printing a Telegram username that was never registered on the first
 * screen of every locale. A test that enumerates render sites can only ever
 * find the render sites someone remembered.
 *
 * So the rule is structural and the check is exhaustive: outside the TWO files
 * that are the gate itself the raw constants are unreachable — no
 * `site.socials`, no `messengers`, no deep-link literal — and the only way to
 * a channel's link OR its visible @name is `lib/channels`, which hands out
 * neither until the flag is true. Add a sixth render site tomorrow and it is
 * covered the moment it is saved.
 *
 * The allowlist used to be the whole of `src/lib`, and that was a hole with a
 * body in it. `src/lib` is not only the gate: it is also where the page's data
 * lives (`work.ts`, `known.ts`), and a data module is a render site wearing a
 * different hat. `lib/posts.ts` proved it — three tiles of its Instagram grid
 * took `site.socials.instagram` straight, past `isChannelReady`, and this scan
 * waved them through by address. The exemption is now the two files that ARE
 * the contract, named one by one.
 */
describe("readiness contract — a channel that is not ready renders NOWHERE", () => {
  /**
   * The only two files allowed to touch the raw constants: the constants
   * themselves, and the accessor that guards them. Everything else in `src/**`
   * — components and the rest of `src/lib` alike — goes through `lib/channels`.
   */
  const GATE_FILES = ["src/lib/site.ts", "src/lib/channels.ts"];


  it("lib/channels drops every not-ready channel, in every locale", () => {
    for (const locale of locales) {
      const rendered = localeChannels(locale).map((channel) => channel.key);
      const expected = MESSENGER_ORDER[locale].filter((key) => messengers[key].ready);
      // Same members, same order — the gate filters, it does not reshuffle.
      expect(rendered).toEqual(expected);
      for (const key of rendered) expect(messengers[key].ready).toBe(true);
    }
  });

  it("isChannelReady is the flag itself, not a copy that can drift", () => {
    for (const key of Object.keys(messengers) as (keyof typeof messengers)[]) {
      expect(isChannelReady(key)).toBe(messengers[key].ready);
    }
  });

  it("a channel that is not ready leaks no href into any locale's list", () => {
    const notReady = (Object.keys(messengers) as (keyof typeof messengers)[]).filter(
      (key) => !messengers[key].ready,
    );
    for (const locale of locales) {
      const hrefs = localeChannels(locale).map((channel) => channel.href);
      for (const key of notReady) expect(hrefs).not.toContain(messengers[key].href);
    }
  });

  it("readyChannel hands out nothing at all for a channel that is not ready", () => {
    for (const key of Object.keys(messengers) as (keyof typeof messengers)[]) {
      const channel = readyChannel(key);
      if (messengers[key].ready) {
        expect(channel).not.toBeNull();
        expect(channel?.href).toBe(messengers[key].href);
      } else {
        // Not «an object with the link and a false flag» — nothing. The link
        // and the @name are equally unavailable, so a caller cannot print the
        // name of an account it was not allowed to link to.
        expect(channel).toBeNull();
      }
    }
  });

  // --- the exhaustive part: every file under src/, derived by walking ------

  it("the scan really covers the tree it claims to cover", () => {
    const files = sourceFiles();
    // A vacuous pass is the one failure mode a scan like this can hide.
    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain("src/components/sections/Hero.tsx");
    expect(files).toContain("src/components/layout/Footer.tsx");
    for (const file of files) expect(stripComments(read(`../${file}`)).balanced).toBe(true);
  });

  it("the gate allowlist names files that exist — a rename cannot widen it", () => {
    // An exemption for a path that is no longer there would silently start
    // exempting nothing, or worse, keep exempting a file someone recreated.
    const files = sourceFiles();
    for (const file of GATE_FILES) expect(files).toContain(file);
  });

  it("NO file but the gate itself reads site.socials or messengers directly", () => {
    const offenders = sourceFiles()
      .filter((file) => !GATE_FILES.includes(file))
      .filter((file) => /\bsite\.socials\b|\bmessengers\b/.test(codeOf(file)));
    // Empty array, not a boolean: a failure has to name the file.
    expect(offenders).toEqual([]);
  });

  it("a messenger deep-link exists as a literal in exactly ONE file", () => {
    const deepLink = /https:\/\/t\.me\/|https:\/\/wa\.me\/|https:\/\/ig\.me\/|viber:\/\//;
    const carriers = sourceFiles().filter((file) => deepLink.test(codeOf(file)));
    expect(carriers).toEqual(["src/lib/site.ts"]);
  });

  it("anything that draws a messenger icon got the channel from the gate", () => {
    const drawing = sourceFiles().filter((file) => /CHANNEL_ICONS\[/.test(codeOf(file)));
    expect(drawing.length).toBeGreaterThan(0);
    for (const file of drawing) {
      expect(codeOf(file)).toMatch(/localeChannels|readyChannel|isChannelReady/);
    }
  });

  it("telegram specifically: the username is unregistered, so it is not ready", () => {
    // Flip this the day the client names a real channel — and only then.
    expect(messengers.telegram.ready).toBe(false);
  });
});

/*
 * §4 — the phone, demoted rather than deleted.
 *
 * Production asserted the opposite of this block: «the phone is reachable from
 * everywhere it should be», over header, hero, contact section, footer and the
 * sticky bar. v3 §4 takes the number off four of those five, so that suite is
 * inverted here instead of being dropped — the same five files are still named,
 * and each one is still checked, only the direction of the claim changed. What
 * production was really protecting is the last line of it: the number does not
 * vanish from the page. That is asserted twice below, positively.
 */
describe("§4 — the phone is a footer detail and a way out, nothing else", () => {
  it.each(NOT_THE_PHONE)("%s offers no call", (_where, path) => {
    const src = read(path);
    expect(src).not.toContain("site.phone");
    expect(src).not.toContain("tel:");
  });

  it("the footer carries it exactly once, pinned LTR, and says why", () => {
    const src = read("../src/components/layout/Footer.tsx");
    expect(src.match(/site\.phone\.tel/g)).toHaveLength(1);
    expect(src).toContain("site.phone.display");
    expect(src).toContain('dir="ltr"');
    expect(src).toContain("§4");
  });

  /*
   * The second place, and the reason `nav.callLabel` did not leave with the
   * header button. A failed submission offers the phone as a way out of the
   * dead end (a 15.09 production fix, checked in tests/lead-failures too), and
   * that link needs an accessible name — the visible text is the number
   * itself, which a screen reader reads as digits. So the string stays in all
   * four dictionaries, invisible, and this test pins it to that one use: if it
   * ever becomes a visible button again, the §4 block above fails first.
   */
  it("the form's failure state can still call, and the label is its accessible name", () => {
    const src = read("../src/components/forms/AuditForm.tsx");
    expect(src).toContain("site.phone.tel");
    expect(src).toContain("callLabel");
    expect(src).toMatch(/aria-label=\{callLabel\}/);
    for (const dict of allDicts) {
      expect(dict.nav.callLabel.length).toBeGreaterThan(3);
    }
  });
});

describe("§6 — one main action, worded identically everywhere", () => {
  it("header, hero and contact section all fire the SAME primary channel", () => {
    for (const path of [
      "../src/components/layout/Header.tsx",
      "../src/components/sections/Hero.tsx",
      "../src/components/sections/AuditCta.tsx",
    ]) {
      const src = read(path);
      expect(src).toContain("primaryAction()");
      // Deep-links are never hand-written next to the one source of truth.
      expect(src).not.toContain("wa.me");
    }
  });

  it("the label is one string in every locale — nav.cta === hero.cta === contactBar.open", () => {
    for (const dict of allDicts) {
      expect(dict.hero.cta).toBe(dict.nav.cta);
      expect(dict.contactBar.open).toBe(dict.nav.cta);
      expect(dict.nav.cta.length).toBeGreaterThan(5);
    }
  });

  it("the hero carries exactly ONE filled button, and its partner is a plain anchor", () => {
    const src = read("../src/components/sections/Hero.tsx");
    expect(src.match(/buttonClass\(/g)).toHaveLength(1);
    expect(src).not.toContain("<ButtonLink");
    expect(src).toContain('hash="#work"');
  });

  it("the contact section does not line up three equal buttons", () => {
    const src = read("../src/components/sections/AuditCta.tsx");
    // One filled button. Telegram (when ready) and Instagram are text links.
    expect(src.match(/buttonClass\(/g)).toHaveLength(1);
    /* Both accounts come from the gate, not from the constants: production
       moved this section behind `readyChannel` on 15.09, and reaching for
       `messengers.telegram.ready` / `site.socials.instagram` here would now be
       caught by the tree walk above anyway. */
    expect(src).toContain('readyChannel("telegram")');
    expect(src).toContain('readyChannel("instagram")');
  });
});

describe("ContactBar — ONE persistent control (brief §19; v3 §4, §6, §7)", () => {
  const src = read("../src/components/conversion/ContactBar.tsx");

  it("replaced both floating widgets: MessengerFab and StickyCta are gone", () => {
    expect(existsSync(srcPath("../src/components/conversion/MessengerFab.tsx"))).toBe(false);
    expect(existsSync(srcPath("../src/components/conversion/StickyCta.tsx"))).toBe(false);
    const page = read("../src/app/[locale]/page.tsx");
    expect(page.match(/<ContactBar/g)).toHaveLength(1);
  });

  it("orders channels by locale: uk → Telegram first, everyone else → WhatsApp first", () => {
    // The order moved to lib/channels when the footer, the contact section and
    // the form's error state had to obey the same list. Wish order, before the
    // readiness gate — hence the source of the table, not localeChannels().
    const order = read("../src/lib/channels.ts").match(/const MESSENGER_ORDER[\s\S]*?\n\};/)?.[0] ?? "";
    expect(order).toMatch(/uk:\s*\["telegram"/);
    // Every non-Ukrainian locale must be listed explicitly and lead with WhatsApp.
    for (const code of locales.filter((l) => l !== "uk")) {
      expect(order).toMatch(new RegExp(`${code}:\\s*\\["whatsapp"`));
    }
    expect(read("../src/lib/channels.ts")).toMatch(/MESSENGER_ORDER\[locale\]/);
    expect(src).toMatch(/localeChannels\(locale\)/);
  });

  /*
   * Production asserted «the phone sits above the messengers» here — it was
   * the first row of the panel. v3 §4 takes the phone out of the bar, so the
   * assertion cannot be kept as written; kept as written it would also pass
   * vacuously (indexOf returns -1, which is below everything). What it was
   * really guarding is that the panel's leading row is a deliberate choice and
   * not whatever order the component felt like. That is now the locale table's
   * job, and this checks the component does not quietly override it.
   */
  it("the panel leads with the locale's own first ready channel — nothing is reordered here", () => {
    expect(src).toMatch(/ready\.map\(/);
    // The table lives in lib/channels; a second copy here is how the two drift.
    expect(src).not.toContain("MESSENGER_ORDER");
    expect(src).not.toMatch(/\.sort\(|\.reverse\(/);
  });

  it("filters channels by the ready flag (behaviour, not a comment)", () => {
    // Asserted by what comes out, not by the shape of the line that does it.
    for (const locale of locales) {
      for (const channel of localeChannels(locale)) {
        expect(isChannelReady(channel.key)).toBe(true);
      }
    }
    expect(src).toMatch(/if \(ready\.length === 0\) return null;/);
    expect(src).not.toContain("wa.me");
  });

  it("one ready channel ⇒ the pill IS the link: no sheet costing a tap to say nothing", () => {
    expect(src).toMatch(/const single = ready\.length === 1 \? ready\[0\] : null;/);
    // The two-channel disclosure is still there for the day Telegram lands.
    expect(src).toContain("aria-expanded");
    expect(src).toContain("aria-controls");
  });

  it("both branches meet the touch-target floor", () => {
    expect(src.match(/min-h-12/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("is scroll-gated past the hero via IntersectionObserver", () => {
    expect(src).toContain("IntersectionObserver");
    expect(src).toContain('"#top"');
  });

  it("disclosure a11y: Escape close + focus return, outside pointer", () => {
    expect(src).toContain('"Escape"');
    expect(src).toMatch(/buttonRef\.current\?\.focus\(\)/);
    expect(src).toContain("pointerdown");
    expect(src).toMatch(/contains\(document\.activeElement\)/);
  });

  it("hidden state is non-interactive (inert + pointer-events) and z sits below the header", () => {
    expect(src).toContain("inert={!visible}");
    expect(src).toContain("pointer-events-none");
    expect(src).toContain("z-40");
  });

  it("sits in the inline-end corner, clear of the iOS home indicator", () => {
    expect(src).toContain("end-4");
    expect(src).toContain("bottom-[calc(1rem+env(safe-area-inset-bottom))]");
    expect(src).not.toMatch(/\bright-4\b/);
  });

  it("external links are safe; the trigger is a labelled pill, not a bare circle", () => {
    expect(src).toContain('rel="noopener noreferrer"');
    for (const dict of allDicts) {
      expect(dict.contactBar.open.length).toBeGreaterThan(3);
      expect(dict.contactBar.close.length).toBeGreaterThan(3);
      expect(dict.contactBar.label.length).toBeGreaterThan(3);
      for (const key of ["telegram", "whatsapp", "instagram"] as const) {
        expect(dict.contactBar.channels[key].length).toBeGreaterThan(3);
      }
    }
  });
});

describe("§12 — the analytics layer is wired, with no provider shipped", () => {
  it("no third-party tag was added to the project", () => {
    const layout = read("../src/app/[locale]/layout.tsx");
    for (const vendor of ["gtag", "googletagmanager", "plausible", "posthog", "fbq", "hotjar"]) {
      expect(layout.toLowerCase()).not.toContain(vendor);
    }
  });

  it("track() is a no-op without a sink and can never break a click", () => {
    const src = read("../src/lib/analytics.ts");
    expect(src).toContain("window.shurTrack?.(event)");
    expect(src).toMatch(/typeof window === "undefined"/);
    expect(src).toContain("catch");
  });

  it("every contact surface reports channel + locale + placement", () => {
    for (const path of [
      "../src/components/conversion/ContactLink.tsx",
      "../src/components/conversion/ContactBar.tsx",
    ]) {
      const src = read(path);
      expect(src).toContain('name: "contact_click"');
      expect(src).toContain("channel");
      expect(src).toContain("locale");
      expect(src).toContain("placement");
    }
    // The four placements the page actually has are all in use.
    const used = [
      "../src/components/layout/Header.tsx",
      "../src/components/sections/Hero.tsx",
      "../src/components/conversion/ContactBar.tsx",
      "../src/components/sections/AuditCta.tsx",
      "../src/components/layout/Footer.tsx",
    ].map(read).join("\n");
    for (const placement of ["header", "hero", "contact_bar", "contact_section", "footer"]) {
      expect(used).toContain(`"${placement}"`);
    }
  });

  it("the form's own conversion fires on the ACCEPTED submission, not on the click", () => {
    const src = read("../src/components/forms/AuditForm.tsx");
    expect(src).toContain('name: "audit_submit"');
    /* The branch wrote this against its own `if (ok) track(…)`. Production's
       submit handler reads the BODY as well as the status — `ok` alone cannot
       tell «we already have your five requests» from «Telegram did not take
       it» — so the accepted branch is the two-part condition below, and that
       is where the event must sit. Same claim, current shape: a rejected,
       rate-limited or timed-out request fires nothing. */
    expect(src).toMatch(
      /if \(response\.ok && data\?\.ok\) \{[\s\S]{0,400}?track\(\{ name: "audit_submit"/,
    );
    // …and nowhere else: one call site, inside that branch.
    expect(src.match(/name: "audit_submit"/g)).toHaveLength(1);
  });

  it("the language switch is an event too", () => {
    expect(read("../src/components/layout/LanguageSwitcher.tsx")).toContain(
      'name: "language_switch"',
    );
  });
});

describe("AuditForm — two fields, same pipeline (brief §20)", () => {
  const src = read("../src/components/forms/AuditForm.tsx");

  it("asks for the Instagram handle AND a way to answer", () => {
    expect(src).toContain('name="igHandle"');
    expect(src).toContain('name="contact"');
    for (const dict of allDicts) {
      expect(dict.audit.form.igLabel.length).toBeGreaterThan(3);
      expect(dict.audit.form.contactLabel.length).toBeGreaterThan(3);
    }
  });

  it("says plainly how the answer arrives, and promises no delivery time", () => {
    expect(src).toContain("{delivery}");
    for (const dict of allDicts) {
      expect(dict.audit.delivery.length).toBeGreaterThan(10);
      /* v1 promised «розбір за 24 год» in the note, the success text and the
         hero badge. No such commitment exists, so no number of hours may
         reappear anywhere in the audit copy. */
      for (const string of strings(dict.audit)) {
        expect(string).not.toMatch(/\b24\b/);
      }
    }
  });

  it("mini state machine idle→submitting→success|error", () => {
    expect(src).toContain('"idle" | "submitting" | "success" | "error"');
    expect(src).toContain('role="status"');
  });

  it("extends the EXISTING lead pipeline: kind=audit + spam telemetry, no new endpoint", () => {
    expect(src).toContain('kind: "audit"');
    expect(src).toContain('fetch("/api/lead"');
    expect(src).toContain("elapsedMs");
    expect(src).toContain("extra_field");
    expect(src).toContain("visually-hidden");
    expect(src).toContain("AbortSignal.timeout");
  });

  it("elapsedMs counts from the FIRST field interaction, mount as fallback", () => {
    expect(src).toContain("firstTouchAt");
    expect(src).toContain("onFocus");
    expect(src).toMatch(/firstTouchAt\.current \?\? mountedAt\.current/);
  });

  it("validates with the shared schema and moves focus to the first bad field", () => {
    expect(src).toContain("leadSchema");
    expect(src).toContain("parsed.error.flatten().fieldErrors");
    expect(src).toMatch(/\(errors\.igHandle \? igRef : contactRef\)\.current\?\.focus\(\)/);
  });

  it("errors are announced and tied to their field, in every locale", () => {
    expect(src).toContain("aria-invalid");
    expect(src).toContain("aria-describedby");
    expect(src).toContain('role="alert"');
    for (const dict of allDicts) {
      expect(dict.audit.form.errors.igHandle.length).toBeGreaterThan(5);
      expect(dict.audit.form.errors.contact.length).toBeGreaterThan(5);
    }
  });

  it("both inputs are pinned LTR — an @handle and a +380… are never RTL", () => {
    // Counted per input, not over the whole file: the error state pins the
    // phone number LTR too, and that is a third legitimate dir="ltr".
    const inputs = src.match(/<input[^>]*name="(?:igHandle|contact)"[\s\S]*?\/>/g) ?? [];
    expect(inputs).toHaveLength(2);
    for (const input of inputs) expect(input).toContain('dir="ltr"');
  });

  /*
   * The error state. Until 15.09.2026 it was ONE state for four different
   * server answers, and its single line of copy was false for two of them —
   * after a 429 the previous requests had arrived, after a rejected payload
   * «try again» was a loop with no exit. `errorTitle`/`errorText` are gone;
   * every failure now carries its own copy. That the set of states matches
   * what the route can actually answer, in all four languages, is checked
   * against the route source in tests/lead-failures.test.ts. Asserted here:
   * the way out is still rendered, and still only through the readiness gate.
   */
  describe("a failed submission leaves a way out", () => {
    const errorBranch =
      src.match(/behaviour !== null && failureCopy !== null \? \([\s\S]*?\n      \) : null/)?.[0] ?? "";

    it("the branch exists and shows the copy of THIS failure, not a shared line", () => {
      expect(errorBranch).not.toBe("");
      expect(errorBranch).toContain("failureCopy.title");
      expect(errorBranch).toContain("failureCopy.text");
      // The one-size-fits-all strings must not come back.
      expect(src).not.toContain("dict.errorTitle");
      expect(src).not.toContain("dict.errorText");
      for (const dict of allDicts) {
        expect(Object.keys(dict.audit.form)).not.toContain("errorText");
      }
    });

    it("something real follows the colon: the phone and the ready messengers", () => {
      expect(errorBranch).toContain("site.phone.tel");
      expect(errorBranch).toContain("fallbackChannels.map");
      expect(src).toContain("localeChannels(locale)");
      // Announced as one alert, not a lone red line.
      expect(errorBranch).toContain('role="alert"');
    });

    it("there is always at least one live messenger to offer, in every locale", () => {
      for (const locale of locales) {
        expect(localeChannels(locale).length).toBeGreaterThan(0);
      }
      expect(site.phone.tel).toContain("tel:");
    });

    it("what the visitor typed survives the failure — only success clears it", () => {
      // The error state renders INSIDE the form, so the inputs keep their
      // values; the single reset lives in the success branch.
      expect(src.match(/setIgHandle\(""\)/g)).toHaveLength(1);
      expect(src.match(/setContact\(""\)/g)).toHaveLength(1);
      expect(src).toContain("dict.retry");
    });
  });
});

describe("wiring — one conversion destination", () => {
  it("the audit form lives in its own section, no longer inside the hero (§5)", () => {
    expect(read("../src/components/sections/AuditCta.tsx")).toContain("<AuditForm");
    expect(read("../src/components/sections/Hero.tsx")).not.toContain("AuditForm");
    expect(existsSync(srcPath("../src/components/forms/LeadForm.tsx"))).toBe(false);
  });

  it("#contact is still navigable from the nav and the footer, and is focusable", () => {
    for (const path of [
      "../src/components/layout/Header.tsx",
      "../src/components/layout/Footer.tsx",
    ]) {
      expect(read(path)).toContain('"#contact"');
    }
    expect(read("../src/components/sections/AuditCta.tsx")).toContain('id="contact"');
  });

  /*
   * «One filled button in the hero» is production's rule too; it is asserted
   * against the shape the hero has after v3 in «§6 — one main action» above
   * (`buttonClass` exactly once, no `<ButtonLink>` at all), so the copy that
   * counted `<ButtonLink>` occurrences is not repeated here — it would pass
   * only by counting a component v3 no longer renders.
   *
   * The contact-section row list below is production's, minus the phone: §4
   * moved the number to the footer, and the §4 block asserts its absence here
   * by name. What is kept is the part that still holds — two quiet accounts,
   * not four near-identical rows, and neither of the two channels that are
   * merely this same phone number again.
   */
  it("the contact section lists Telegram and Instagram — not four near-identical rows", () => {
    const src = codeOf("src/components/sections/AuditCta.tsx");
    expect(src).toContain('"telegram"');
    expect(src).toContain('"instagram"');
    // WhatsApp and Viber reach the same number and live in the ContactBar.
    // (The one filled button is WhatsApp, but by way of primaryAction() — the
    // section never names the channel itself.)
    expect(src).not.toContain("whatsapp");
    expect(src).not.toContain("viber");
    expect(src).toContain("primaryAction()");
  });

  it("the API route still logs the request kind (observability)", () => {
    expect(read("../src/app/api/lead/route.ts")).toContain(
      '"[lead] silent drop:", reason, "kind:", parsed.data.kind',
    );
  });

  it("the route tells «bot not configured» apart from «Telegram failed»", () => {
    const route = read("../src/app/api/lead/route.ts");
    expect(route).toContain("TelegramNotConfiguredError");
    expect(route).toContain("NOT CONFIGURED");
    expect(route).toContain("Telegram delivery failed");
    // Names of the env vars are printed by the error object; no value of
    // either variable may appear in the route at all.
    expect(route).not.toMatch(/process\.env\.TELEGRAM/);
  });
});
