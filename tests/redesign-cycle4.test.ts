import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { uk } from "../src/dictionaries/uk";
import { en } from "../src/dictionaries/en";
import { he } from "../src/dictionaries/he";
import { ro } from "../src/dictionaries/ro";
import { locales } from "../src/lib/i18n";
import { site, messengers } from "../src/lib/site";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/** Every shipped dictionary — a new locale joins these assertions by itself. */
const allDicts = [uk, en, he, ro];

/* ============================================================
   Cycle 4 — «Конверсионная машина» (brief §7/§8, §9 honesty)
   ============================================================ */

describe("cycle 4 — site.ts messenger deep-links", () => {
  it("exposes WhatsApp / Viber / Instagram-DM links next to the existing socials", () => {
    expect(site.socials.whatsapp).toMatch(/^https:\/\/wa\.me\/\d+$/);
    expect(site.socials.viber.length).toBeGreaterThan(5);
    expect(site.socials.instagramDm).toBe("https://ig.me/m/shur.shur.agency");
  });
});

describe("cycle 4 — dictionaries (uk source, en typed parity)", () => {
  it("fab: trigger labels + 4 channel names in both locales", () => {
    for (const dict of allDicts) {
      expect(dict.fab.open.length).toBeGreaterThan(3);
      expect(dict.fab.close.length).toBeGreaterThan(3);
      expect(dict.fab.label.length).toBeGreaterThan(3);
      for (const key of ["telegram", "whatsapp", "viber", "instagram"] as const) {
        expect(dict.fab.channels[key].length).toBeGreaterThan(3);
      }
    }
  });

  it("pain: provocative question + exactly 3 pains in both locales", () => {
    expect(uk.pain.heading).toBe("ВЕДЕТЕ INSTAGRAM, А ЗАЯВОК НЕМАЄ?");
    expect(en.pain.heading.toUpperCase()).toContain("INSTAGRAM");
    for (const dict of allDicts) {
      expect(dict.pain.pains).toHaveLength(3);
      for (const pain of dict.pain.pains) expect(pain.length).toBeGreaterThan(10);
      expect(dict.pain.cta.length).toBeGreaterThan(5);
    }
  });

  it("hero.audit: one-field audit offer with a 24h promise", () => {
    expect(uk.hero.audit.submit).toBe("Отримати аудит");
    expect(en.hero.audit.submit.toLowerCase()).toContain("audit");
    for (const dict of allDicts) {
      expect(dict.hero.audit.title.length).toBeGreaterThan(5);
      expect(dict.hero.audit.note).toContain("24");
      expect(dict.hero.audit.successText).toContain("24");
      expect(dict.hero.audit.errorHandle.length).toBeGreaterThan(5);
    }
  });

  it("stickyCta: brand-voice CTA, not «Contact us»", () => {
    expect(uk.stickyCta.cta).toBe("Хочу соковито");
    expect(en.stickyCta.cta.length).toBeGreaterThan(3);
    for (const dict of allDicts) {
      expect(dict.stickyCta.telegramLabel.length).toBeGreaterThan(3);
    }
  });

  it("contact.scarcity: honest capacity line (3 brands/month), no fake countdowns", () => {
    expect(uk.contact.scarcity).toContain("3 нові бренди");
    expect(en.contact.scarcity.toLowerCase()).toContain("3 new brands");
    for (const dict of allDicts) {
      expect(dict.contact.scarcity).not.toMatch(/таймер|годин залишилось|hours left|hurry/i);
    }
  });
});

describe("cycle 4 — MessengerFab (brief §7.1)", () => {
  const src = () => read("../src/components/conversion/MessengerFab.tsx");

  it("orders channels by locale: uk → Telegram first, everyone else → WhatsApp first", () => {
    const order = src().match(/const MESSENGER_ORDER[\s\S]*?\n\};/)?.[0] ?? "";
    expect(order).toMatch(/uk:\s*\["telegram"/);
    // Every non-Ukrainian locale must be listed explicitly and lead with WhatsApp.
    for (const code of locales.filter((l) => l !== "uk")) {
      expect(order).toMatch(new RegExp(`${code}:\\s*\\["whatsapp"`));
    }
    expect(src()).toMatch(/MESSENGER_ORDER\[locale\]/);
  });

  it("is scroll-gated past the hero via IntersectionObserver", () => {
    expect(src()).toContain("IntersectionObserver");
    expect(src()).toContain('"#top"');
  });

  it("disclosure a11y: aria-expanded, Escape close + focus return, outside click", () => {
    expect(src()).toContain("aria-expanded");
    expect(src()).toContain('"Escape"');
    expect(src()).toMatch(/buttonRef\.current\?\.focus\(\)/);
    expect(src()).toContain("pointerdown");
  });

  it("hidden state is non-interactive (inert + pointer-events) and z sits below header/grain", () => {
    expect(src()).toContain("inert={!visible}");
    expect(src()).toContain("pointer-events-none");
    expect(src()).toContain("z-40");
  });

  it("external links are safe and paper-scrap styled (brand language)", () => {
    expect(src()).toContain('rel="noopener noreferrer"');
    expect(src()).toContain("paper-texture");
    expect(src()).toContain("tape");
  });

  it("§9: no fake urgency machinery", () => {
    expect(src()).not.toContain("setInterval");
  });
});

describe("cycle 4 — StickyCta (brief §7.5)", () => {
  const src = () => read("../src/components/conversion/StickyCta.tsx");

  it("mobile-only bar with safe-area padding", () => {
    expect(src()).toContain("md:hidden");
    expect(src()).toContain("safe-area-inset-bottom");
  });

  it("shows after the hero, latches off once #contact has been reached", () => {
    expect(src()).toContain("IntersectionObserver");
    expect(src()).toContain('"#top"');
    expect(src()).toContain('"#contact"');
    expect(src()).toMatch(/heroPassed && !contactReached/);
  });

  it("CTA scrolls to #contact through the Lenis-aware helper + Telegram mini-button", () => {
    expect(src()).toContain('scrollToAnchor("#contact")');
    expect(src()).toContain("site.socials.telegram");
  });

  it("hidden state is non-interactive and z sits below header/grain", () => {
    expect(src()).toContain("inert={!visible}");
    expect(src()).toContain("z-40");
  });

  it("§9: no fake urgency machinery", () => {
    expect(src()).not.toContain("setInterval");
  });
});

describe("cycle 4 — AuditForm (brief §7.3, one field)", () => {
  const src = () => read("../src/components/forms/AuditForm.tsx");

  it("mini state machine idle→submitting→success|error", () => {
    expect(src()).toContain('"idle" | "submitting" | "success" | "error"');
    expect(src()).toContain('role="status"');
  });

  it("extends the EXISTING lead pipeline: kind=audit + spam telemetry, no new endpoint", () => {
    expect(src()).toContain('kind: "audit"');
    expect(src()).toContain('fetch("/api/lead"');
    expect(src()).toContain("elapsedMs");
    expect(src()).toContain("extra_field");
    expect(src()).toContain("visually-hidden");
    expect(src()).toContain("AbortSignal.timeout");
  });

  it("validates the handle client-side with the shared schema and focuses the field on error", () => {
    expect(src()).toContain("leadSchema");
    expect(src()).toMatch(/inputRef\.current\?\.focus\(\)/);
  });
});

describe("cycle 4 — Pain section (brief §7 copy layer)", () => {
  const src = () => read("../src/components/sections/Pain.tsx");

  it("dark continuation of the hero chapter with display typography", () => {
    expect(src()).toContain("bg-cherry-deep");
    expect(src()).toContain("display-type");
  });

  it("funnels to services", () => {
    expect(src()).toContain('href="#services"');
  });
});

describe("cycle 4 — wiring", () => {
  it("hero paper card hosts the audit form", () => {
    expect(read("../src/components/sections/Hero.tsx")).toContain("AuditForm");
  });

  it("contact shows the honest scarcity line", () => {
    expect(read("../src/components/sections/Contact.tsx")).toContain("scarcity");
  });

  it("page mounts Pain between the marquee and Services, plus FAB and sticky bar", () => {
    const page = read("../src/app/[locale]/page.tsx");
    expect(page).toContain("<MessengerFab");
    expect(page).toContain("<StickyCta");
    const order = ["<Hero", "<Marquee", "<Pain", "<Services"].map((tag) => page.indexOf(tag));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

/* ============================================================
   REM-FIX-C4 — remediation after the cycle-4 review
   ============================================================ */

describe("REM-FIX-C4 — per-kind spam thresholds reach the pipeline", () => {
  it("route: silent-drop log carries the request kind (observability)", () => {
    expect(read("../src/app/api/lead/route.ts")).toContain(
      '"[lead] silent drop:", reason, "kind:", parsed.data.kind',
    );
  });

  it("AuditForm: elapsedMs counts from the FIRST field interaction, mount as fallback", () => {
    const src = read("../src/components/forms/AuditForm.tsx");
    expect(src).toContain("firstTouchAt");
    expect(src).toContain("onFocus");
    expect(src).toMatch(/firstTouchAt\.current \?\? mountedAt\.current/);
  });
});

describe("REM-FIX-C4 — dead placeholder deep-links never render", () => {
  it("site.ts: all channels ready and no placeholder number remains (real number wired 2026-06-11)", () => {
    expect(messengers.whatsapp.ready).toBe(true);
    expect(messengers.viber.ready).toBe(true);
    expect(messengers.telegram.ready).toBe(true);
    expect(messengers.instagram.ready).toBe(true);
    const src = read("../src/lib/site.ts");
    expect(src).not.toContain("380000000000");
    expect(src).toContain("wa.me/380972499107");
    expect(src).toContain("%2B380972499107");
  });

  it("FAB filters channels by the ready flag (code guard, not a comment)", () => {
    const src = read("../src/components/conversion/MessengerFab.tsx");
    expect(src).toMatch(/\.filter\(\(channel\) => channel\.ready\)/);
    expect(src).not.toContain("wa.me");
  });
});

describe("REM-FIX-C4 — iOS safe area", () => {
  it('layout: viewport opts into the full screen (viewportFit: "cover")', () => {
    expect(read("../src/app/[locale]/layout.tsx")).toContain('viewportFit: "cover"');
  });

  it("FAB: mobile offset includes env(safe-area-inset-bottom) (cover grows the sticky bar on iPhone)", () => {
    const src = read("../src/components/conversion/MessengerFab.tsx");
    expect(src).toContain("bottom-[calc(5rem+env(safe-area-inset-bottom))]");
    expect(src).toContain("md:bottom-6");
  });
});

describe("REM-FIX-C4 — focus & latch behaviour", () => {
  it("#contact is programmatically focusable so scrollToAnchor's focus() is not a no-op", () => {
    expect(read("../src/components/sections/Contact.tsx")).toContain("tabIndex={-1}");
  });

  it("StickyCta: one-way latch — once #contact was seen the bar never pops back", () => {
    const src = read("../src/components/conversion/StickyCta.tsx");
    expect(src).toContain("setContactReached(true)");
    expect(src).not.toContain("setContactReached(false)");
    expect(src).not.toContain("contactInView");
  });

  it("FAB: IO-collapse with focus inside the menu hands focus back to the trigger", () => {
    expect(read("../src/components/conversion/MessengerFab.tsx")).toMatch(
      /contains\(document\.activeElement\)/,
    );
  });
});
