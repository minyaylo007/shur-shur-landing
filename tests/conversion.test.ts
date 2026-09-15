import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { uk } from "../src/dictionaries/uk";
import { en } from "../src/dictionaries/en";
import { he } from "../src/dictionaries/he";
import { ro } from "../src/dictionaries/ro";
import { locales } from "../src/lib/i18n";
import { site, messengers, primaryChannel } from "../src/lib/site";

/*
 * Conversion path — ONE main action, one form, one endpoint.
 *
 * History: this file is `tests/redesign-cycle4.test.ts`, renamed once already
 * when `MessengerFab` + `StickyCta` merged into `ContactBar`.
 *
 * v3 rewrote what it guards, because the v2 conversion architecture was the
 * thing under review:
 *
 *  §3 Viber is gone from the project — there is no such channel.
 *  §4 The phone is no longer a conversion. It appears exactly once, in the
 *     footer, as a detail. The old "reachable from everywhere" suite asserted
 *     the opposite, so it is inverted here rather than deleted: the number
 *     must NOT come back to the header, the hero, the contact section or the
 *     sticky control.
 *  §6 One primary action («Обговорити проєкт» → WhatsApp), Telegram second,
 *     Instagram a portfolio link. Three equal buttons are forbidden.
 *  §7 Telegram's address was never confirmed, so `ready: false` keeps it out
 *     of the DOM. "Every channel is ready" is therefore no longer true — the
 *     assertion becomes "nothing unready renders".
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

  it("§3: Viber is gone from lib/site and from every dictionary", () => {
    expect(site.socials).not.toHaveProperty("viber");
    expect(messengers).not.toHaveProperty("viber");
    expect(read("../src/lib/site.ts").toLowerCase()).not.toContain("viber.com");
    for (const dict of allDicts) {
      expect(dict.contactBar.channels).not.toHaveProperty("viber");
      for (const string of strings(dict)) expect(string.toLowerCase()).not.toContain("viber");
    }
    /* …and no component still reaches for one. The word itself may appear in
       a comment recording the removal — that is the point of the comment —
       so this looks for a USE, not for the letters. */
    for (const [, path] of NOT_THE_PHONE) {
      const src = read(path);
      expect(src).not.toMatch(/viber\.com|socials\.viber|messengers\.viber|channels\.viber/i);
      expect(src).not.toMatch(/["']viber["']/i);
    }
  });

  it("§7: an unconfirmed address is OFF, and the guard is a flag, not a comment", () => {
    expect(messengers.telegram.ready).toBe(false);
    expect(messengers.whatsapp.ready).toBe(true);
    expect(messengers.instagram.ready).toBe(true);
    expect(site.socials.instagramDm).toBe("https://ig.me/m/shur.shur.agency");
  });

  it("§6: one primary channel, and it is the ready one", () => {
    expect(primaryChannel.key).toBe("whatsapp");
    expect(primaryChannel.href).toBe(messengers.whatsapp.href);
    expect(messengers[primaryChannel.key].ready).toBe(true);
  });
});

describe("§4 — the phone is a footer detail and nothing else", () => {
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

  it("no dictionary still ships a «зателефонувати» label for a gone button", () => {
    for (const dict of allDicts) expect(dict.nav).not.toHaveProperty("callLabel");
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
      expect(src).toContain("primaryChannel");
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
    expect(src).toContain("messengers.telegram.ready");
    expect(src).toContain("site.socials.instagram");
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

  it("every locale states its own order explicitly, and WhatsApp leads all four", () => {
    const order = src.match(/const MESSENGER_ORDER[\s\S]*?\n\};/)?.[0] ?? "";
    for (const code of locales) {
      expect(order).toMatch(new RegExp(`${code}:\\s*\\["whatsapp"`));
    }
    expect(src).toMatch(/MESSENGER_ORDER\[locale\]/);
    // §6: Instagram is a portfolio account, not a third support channel.
    expect(order).not.toContain("instagram");
  });

  it("filters by the ready flag (code guard, not a comment) and renders nothing when empty", () => {
    expect(src).toMatch(/\.filter\(\(key\) => messengers\[key\]\.ready\)/);
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
    expect(src).toMatch(/if \(ok\) track\(/);
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
    expect(src.match(/dir="ltr"/g)?.length).toBe(2);
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

  it("the API route still logs the request kind (observability)", () => {
    expect(read("../src/app/api/lead/route.ts")).toContain(
      '"[lead] silent drop:", reason, "kind:", parsed.data.kind',
    );
  });
});
