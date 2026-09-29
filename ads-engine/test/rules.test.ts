import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ingestLead, parseLead } from "../src/leads.ts";
import { setStatus } from "../src/funnel.ts";
import { propose, guard, runRules, decide, type Proposal } from "../src/rules.ts";
import { setStop } from "../src/safety.ts";
import type { Limits } from "../src/config.ts";
import { testApp, leadBody, seedCampaign, markCollected, NOW } from "./helpers.ts";
import type { App } from "../src/app.ts";

/* Правила бюджета: три режима, все ограничители, журнал с ключом
   идемпотентности, и исполнитель — только симулятор. Сегодня по счёту
   2026-09-29 (UTC), окно оценки 13.09…26.09 (лаг 3 дня, 14 дней). */

const TODAY = "2026-09-29";
const CAPS: Partial<Limits> = {
  monthlyCapTotal: 3000,
  markets: {
    suceava: { monthlyCap: 2000, targetCpql: 100 },
    tel_aviv: { monthlyCap: 0, targetCpql: 0 },
    other: { monthlyCap: 0, targetCpql: 0 },
  },
};

function lead(app: App, campaign: string, i: number, day = "2026-09-20", qualified = false) {
  const p = parseLead(
    leadBody({
      contact: `q${campaign}${i}@example.org`,
      created_at: `${day}T10:00:00Z`,
      attribution: { utm_campaign: campaign, landing_path: "/ro/suceava" },
    }),
  );
  if (!p.ok) throw new Error(p.field);
  ingestLead(app.db, p.lead);
  if (qualified) setStatus(app.db, p.lead.lead_id, { to: "qualified", actor: "t" });
}

/** A campaign spending 20 EUR/day for 30 days, fresh data. */
function world(opts: { limits?: Partial<Limits>; env?: Record<string, string> } = {}) {
  const app = testApp({ limits: opts.limits, env: opts.env });
  seedCampaign(app.db, { id: "c1", name: "sv_test", market: "suceava", daily: 20, spendPerDay: 20, days: 30, today: TODAY });
  markCollected(app.db, NOW);
  return app;
}

function actions(app: App) {
  return app.db.prepare("SELECT rule, status, mode, reason, result, idem_key FROM actions ORDER BY id").all() as {
    rule: string;
    status: string;
    mode: string;
    reason: string;
    result: string | null;
    idem_key: string;
  }[];
}

describe("proposals", () => {
  it("stay silent while the site → ledger feed is empty", () => {
    const app = world();
    expect(propose(app.engine())).toEqual([]);
  });

  it("spend without leads → cut by the max step", () => {
    const app = world();
    lead(app, "other_campaign", 1); // the feed works, just not for c1
    const [p] = propose(app.engine());
    expect(p).toMatchObject({ rule: "no_leads_cut", objectId: "c1", fromDaily: 20, toDaily: 16, evalUntil: "2026-09-26" });
    expect(p.reason).toContain("280");
  });

  it("CPQL clearly under target → scale; clearly over → cut; unsure or too few leads → nothing", () => {
    const good = world({ limits: CAPS });
    for (let i = 0; i < 12; i++) lead(good, "sv_test", i, "2026-09-20", true);
    expect(propose(good.engine())[0]).toMatchObject({ rule: "cpql_low_scale", toDaily: 24 });

    // 1 qualified of 12 for 280 EUR: even the optimistic CPQL (≈50) is over a target of 20.
    const bad = world({ limits: { ...CAPS, markets: { ...CAPS.markets!, suceava: { monthlyCap: 2000, targetCpql: 20 } } } });
    for (let i = 0; i < 12; i++) lead(bad, "sv_test", i, "2026-09-20", i === 0);
    expect(propose(bad.engine())[0]).toMatchObject({ rule: "cpql_high_cut", toDaily: 16 });

    // The same numbers against a target of 100 are not conclusive either way.
    const unsure = world({ limits: CAPS });
    for (let i = 0; i < 12; i++) lead(unsure, "sv_test", i, "2026-09-20", i === 0);
    expect(propose(unsure.engine())).toEqual([]);

    const few = world({ limits: CAPS });
    for (let i = 0; i < 5; i++) lead(few, "sv_test", i, "2026-09-20", true);
    expect(propose(few.engine())).toEqual([]);
  });

  it("leads inside the conversion-lag window are not judged yet", () => {
    const app = world();
    lead(app, "other_campaign", 1);
    lead(app, "sv_test", 1, "2026-09-28"); // after evalUntil
    expect(propose(app.engine())[0].rule).toBe("no_leads_cut");
  });
});

describe("guards", () => {
  const cut = (over: Partial<Proposal> = {}): Proposal => ({
    rule: "no_leads_cut",
    market: "suceava",
    objectId: "c1",
    level: "campaign",
    objectName: "sv_test",
    fromDaily: 20,
    toDaily: 16,
    currency: "EUR",
    reason: "t",
    evalUntil: "2026-09-26",
    ...over,
  });
  const up = (over: Partial<Proposal> = {}) => cut({ rule: "cpql_low_scale", toDaily: 24, ...over });

  it("emergency stop blocks everything", () => {
    const app = world({ limits: CAPS });
    setStop(app.config.dataDir, "test", "t");
    expect(guard(app.engine(), cut())).toMatch(/аварийная/);
  });

  it("a step over the limit is refused", () => {
    const app = world({ limits: CAPS });
    expect(guard(app.engine(), cut({ toDaily: 10 }))).toMatch(/шаг/);
  });

  it("stale or failed data blocks increases only", () => {
    const stale = testApp({ limits: CAPS });
    seedCampaign(stale.db, { id: "c1", name: "sv_test", market: "suceava", daily: 20, spendPerDay: 20, days: 30, today: TODAY });
    markCollected(stale.db, new Date(NOW.getTime() - 40 * 3600_000));
    expect(guard(stale.engine(), up())).toMatch(/старше 36/);
    expect(guard(stale.engine(), cut())).toBeNull();

    const failed = world({ limits: CAPS });
    markCollected(failed.db, NOW, false);
    expect(guard(failed.engine(), up())).toMatch(/упал/);
    expect(guard(failed.engine(), cut())).toBeNull();
  });

  it("learning phase and unknown objects are left alone", () => {
    const app = testApp({ limits: CAPS });
    seedCampaign(app.db, { id: "c1", name: "sv_test", market: "suceava", daily: 20, spendPerDay: 20, days: 5, today: TODAY });
    markCollected(app.db, NOW);
    expect(guard(app.engine(), cut())).toMatch(/обучения/);
    expect(guard(app.engine(), cut({ objectId: "gone" }))).toMatch(/не найден/);
  });

  it("minimum interval between changes", async () => {
    const app = world({ limits: CAPS, env: { SHUR_ADS_RULES_MODE: "auto" } });
    lead(app, "other_campaign", 1);
    await runRules(app.engine());
    expect(actions(app)[0].status).toBe("executed");
    expect(guard(app.engine(), cut({ toDaily: 13, fromDaily: 16 }))).toMatch(/72 ч/);
  });

  it("increases need monthly caps, and the projected month must fit them", () => {
    expect(guard(world().engine(), up())).toMatch(/лимит не задан/);
    expect(guard(world({ limits: CAPS }).engine(), up())).toBeNull();
    const tight = world({ limits: { ...CAPS, markets: { ...CAPS.markets!, suceava: { monthlyCap: 600, targetCpql: 100 } } } });
    expect(guard(tight.engine(), up())).toMatch(/прогноз месяца по рынку/);
    const total = world({ limits: { ...CAPS, monthlyCapTotal: 500 } });
    expect(guard(total.engine(), up())).toMatch(/общего лимита/);
  });
});

describe("modes and journal", () => {
  it("observe (default) only records a recommendation, once per day", async () => {
    const app = world();
    lead(app, "other_campaign", 1);
    expect(app.engine().mode).toBe("observe");
    await runRules(app.engine());
    await runRules(app.engine());
    const a = actions(app);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ rule: "no_leads_cut", status: "recommended", mode: "observe" });
    expect(a[0].idem_key).toMatch(/^[0-9a-f]{32}$/);
  });

  it("approve asks through the bot, a press executes on the simulator", async () => {
    const app = world({ env: { SHUR_ADS_RULES_MODE: "approve" } });
    lead(app, "other_campaign", 1);
    await runRules(app.engine());
    expect(actions(app)[0].status).toBe("pending_approval");
    const ask = app.tg.sent().at(-1)!;
    expect(ask.text).toContain("симулятор");
    const outcome = await app.bot.handleUpdate({
      update_id: 1,
      callback_query: { id: "q", data: "a:1:y", from: { id: 42 }, message: { message_id: 1, chat: { id: -1001 }, text: String(ask.text) } },
    });
    expect(outcome).toBe("action:executed");
    expect(actions(app)[0].result).toMatch(/симуляция|ничего не отправлено/);
    expect((await decide(app.engine(), 1, "approve", "t")).note).toMatch(/уже executed/);
  });

  it("approve re-checks the guards on the press, and a reject is final", async () => {
    const app = world({ env: { SHUR_ADS_RULES_MODE: "approve" } });
    lead(app, "other_campaign", 1);
    await runRules(app.engine());
    setStop(app.config.dataDir, "test", "t");
    expect((await decide(app.engine(), 1, "approve", "t")).status).toBe("blocked");

    const other = world({ env: { SHUR_ADS_RULES_MODE: "approve" } });
    lead(other, "other_campaign", 1);
    await runRules(other.engine());
    expect((await decide(other.engine(), 1, "reject", "t")).status).toBe("rejected");
  });

  it("auto executes inside the limits, via the simulator only — no request leaves the process", async () => {
    const calls: string[] = [];
    const fetchFn = (async (url: string) => {
      calls.push(url);
      throw new Error("network must not be touched");
    }) as unknown as typeof fetch;
    const app = testApp({ env: { SHUR_ADS_RULES_MODE: "auto" }, fetchFn });
    seedCampaign(app.db, { id: "c1", name: "sv_test", market: "suceava", daily: 20, spendPerDay: 20, days: 30, today: TODAY });
    markCollected(app.db, NOW);
    lead(app, "other_campaign", 1);
    const r = await runRules(app.engine());
    expect(r.recorded[0].status).toBe("executed");
    expect(app.writer.kind).toBe("simulator");
    expect(calls).toEqual([]);
  });

  it("the write layer has no Meta implementation in the source", () => {
    const src = readFileSync(join(import.meta.dirname, "../src/meta/writer.ts"), "utf8");
    expect(src).not.toMatch(/fetch|graphPost|https?:\/\//);
    const insights = readFileSync(join(import.meta.dirname, "../src/meta/insights.ts"), "utf8");
    expect(insights).not.toMatch(/graphPost|method:\s*"POST"/);
  });
});
