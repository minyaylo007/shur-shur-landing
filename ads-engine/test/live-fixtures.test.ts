import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { buildSnapshot } from "../src/cabinet.ts";
import { alerts, buildReport } from "../src/report.ts";
import { openDb } from "../src/db.ts";
import { testApp, seedCampaign, markCollected, tmpDir, NOW } from "./helpers.ts";

/* Право: тестовое не выдавать за настоящее (27.10.2026). Фикстуры жили в
   insights рядом с живыми строками; отчёт, тревога «расход без заявок» и снимок
   кабинета считали их как настоящие. В live-режиме фикстур там быть не должно. */

const TODAY = "2026-09-29";

function mixed() {
  const app = testApp();
  // Old fixture rows: EUR, the sv_/ta_ dry-run campaigns, big spend, no leads.
  seedCampaign(app.db, { id: "fx1", name: "sv_prospecting_ro", market: "suceava", daily: 30, spendPerDay: 30, days: 30, today: TODAY, mode: "fixtures" });
  // Her live campaign: USD, no market prefix.
  seedCampaign(app.db, { id: "live1", name: "Ліди чернівці", market: "other", daily: 2, spendPerDay: 2, days: 3, today: TODAY });
  app.db.prepare("UPDATE insights SET currency = 'USD' WHERE object_id = 'live1'").run();
  app.db.prepare("UPDATE budgets SET currency = 'USD' WHERE object_id = 'live1'").run();
  markCollected(app.db, NOW);
  return app;
}

describe("live mode never shows fixture rows as real", () => {
  it("cabinet snapshot: live rows only, their currency, test_data false", () => {
    const snap = buildSnapshot(mixed().db, { metaMode: "live", now: NOW });
    expect(snap.ads.days.map((d) => d.campaign)).toEqual(["Ліди чернівці", "Ліди чернівці", "Ліди чернівці"]);
    expect(JSON.stringify(snap)).not.toMatch(/sv_prospecting_ro/);
    expect(snap.currency).toBe("USD");
    expect(snap.test_data).toBe(false);
  });

  it("fixtures mode: only fixture rows, flagged test_data", () => {
    const snap = buildSnapshot(mixed().db, { metaMode: "fixtures", now: NOW });
    expect(snap.ads.days.every((d) => d.campaign === "sv_prospecting_ro")).toBe(true);
    expect(snap.test_data).toBe(true);
  });

  it("alerts: fixture spend raises no «spend without leads»", () => {
    const app = mixed();
    app.db.prepare("UPDATE insights SET spend = 0 WHERE object_id = 'live1'").run();
    expect(alerts(app.db, app.limits, app.config.dataDir, NOW, "live")).toEqual([]);
  });

  it("report: no fixture spend, «other» names its campaigns", () => {
    const app = mixed();
    const text = buildReport(app.db, app.limits, app.config.dataDir, { now: NOW, modes: { meta: "live" }, mode: "observe" });
    expect(text).not.toMatch(/EUR/);
    expect(text).toMatch(/кампании: «Ліди чернівці» 6 USD/);
  });

  it("migration marks rows of earlier fixture runs as fixtures", () => {
    const dir = tmpDir();
    const raw = new DatabaseSync(join(dir, "ledger.sqlite"));
    raw.exec(`CREATE TABLE insights (source TEXT NOT NULL, level TEXT NOT NULL, object_id TEXT NOT NULL, date TEXT NOT NULL,
      campaign_id TEXT, campaign_name TEXT, adset_id TEXT, ad_id TEXT, object_name TEXT, market TEXT NOT NULL,
      spend REAL NOT NULL, currency TEXT NOT NULL, timezone TEXT NOT NULL, impressions INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0, platform_leads INTEGER NOT NULL DEFAULT 0, fetched_at TEXT NOT NULL,
      PRIMARY KEY (source, level, object_id, date));
    CREATE TABLE collector_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, source TEXT NOT NULL,
      mode TEXT NOT NULL, ok INTEGER NOT NULL, rows INTEGER NOT NULL DEFAULT 0, error TEXT);
    INSERT INTO collector_runs(at, source, mode, ok) VALUES ('T1', 'meta', 'fixtures', 1), ('T2', 'meta', 'live', 1);
    INSERT INTO insights(source, level, object_id, date, market, spend, currency, timezone, fetched_at) VALUES
      ('meta', 'campaign', 'a', '2026-09-01', 'other', 1, 'EUR', 'UTC', 'T1'),
      ('meta', 'campaign', 'b', '2026-09-02', 'other', 1, 'USD', 'UTC', 'T2');`);
    raw.close();
    const db = openDb(dir);
    expect(db.prepare("SELECT object_id, mode FROM insights ORDER BY object_id").all().map((r) => ({ ...r }))).toEqual([
      { object_id: "a", mode: "fixtures" },
      { object_id: "b", mode: "live" },
    ]);
  });
});
