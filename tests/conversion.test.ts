import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { uk } from "../src/dictionaries/uk";
import { en } from "../src/dictionaries/en";
import { he } from "../src/dictionaries/he";
import { ro } from "../src/dictionaries/ro";
import { locales } from "../src/lib/i18n";
import { site, messengers } from "../src/lib/site";
import { MESSENGER_ORDER, isChannelReady, localeChannels } from "../src/lib/channels";

/*
 * Conversion path — one contact interaction, one form, one endpoint.
 *
 * History: this file is `tests/redesign-cycle4.test.ts`, renamed. What it
 * guarded still matters, but the components changed: `MessengerFab` and
 * `StickyCta` — up to five floating targets over the content, the pattern
 * brief §19 rules out — were merged into a single `ContactBar`, so the
 * locale ordering, the #top scroll gate, the disclosure a11y and the
 * safe-area maths are asserted at the new address. The `Pain` section and
 * the hero-hosted audit form are gone (§3, §5). The audit form itself gained
 * a second required field (§20) and lost the «за 24 години» promise, which
 * was never a commitment the business had actually made.
 */

const srcPath = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel: string) => readFileSync(srcPath(rel), "utf8");

const allDicts = [uk, en, he, ro];

/** Every visible string under a dictionary branch, flattened. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("lib/site — the one real phone number (brief §5)", () => {
  it("exposes it as a tel: link, not only inside messenger deep-links", () => {
    expect(site.phone.e164).toBe("+380972499107");
    expect(site.phone.tel).toBe("tel:+380972499107");
  });

  it("the displayed number is the same digits, grouped with NBSPs so it never wraps", () => {
    expect(site.phone.display.replace(/ /g, "").replace(/\s/g, "")).toBe(site.phone.e164);
    expect(site.phone.display).toContain(" ");
  });

  it("nothing was invented: wa.me and viber carry that same number", () => {
    const digits = site.phone.e164.replace("+", "");
    expect(site.socials.whatsapp).toBe(`https://wa.me/${digits}`);
    expect(site.socials.viber).toContain(`%2B${digits}`);
    expect(read("../src/lib/site.ts")).not.toContain("380000000000");
  });

  it("the Instagram DM deep-link is the official ig.me form", () => {
    expect(site.socials.instagramDm).toBe("https://ig.me/m/shur.shur.agency");
  });
});

/*
 * The readiness contract, and why it is tested by behaviour and not by a
 * comment. `ready: false` means «this account is not real yet, render it
 * nowhere». Before 15.09.2026 exactly one of the three components that print a
 * messenger link honoured it: the footer and the contact section read
 * `site.socials.*` directly, so a Telegram username that was never registered
 * sat on the live page in two places — and first in line for a Ukrainian
 * visitor in the third. These tests fail if any render site starts reaching
 * around the gate again.
 */
describe("readiness contract — a channel that is not ready renders NOWHERE", () => {
  const renderSites = [
    ["contact bar", "../src/components/conversion/ContactBar.tsx"],
    ["footer", "../src/components/layout/Footer.tsx"],
    ["contact section", "../src/components/sections/AuditCta.tsx"],
  ] as const;

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

  it.each(renderSites)("%s takes hrefs through the gate, never site.socials", (_where, path) => {
    const src = read(path);
    expect(src).toMatch(/isChannelReady|localeChannels/);
    // The raw constants are what the footer and the contact section used to
    // print past the flag. `telegramHandle` (a label, inside a gated row) is
    // deliberately still allowed — the \b stops it matching here.
    expect(src).not.toMatch(/site\.socials\.telegram\b/);
    expect(src).not.toMatch(/site\.socials\.whatsapp\b/);
    expect(src).not.toMatch(/site\.socials\.viber\b/);
    expect(src).not.toMatch(/https:\/\/t\.me\//);
  });

  it("telegram specifically: the username is unregistered, so it is not ready", () => {
    // Flip this the day the client names a real channel — and only then.
    expect(messengers.telegram.ready).toBe(false);
  });
});

describe("the phone is reachable from everywhere it should be (brief §5, §19)", () => {
  it.each([
    ["header", "../src/components/layout/Header.tsx"],
    ["hero", "../src/components/sections/Hero.tsx"],
    ["contact section", "../src/components/sections/AuditCta.tsx"],
    ["footer", "../src/components/layout/Footer.tsx"],
    ["contact bar", "../src/components/conversion/ContactBar.tsx"],
  ])("%s links site.phone.tel and pins the number LTR", (_where, path) => {
    const src = read(path);
    expect(src).toContain("site.phone.tel");
    expect(src).toContain('dir="ltr"');
  });

  it("the accessible name for those links is translated, never a bare number", () => {
    for (const dict of allDicts) expect(dict.nav.callLabel.length).toBeGreaterThan(3);
  });
});

describe("ContactBar — ONE persistent control (brief §19)", () => {
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

  it("the phone sits above the messengers — it is the channel v1 never showed", () => {
    expect(src.indexOf("site.phone.tel")).toBeLessThan(src.indexOf("order.map"));
  });

  it("filters channels by the ready flag (code guard, not a comment)", () => {
    expect(read("../src/lib/channels.ts")).toMatch(/\.filter\(isChannelReady\)/);
    expect(src).not.toContain("wa.me");
  });

  it("is scroll-gated past the hero via IntersectionObserver", () => {
    expect(src).toContain("IntersectionObserver");
    expect(src).toContain('"#top"');
  });

  it("disclosure a11y: aria-expanded, Escape close + focus return, outside pointer", () => {
    expect(src).toContain("aria-expanded");
    expect(src).toContain("aria-controls");
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
      for (const key of ["telegram", "whatsapp", "viber", "instagram"] as const) {
        expect(dict.contactBar.channels[key].length).toBeGreaterThan(3);
      }
    }
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
    // The second field's label must name the messenger, in that language's
    // own spelling — Hebrew writes it «טלגרם», not "Telegram".
    expect(uk.audit.form.contactLabel).toContain("Telegram");
    expect(en.audit.form.contactLabel).toContain("Telegram");
    expect(he.audit.form.contactLabel).toContain("טלגרם");
    expect(ro.audit.form.contactLabel).toContain("Telegram");
  });

  it("says plainly how the answer arrives, and promises no delivery time", () => {
    expect(src).toContain("{delivery}");
    for (const dict of allDicts) {
      expect(dict.audit.delivery.length).toBeGreaterThan(15);
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
    expect(src.match(/dir="ltr"/g)?.length).toBe(2);
  });
});

describe("wiring — one conversion destination", () => {
  it("the audit form lives in its own section, no longer inside the hero (§5)", () => {
    expect(read("../src/components/sections/AuditCta.tsx")).toContain("<AuditForm");
    expect(read("../src/components/sections/Hero.tsx")).not.toContain("AuditForm");
    expect(existsSync(srcPath("../src/components/forms/LeadForm.tsx"))).toBe(false);
  });

  it("#contact is the single CTA target of the whole page and is focusable", () => {
    for (const path of [
      "../src/components/layout/Header.tsx",
      "../src/components/sections/Hero.tsx",
      "../src/components/layout/Footer.tsx",
    ]) {
      expect(read(path)).toContain('"#contact"');
    }
    expect(read("../src/components/sections/AuditCta.tsx")).toContain('id="contact"');
  });

  it("the hero carries exactly ONE filled button (brief §21)", () => {
    const src = read("../src/components/sections/Hero.tsx");
    expect(src.match(/<ButtonLink/g)).toHaveLength(1);
    expect(src).not.toContain("<Button ");
  });

  it("the contact section lists the phone, Telegram and Instagram — not four near-identical rows", () => {
    const src = read("../src/components/sections/AuditCta.tsx");
    expect(src.match(/icon: \w+Icon/g)).toHaveLength(3);
    // WhatsApp and Viber reach the same number and live in the ContactBar.
    expect(src).not.toContain("whatsapp");
    expect(src).not.toContain("viber");
  });

  it("the API route still logs the request kind (observability)", () => {
    expect(read("../src/app/api/lead/route.ts")).toContain(
      '"[lead] silent drop:", reason, "kind:", parsed.data.kind',
    );
  });
});
