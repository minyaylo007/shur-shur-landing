import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { ingestLead, parseLead } from "../src/leads.ts";
import { setStatus } from "../src/funnel.ts";
import { buildAnalysis, writeAnalysis } from "../src/analysis.ts";
import { runDaily } from "../src/app.ts";
import { parseSale } from "../src/sales.ts";
import { testApp, leadBody, seedCampaign, CHAT, NOW } from "./helpers.ts";

/* RIGHTS side of the daily analysis (owner's rule 13.10.2026): the JSON the
   conductor reads carries no one's name, contact, message, handle or lead id,
   and /client stores a sale — never a word about the person. CAC counts both
   won site leads and sales from Direct. */

const PERSON = { name: "Ioana Testescu", contact: "+40 712 345 678", message: "Vrem o sesiune foto", ig_handle: "@ioana.test" };

describe("daily analysis: no personal data", () => {
  it("the analysis JSON has counters only — no name, contact, message, handle or lead id", async () => {
    const app = testApp();
    // The bot dates a sale by the real clock: the window is built around it too.
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    seedCampaign(app.db, { id: "c1", name: "sv_prospecting_ro", market: "suceava", daily: 10, spendPerDay: 10, days: 5, today });
    const p = parseLead(leadBody({ ...PERSON, created_at: now.toISOString() }));
    if (!p.ok) throw new Error(p.field);
    ingestLead(app.db, p.lead);
    setStatus(app.db, p.lead.lead_id, { to: "won", actor: "t", amount: 1500, currency: "RON" });

    const msg = (text: string) => ({ update_id: 3, message: { message_id: 11, chat: { id: Number(CHAT) }, from: { id: 42 }, text } });
    expect(await app.bot.handleUpdate(msg("/client 900 UAH direct ta"))).toBe("sale_recorded");

    // Measured by sales: one won site lead + one sale from Direct = 2 clients.
    const live = buildAnalysis(app.db, { metaMode: "live", limits: app.limits, now });
    expect(live.windows.d7).toMatchObject({ spend: 50, won_site_leads: 1, offline_clients: 1, clients: 2, cac: 25 });
    expect(live.windows.d7.revenue).toEqual({ RON: 1500, UAH: 900 });
    const liveText = JSON.stringify(live);

    const daily = await runDaily(app);
    expect(daily.analysis.file).toMatch(/analysis\/2026-09-29\.json$/);
    expect(daily.analysis.notify).toBe("off");
    const text = readFileSync(daily.analysis.file!, "utf8");
    expect(statSync(daily.analysis.file!).mode & 0o777).toBe(0o600);
    for (const v of [...Object.values(PERSON), "Ioana", "712 345", p.lead.lead_id, p.lead.lead_id.slice(0, 8)]) {
      expect(text).not.toContain(v);
      expect(liveText).not.toContain(v);
    }
  });

  it("/client takes amount, currency, source, market — any extra word is refused, not stored", async () => {
    const app = testApp();
    const msg = (text: string) => ({ update_id: 4, message: { message_id: 12, chat: { id: Number(CHAT) }, from: { id: 42 }, text } });
    for (const bad of ["/client 900 UAH direct Ioana", "/client 900 UAH direct ta +40712345678", "/client Ioana 900 UAH", "/client 900 UAH"]) {
      expect(await app.bot.handleUpdate(msg(bad))).toBe("bad_sale");
    }
    expect(app.db.prepare("SELECT COUNT(*) AS n FROM offline_sales").get()).toEqual({ n: 0 });
    expect(parseSale("1500 uah form")).toEqual({ source: "meta_form", market: "other", amount: 1500, currency: "UAH" });

    expect(await app.bot.handleUpdate(msg("/client 1500 uah form sv"))).toBe("sale_recorded");
    const row = app.db.prepare("SELECT * FROM offline_sales").get() as Record<string, unknown>;
    expect(Object.keys(row).sort()).toEqual(["actor", "amount", "at", "currency", "id", "market", "source"]);
    expect(row).toMatchObject({ amount: 1500, currency: "UAH", source: "meta_form", market: "suceava" });
  });

  it("fixture data is marked as not hers", () => {
    const app = testApp();
    const data = buildAnalysis(app.db, { metaMode: "fixtures", limits: app.limits, now: NOW });
    expect(data.test_data).toBe(true);
    expect(writeAnalysis(app.config.dataDir, data)).toMatch(/2026-09-29\.json$/);
  });
});
