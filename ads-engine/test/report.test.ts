import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { OutboxTelegram } from "../src/telegram.ts";
import { join } from "node:path";
import { wilson, poissonInterval, costPer, convert, computeMetrics, totalSpend } from "../src/metrics.ts";
import { ingestLead, parseLead } from "../src/leads.ts";
import { setStatus } from "../src/funnel.ts";
import { alerts, buildReport, fmtRate } from "../src/report.ts";
import { runDaily } from "../src/app.ts";
import { setStop } from "../src/safety.ts";
import { DEFAULT_LIMITS } from "../src/config.ts";
import { testApp, leadBody, seedCampaign, markCollected, NOW } from "./helpers.ts";
import type { App } from "../src/app.ts";

/* Метрики по рынкам с честной неопределённостью, отчёт и тревоги.
   Валюты без курса не складываются; «мало данных» — видно в тексте. */

const TODAY = "2026-09-29";

function addLead(app: App, over: Record<string, unknown>, to?: "qualified" | "proposal") {
  const p = parseLead(leadBody(over));
  if (!p.ok) throw new Error(p.field);
  ingestLead(app.db, p.lead);
  if (to) setStatus(app.db, p.lead.lead_id, { to, actor: "t" });
  return p.lead.lead_id;
}

describe("statistics", () => {
  it("Wilson interval matches the textbook value and flags small samples", () => {
    const r = wilson(2, 3);
    expect(r.rate).toBeCloseTo(0.667, 3);
    expect(r.low).toBeCloseTo(0.208, 2);
    expect(r.high).toBeCloseTo(0.939, 2);
    expect(r.smallSample).toBe(true);
    expect(wilson(0, 0).rate).toBeNull();
    expect(wilson(40, 100).smallSample).toBe(false);
    expect(fmtRate(r)).toContain("мало данных");
  });

  it("Poisson interval (Byar) is close to the exact one", () => {
    expect(poissonInterval(0).high).toBeCloseTo(3.69, 1);
    const ten = poissonInterval(10);
    expect(ten.low).toBeCloseTo(4.8, 1);
    expect(ten.high).toBeCloseTo(18.39, 1);
  });

  it("cost per X: no count → no value, but a floor from the interval", () => {
    const c = costPer(100, 0, "EUR");
    expect(c.value).toBeNull();
    expect(c.low).toBeCloseTo(100 / 3.69, 0);
    expect(costPer(100, 4, "EUR").value).toBe(25);
  });

  it("currencies convert only with an explicit rate", () => {
    expect(convert(10, "EUR", "EUR", {})).toBe(10);
    expect(convert(10, "EUR", "ILS", {})).toBeNull();
    expect(convert(10, "EUR", "ILS", { EUR_ILS: 4 })).toBe(40);
    expect(convert(40, "ILS", "EUR", { EUR_ILS: 4 })).toBe(10);
  });
});

describe("per-market metrics", () => {
  it("keeps markets and currencies apart", () => {
    const app = testApp();
    seedCampaign(app.db, { id: "c1", name: "sv_a", market: "suceava", daily: 10, spendPerDay: 10, days: 10, today: TODAY });
    seedCampaign(app.db, { id: "c2", name: "ta_b", market: "tel_aviv", daily: 30, spendPerDay: 30, days: 10, today: TODAY });
    app.db.prepare("UPDATE insights SET currency = 'ILS' WHERE object_id = 'c2'").run();
    addLead(app, { contact: "a1@example.org" }, "qualified");
    addLead(app, { contact: "a2@example.org" }, "proposal");
    addLead(app, { contact: "a3@example.org" });
    addLead(app, { contact: "a3@example.org" }); // duplicate
    addLead(app, { contact: "t1@example.org", market: "tel_aviv", attribution: { landing_path: "/he/tel-aviv" } });

    const m = computeMetrics(app.db, "2026-09-01", TODAY, DEFAULT_LIMITS);
    const sv = m.markets.find((x) => x.market === "suceava")!;
    const ta = m.markets.find((x) => x.market === "tel_aviv")!;
    expect(sv.spend).toEqual({ EUR: 100 });
    expect(ta.spend).toEqual({ ILS: 300 });
    expect(sv).toMatchObject({ leads: 3, duplicates: 1, qualified: 2, proposals: 1, won: 0 });
    expect(sv.cpql[0]).toMatchObject({ currency: "EUR", value: 50, smallSample: true });
    expect(sv.conversions.leadToQualified).toMatchObject({ k: 2, n: 3, smallSample: true });
    expect(ta.leads).toBe(1);
    expect(totalSpend(m, "EUR", {})).toBeNull();
    expect(totalSpend(m, "EUR", { EUR_ILS: 4 })).toBe(175);
  });
});

describe("alerts and the daily report", () => {
  it("stale data over 36 h, spend without leads, and the stop flag", () => {
    const app = testApp();
    seedCampaign(app.db, { id: "c1", name: "sv_a", market: "suceava", daily: 30, spendPerDay: 30, days: 10, today: TODAY });
    markCollected(app.db, new Date(NOW.getTime() - 37 * 3600_000));
    setStop(app.config.dataDir, "тест", "t");
    const a = alerts(app.db, app.limits, app.config.dataDir, NOW).join("\n");
    expect(a).toMatch(/не обновлялись 37 ч/);
    expect(a).toMatch(/Сучава: расход 60 EUR за 3 дн\. и ни одного лида/);
    expect(a).toMatch(/Аварийная остановка/);
    expect(a).toMatch(/связь сайт → учёт/);
  });

  it("fresh data and leads → no alerts", () => {
    const app = testApp();
    seedCampaign(app.db, { id: "c1", name: "sv_a", market: "suceava", daily: 30, spendPerDay: 30, days: 10, today: TODAY });
    markCollected(app.db, NOW);
    addLead(app, { contact: "z@example.org", created_at: "2026-09-28T10:00:00Z" });
    expect(alerts(app.db, app.limits, app.config.dataDir, NOW)).toEqual([]);
  });

  it("the report is per market, shows intervals and carries no personal data", () => {
    const app = testApp();
    seedCampaign(app.db, { id: "c1", name: "sv_a", market: "suceava", daily: 30, spendPerDay: 30, days: 10, today: TODAY });
    markCollected(app.db, NOW);
    addLead(app, { name: "Radu Reportov", contact: "radu.report@example.org" }, "qualified");
    const text = buildReport(app.db, app.limits, app.config.dataDir, { now: NOW, modes: app.modes, mode: "observe" });
    expect(text).toContain("🇷🇴 Сучава");
    expect(text).toContain("🇮🇱 Тель-Авив");
    expect(text).toContain("ФИКСТУРЫ");
    expect(text).toMatch(/лид→квал 100% \[\d+%–100%\] \(1\/1\) · мало данных/);
    expect(text).not.toMatch(/Radu|Reportov|radu\.report/);
  });

  it("dry daily run collects fixtures and writes the report to a file (600)", async () => {
    const app = testApp();
    app.telegram = new OutboxTelegram(join(app.config.dataDir, "telegram-outbox.jsonl")); // no bot token
    const s = await runDaily(app);
    expect(s.collect).toMatchObject({ ok: true, mode: "fixtures" });
    expect(s.google).toBe("не подключён");
    expect(s.rules.proposals).toBe(0); // no leads in the ledger yet
    const file = join(app.config.dataDir, "reports", "2026-09-29.txt");
    expect(s.delivered).toBe(file);
    expect(readFileSync(file, "utf8")).toContain("SHUR-SHUR");
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(existsSync(join(app.config.dataDir, "reports", "2026-09-29-alerts.txt"))).toBe(true);
    expect(app.tg.calls).toEqual([]);
  });
});
