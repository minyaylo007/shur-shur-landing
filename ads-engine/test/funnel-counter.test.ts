import { describe, it, expect, afterEach } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { listen } from "../src/server.ts";
import { buildAnalysis } from "../src/analysis.ts";
import { buildSnapshot } from "../src/cabinet.ts";
import { testApp, leadBody, signedHeaders } from "./helpers.ts";

/* Счётчик воронки сайта (B3.2): подписанный { funnel } на /v1/leads даёт +1 в
   дневном агрегате, а не строку на человека; любое лишнее поле — отказ целиком,
   в базу ничего не пишется; site_funnel и кабинет перестают быть null. */

let server: Server | undefined;
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

async function start() {
  const app = testApp();
  server = await listen(app, 0);
  const { port } = server.address() as AddressInfo;
  const post = (body: unknown) => {
    const raw = JSON.stringify(body);
    return fetch(`http://127.0.0.1:${port}/v1/leads`, { method: "POST", body: raw, headers: signedHeaders(raw) });
  };
  return { app, post };
}

const rows = (app: ReturnType<typeof testApp>) =>
  app.db.prepare("SELECT * FROM site_funnel_daily ORDER BY event, channel").all() as Record<string, unknown>[];

describe("site funnel counter", () => {
  it("aggregates per day and dimension — one row, n grows", async () => {
    const { app, post } = await start();
    for (let i = 0; i < 3; i++) expect((await post({ funnel: { event: "visit", locale: "ro", market: "suceava" } })).status).toBe(200);
    await post({ funnel: { event: "form_reached", locale: "ro", market: "suceava" } });
    await post({ funnel: { event: "contact_click", locale: "ro", market: "suceava", channel: "whatsapp", placement: "hero" } });
    await post({ funnel: { event: "contact_click", locale: "ro", market: "suceava", channel: "whatsapp", placement: "hero" } });
    const today = new Date().toISOString().slice(0, 10);
    expect(rows(app)).toEqual([
      { date: today, event: "contact_click", locale: "ro", market: "suceava", channel: "whatsapp", placement: "hero", n: 2 },
      { date: today, event: "form_reached", locale: "ro", market: "suceava", channel: "", placement: "", n: 1 },
      { date: today, event: "visit", locale: "ro", market: "suceava", channel: "", placement: "", n: 3 },
    ]);
    // A counter is not a lead.
    expect((app.db.prepare("SELECT COUNT(*) AS n FROM leads").get() as { n: number }).n).toBe(0);
  });

  it("refuses any field it does not name and stores nothing", async () => {
    const { app, post } = await start();
    const refused = [
      { funnel: { event: "visit", locale: "uk", market: "other", ip: "1.2.3.4" } },
      { funnel: { event: "visit", locale: "uk", market: "other", ua: "Mozilla/5.0" } },
      { funnel: { event: "visit", locale: "uk", market: "other", path: "/uk?fbclid=x" } },
      { funnel: { event: "visit", locale: "uk", market: "other" }, contact: "+380501112233" },
      { funnel: { event: "visit", locale: "uk", market: "other", channel: "whatsapp" } },
      { funnel: { event: "contact_click", locale: "uk", market: "other", channel: "sms", placement: "hero" } },
      { funnel: { event: "pageview", locale: "uk", market: "other" } },
      { funnel: "visit" },
    ];
    for (const body of refused) expect((await post(body)).status, JSON.stringify(body)).toBe(400);
    expect(rows(app)).toEqual([]);
    // Unsigned is refused like a lead.
    const raw = JSON.stringify({ funnel: { event: "visit", locale: "uk", market: "other" } });
    const unsigned = await fetch(`http://127.0.0.1:${(server!.address() as AddressInfo).port}/v1/leads`, { method: "POST", body: raw, headers: { "content-type": "application/json" } });
    expect(unsigned.status).toBe(401);
    expect(rows(app)).toEqual([]);
  });

  it("fills site_funnel and the cabinet; before the first count stays null", async () => {
    const { app, post } = await start();
    const today = new Date().toISOString().slice(0, 10);
    const opts = { now: new Date(), metaMode: "fixtures" };
    expect(buildAnalysis(app.db, { metaMode: "fixtures", limits: app.limits, now: opts.now }).site_funnel.visits).toBeNull();

    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    expect((await post(leadBody({ created_at: yesterday }))).status).toBe(200);
    await post({ funnel: { event: "visit", locale: "uk", market: "other" } });
    await post({ funnel: { event: "visit", locale: "he", market: "tel_aviv" } });
    await post({ funnel: { event: "form_reached", locale: "uk", market: "other" } });

    const f = buildAnalysis(app.db, { metaMode: "fixtures", limits: app.limits, now: opts.now }).site_funnel;
    expect(f).toMatchObject({ counted_since: today, visits: 2, form_reached: 1, contact_clicks: 0 });
    expect(f.days).toEqual([
      { date: yesterday.slice(0, 10), leads: 1, visits: null, form_reached: null, contact_clicks: null },
      { date: today, leads: 0, visits: 2, form_reached: 1, contact_clicks: 0 },
    ]);
    expect(buildSnapshot(app.db, opts).site.days).toEqual([
      { date: yesterday.slice(0, 10), visits: null, form_reached: null, leads: 1 },
      { date: today, visits: 2, form_reached: 1, leads: 0 },
    ]);
  });
});
