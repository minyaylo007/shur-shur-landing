import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_META_PIXEL_ID,
  pixelArrive,
  revokeMetaPixel,
  sendToPixel,
  startMetaPixel,
  trackMetaLead,
  type PixelDocument,
  type PixelWindow,
} from "../src/lib/meta-pixel";
import {
  THANKS_LEAD_KEY,
  THANKS_LEAD_TTL_MS,
  afterLeadResponse,
  stashThanksLead,
  takeThanksLead,
  thanksPath,
} from "../src/lib/thanks";
import { locales } from "../src/lib/i18n";
import { getDictionary } from "../src/dictionaries";
import sitemap from "../src/app/sitemap";
import { generateMetadata } from "../src/app/[locale]/thanks/page";
import { ThanksLead } from "../src/components/thanks/ThanksLead";

/*
 * Event scheme from the targetologist, 01.10.2026: a lead = the form was
 * ACCEPTED → the thank-you page; Lead fires there, once, with eventID = the
 * server's lead id. A reload, «back» or a direct visit must not add a Lead —
 * every extra one is a fake conversion the ad optimiser learns from.
 */

const LEAD = "0b8e2f4c-1d2e-4f3a-9b8c-7d6e5f4a3b2c";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

function pixel(path = "/uk") {
  const doc: PixelDocument = { createElement: () => ({ async: false, src: "" }), head: { appendChild: () => 0 } };
  const win: PixelWindow = {};
  startMetaPixel({ pixelId: DEFAULT_META_PIXEL_ID, adsAllowed: true, win, doc, path });
  return { win, doc };
}
const tracked = (win: PixelWindow, name: string) =>
  (win.fbq?.queue ?? []).filter((c) => c[0] === "track" && c[1] === name);

describe("the form → the thank-you page: only an accepted submission leaves", () => {
  it.each([
    ["HTTP 429", false, { ok: false, error: "rate_limited" }],
    ["HTTP 502", false, { ok: false, error: "delivery_failed" }],
    ["HTTP 200, ok:false", true, { ok: false }],
    ["HTTP 200, no body", true, null],
  ] as const)("%s → no redirect, nothing stored", (_label, responseOk, data) => {
    const storage = memoryStorage();
    const went: string[] = [];
    expect(afterLeadResponse({ responseOk, data, locale: "uk", storage, navigate: (p) => went.push(p) })).toBe(false);
    expect(went).toEqual([]);
    expect(storage.map.size).toBe(0);
  });

  it("accepted → /<locale>/thanks with no query at all; the lead id goes to sessionStorage, not the URL", () => {
    for (const locale of locales) {
      const storage = memoryStorage();
      const went: string[] = [];
      const ok = afterLeadResponse({
        responseOk: true,
        data: { ok: true, lead_id: LEAD },
        locale,
        storage,
        navigate: (p) => went.push(p),
      });
      expect(ok).toBe(true);
      expect(went).toEqual([`/${locale}/thanks`]);
      expect(went[0]).not.toMatch(/[?#]/);
      expect(went[0]).not.toContain(LEAD);
      expect(JSON.parse(storage.map.get(THANKS_LEAD_KEY)!).id).toBe(LEAD);
    }
    expect(thanksPath("he")).toBe("/he/thanks");
  });

  it("blocked storage still redirects (no Lead later, the visitor is not stuck)", () => {
    const went: string[] = [];
    afterLeadResponse({ responseOk: true, data: { ok: true, lead_id: LEAD }, locale: "ro", storage: null, navigate: (p) => went.push(p) });
    expect(went).toEqual(["/ro/thanks"]);
  });
});

describe("the hand-over is one-shot and fresh", () => {
  it("read once → deleted: a second read (reload, «back») finds nothing", () => {
    const storage = memoryStorage();
    stashThanksLead(storage, LEAD);
    expect(takeThanksLead(storage)).toBe(LEAD);
    expect(storage.map.size).toBe(0);
    expect(takeThanksLead(storage)).toBeNull();
  });

  it("direct visit (nothing stored) → null", () => {
    expect(takeThanksLead(memoryStorage())).toBeNull();
    expect(takeThanksLead(null)).toBeNull();
  });

  it("stale, malformed or forged entries → null, and still deleted", () => {
    const storage = memoryStorage();
    stashThanksLead(storage, LEAD, 1_000);
    expect(takeThanksLead(storage, 1_000 + THANKS_LEAD_TTL_MS + 1)).toBeNull();
    expect(storage.map.size).toBe(0);
    storage.setItem(THANKS_LEAD_KEY, "{not json");
    expect(takeThanksLead(storage)).toBeNull();
    storage.setItem(THANKS_LEAD_KEY, JSON.stringify({ id: "ivan@example.com", at: Date.now() }));
    expect(takeThanksLead(storage)).toBeNull();
    expect(storage.map.size).toBe(0);
    // Not a UUID → never even stored.
    stashThanksLead(storage, "+380501234567");
    expect(storage.map.size).toBe(0);
  });
});

describe("Lead on the thank-you page: once, with eventID, under the same consent as PageView", () => {
  it("fresh id → PageView of /uk/thanks, then exactly one Lead with eventID = lead id and no custom data", () => {
    const { win, doc } = pixel("/uk");
    const storage = memoryStorage();
    stashThanksLead(storage, LEAD);
    // What ThanksLead's effect does; StrictMode runs it twice.
    for (let i = 0; i < 2; i++) {
      pixelArrive(win, doc, "/uk/thanks", () => true);
      const id = takeThanksLead(storage);
      if (id) trackMetaLead(win, id);
    }
    // ConsentLayer's effect for the same path comes after: counts nothing.
    pixelArrive(win, doc, "/uk/thanks", () => true);
    expect(tracked(win, "PageView")).toHaveLength(2); // /uk and /uk/thanks
    expect(tracked(win, "Lead")).toEqual([["track", "Lead", {}, { eventID: LEAD }]]);
    const queue = win.fbq!.queue!;
    expect(queue.findIndex((c) => c[1] === "Lead")).toBeGreaterThan(queue.findLastIndex((c) => c[1] === "PageView"));
  });

  it("direct visit and reload → 0 Lead", () => {
    const { win, doc } = pixel("/uk/thanks");
    const storage = memoryStorage();
    for (let visit = 0; visit < 2; visit++) {
      pixelArrive(win, doc, "/uk/thanks", () => true);
      const id = takeThanksLead(storage);
      if (id) trackMetaLead(win, id);
    }
    expect(tracked(win, "Lead")).toHaveLength(0);
  });

  it("the same id is never sent twice from one page", () => {
    const { win } = pixel();
    expect(trackMetaLead(win, LEAD)).toBe(true);
    expect(trackMetaLead(win, LEAD)).toBe(false);
    expect(tracked(win, "Lead")).toHaveLength(1);
  });

  it("no consent / refused → no pixel, no Lead", () => {
    const win: PixelWindow = {};
    const doc: PixelDocument = { createElement: () => ({ async: false, src: "" }), head: { appendChild: () => 0 } };
    pixelArrive(win, doc, "/uk/thanks", () => false);
    expect(trackMetaLead(win, LEAD)).toBe(false);
    expect(win.fbq).toBeUndefined();
    const started = pixel();
    revokeMetaPixel(started.win);
    expect(trackMetaLead(started.win, LEAD)).toBe(false);
    expect(tracked(started.win, "Lead")).toHaveLength(0);
  });

  it("the old audit_submit → Lead path is closed: one lead, one Lead", () => {
    const sent: unknown[][] = [];
    sendToPixel((...a: unknown[]) => void sent.push(a), { name: "audit_submit", locale: "uk", placement: "contact_section", lead_id: LEAD });
    expect(sent).toEqual([]);
  });
});

describe("Contact on a channel click", () => {
  it.each(["telegram", "whatsapp", "phone"] as const)("%s → one Contact, the channel name and nothing else", (channel) => {
    const { win } = pixel();
    win.shurTrack!({ name: "contact_click", channel, locale: "uk", placement: "contact_bar" });
    expect(tracked(win, "Contact")).toEqual([["track", "Contact", { content_category: channel }]]);
  });
});

describe("the page itself", () => {
  it("noindex, its own canonical, no hreflang; not in the sitemap", async () => {
    for (const locale of locales) {
      const meta = await generateMetadata({ params: Promise.resolve({ locale }) });
      expect(meta.robots).toEqual({ index: false, follow: false });
      expect(meta.alternates).toEqual({ canonical: `/${locale}/thanks` });
      expect(meta.title).toBe(getDictionary(locale).thanks.metaTitle);
    }
    expect(sitemap().some((entry) => entry.url.includes("thanks"))).toBe(false);
  });

  it("every locale has its texts", () => {
    for (const locale of locales) {
      const d = getDictionary(locale);
      expect(d.thanks.metaTitle.length).toBeGreaterThan(0);
      expect(d.thanks.home.length).toBeGreaterThan(0);
      expect(d.audit.form.successTitle.length).toBeGreaterThan(0);
    }
  });

  it("SSR: the Lead component renders nothing and touches no window", () => {
    expect(renderToStaticMarkup(createElement(ThanksLead))).toBe("");
  });
});
