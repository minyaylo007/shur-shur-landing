import type { Db } from "./db.ts";
import type { Limits, Market, RulesMode } from "./config.ts";
import { sha256Hex } from "./normalize.ts";
import { poissonInterval } from "./metrics.ts";
import { freshness } from "./meta/insights.ts";
import type { AdsWriter, BudgetChange } from "./meta/writer.ts";
import { isStopped } from "./safety.ts";
import { addDays, dateInZone, daysBetween, daysInMonth } from "./time.ts";
import { log } from "./log.ts";

/* Budget rules. Three modes:
     observe  — recommendations only (default);
     approve  — the change is prepared, a human presses a button, then it runs;
     auto     — runs by itself, but only inside every limit below.
   Whatever the mode, the executor is the SIMULATOR in this version.

   Every proposal is written to the `actions` journal as reason → action →
   result, under an idempotency key (rule | object | evaluation day | target),
   so a second run the same day neither duplicates the row nor re-sends the
   approval request. Guards run twice for approve mode: when the proposal is
   made and again when the button is pressed — the world may have changed. */

export type ActionStatus = "recommended" | "pending_approval" | "executed" | "rejected" | "blocked" | "expired" | "failed";

export interface Proposal {
  rule: "no_leads_cut" | "cpql_high_cut" | "cpql_low_scale";
  market: Market;
  objectId: string;
  level: "campaign" | "adset";
  objectName: string;
  fromDaily: number;
  toDaily: number;
  currency: string;
  reason: string;
  evalUntil: string;
}

export interface EngineContext {
  db: Db;
  limits: Limits;
  mode: RulesMode;
  dataDir: string;
  writer: AdsWriter;
  now?: Date;
  /** Approve mode: asks a human (Telegram buttons). */
  requestApproval?: (actionId: number, p: Proposal) => Promise<void>;
}

interface BudgetObj {
  object_id: string;
  level: "campaign" | "adset";
  name: string;
  market: Market;
  daily_budget: number;
  currency: string;
}

const APPROVAL_TTL_HOURS = 48;

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function accountToday(db: Db, now: Date): string {
  const tz = db.prepare("SELECT timezone FROM insights LIMIT 1").get() as { timezone: string } | undefined;
  return dateInZone(now, tz?.timezone ?? "UTC");
}

/* Lead ↔ ad object link, by the UTM convention in the README:
   utm_campaign = {{campaign.name}}, utm_term = {{adset.name}}. */
function leadCounts(db: Db, obj: BudgetObj, since: string, until: string) {
  const key = obj.level === "campaign" ? "$.utm_campaign" : "$.utm_term";
  const r = db
    .prepare(
      `SELECT COUNT(*) AS leads, SUM(CASE WHEN max_stage >= 2 THEN 1 ELSE 0 END) AS qualified
       FROM leads WHERE is_spam = 0 AND is_duplicate = 0
         AND lower(json_extract(attribution, '${key}')) = lower(?)
         AND substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?`,
    )
    .get(obj.name, since, until) as { leads: number; qualified: number | null };
  return { leads: r.leads, qualified: r.qualified ?? 0 };
}

function objectSpend(db: Db, obj: BudgetObj, since: string, until: string) {
  const r = db
    .prepare(
      "SELECT COALESCE(SUM(spend),0) AS spend, MIN(date) AS first FROM insights WHERE level = ? AND object_id = ? AND date >= ? AND date <= ?",
    )
    .get(obj.level, obj.object_id, since, until) as { spend: number; first: string | null };
  const first = db
    .prepare("SELECT MIN(date) AS first FROM insights WHERE level = ? AND object_id = ? AND spend > 0")
    .get(obj.level, obj.object_id) as { first: string | null };
  return { spend: r.spend, firstSpend: first.first };
}

/** Pure part: what the numbers suggest, before any guard. */
export function propose(ctx: EngineContext): Proposal[] {
  const { db, limits } = ctx;
  const now = ctx.now ?? new Date();
  const today = accountToday(db, now);
  const evalUntil = addDays(today, -limits.conversionLagDays);
  const evalSince = addDays(evalUntil, -(limits.evalDays - 1));
  const step = limits.maxStepPct / 100;

  const objs = db
    .prepare(
      "SELECT object_id, level, name, market, daily_budget, currency FROM budgets WHERE daily_budget > 0 AND status = 'ACTIVE'",
    )
    .all() as unknown as BudgetObj[];

  // Zero leads in the WHOLE ledger means the site → ledger feed is down or not
  // connected yet, not that every campaign failed: lead-based rules stay silent
  // (the report raises its own alert for this).
  const feed = db
    .prepare("SELECT COUNT(*) AS n FROM leads WHERE substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?")
    .get(evalSince, evalUntil) as { n: number };
  if (feed.n === 0) return [];

  const out: Proposal[] = [];
  for (const obj of objs) {
    const { spend } = objectSpend(db, obj, evalSince, evalUntil);
    const { leads, qualified } = leadCounts(db, obj, evalSince, evalUntil);
    const target = limits.markets[obj.market]?.targetCpql ?? 0;
    const base = { market: obj.market, objectId: obj.object_id, level: obj.level, objectName: obj.name, fromDaily: obj.daily_budget, currency: obj.currency, evalUntil };
    const window = `${evalSince}…${evalUntil}`;

    if (spend < limits.minSpend) continue; // minimum data: nothing to say yet

    if (leads === 0) {
      out.push({
        ...base,
        rule: "no_leads_cut",
        toDaily: round2(obj.daily_budget * (1 - step)),
        reason: `расход ${round2(spend)} ${obj.currency} за ${window} без единого лида`,
      });
      continue;
    }
    if (target <= 0 || leads < limits.minLeads) continue;

    const cpql = qualified > 0 ? spend / qualified : Infinity;
    const { low, high } = poissonInterval(qualified);
    const cpqlBest = spend / high; // optimistic end
    const cpqlWorst = low > 0 ? spend / low : Infinity; // pessimistic end

    if (cpqlBest > target) {
      out.push({
        ...base,
        rule: "cpql_high_cut",
        toDaily: round2(obj.daily_budget * (1 - step)),
        reason: `CPQL ${Number.isFinite(cpql) ? round2(cpql) : "∞"} ${obj.currency} (даже оптимистично ≥ ${round2(cpqlBest)}) выше цели ${target}; ${qualified} квал. из ${leads} лидов за ${window}`,
      });
    } else if (cpqlWorst < target) {
      out.push({
        ...base,
        rule: "cpql_low_scale",
        toDaily: round2(obj.daily_budget * (1 + step)),
        reason: `CPQL ${round2(cpql)} ${obj.currency} (даже пессимистично ≤ ${round2(cpqlWorst)}) ниже цели ${target}; ${qualified} квал. из ${leads} лидов за ${window}`,
      });
    }
  }
  return out;
}

/** Guards. Returns the reason the proposal may NOT run, or null. */
export function guard(ctx: EngineContext, p: Proposal): string | null {
  const { db, limits, dataDir } = ctx;
  const now = ctx.now ?? new Date();
  const stop = isStopped(dataDir);
  if (stop.stopped) return `аварийная остановка (${stop.reason})`;

  const increase = p.toDaily > p.fromDaily;
  const pct = Math.abs(p.toDaily - p.fromDaily) / p.fromDaily * 100;
  if (pct > limits.maxStepPct + 1e-9) return `шаг ${round2(pct)}% больше предела ${limits.maxStepPct}%`;

  if (increase) {
    const f = freshness(db, "meta", now);
    if (f.lastRunOk === false) return "последний сбор данных упал — повышать нельзя";
    if (f.ageHours === null || f.ageHours > limits.staleHours) return `данные старше ${limits.staleHours} ч — повышать нельзя`;
  }

  const obj = db.prepare("SELECT fetched_at FROM budgets WHERE object_id = ?").get(p.objectId);
  if (!obj) return "объект больше не найден в кабинете";
  const { firstSpend } = objectSpend(db, { object_id: p.objectId, level: p.level } as BudgetObj, "0000", "9999");
  const today = accountToday(db, now);
  if (!firstSpend || daysBetween(firstSpend, today) < limits.learningDays) {
    return `фаза обучения: объект крутится меньше ${limits.learningDays} дн.`;
  }

  const last = db
    .prepare("SELECT executed_at FROM actions WHERE object_id = ? AND status = 'executed' ORDER BY executed_at DESC LIMIT 1")
    .get(p.objectId) as { executed_at: string } | undefined;
  if (last && (now.getTime() - Date.parse(last.executed_at)) / 3600_000 < limits.minHoursBetweenChanges) {
    return `прошло меньше ${limits.minHoursBetweenChanges} ч с прошлого изменения`;
  }

  if (increase) {
    const cap = limits.markets[p.market]?.monthlyCap ?? 0;
    if (cap <= 0 || limits.monthlyCapTotal <= 0) return "месячный лимит не задан — повышать нельзя";
    const monthStart = today.slice(0, 8) + "01";
    const remaining = daysInMonth(today) - Number(today.slice(8, 10)) + 1;
    const mtd = (market: Market | null) =>
      (
        db
          .prepare(
            `SELECT COALESCE(SUM(spend),0) AS s FROM insights WHERE level = 'campaign' AND date >= ? AND date <= ?${market ? " AND market = ?" : ""}`,
          )
          .get(...(market ? [monthStart, today, market] : [monthStart, today])) as { s: number }
      ).s;
    const budgets = (market: Market | null) =>
      (
        db
          .prepare(
            `SELECT COALESCE(SUM(daily_budget),0) AS b FROM budgets WHERE status = 'ACTIVE' AND daily_budget > 0${market ? " AND market = ?" : ""}`,
          )
          .get(...(market ? [market] : [])) as { b: number }
      ).b;
    const delta = p.toDaily - p.fromDaily;
    const projMarket = mtd(p.market) + (budgets(p.market) + delta) * remaining;
    if (projMarket > cap) return `прогноз месяца по рынку ${round2(projMarket)} > лимита ${cap}`;
    const projTotal = mtd(null) + (budgets(null) + delta) * remaining;
    if (projTotal > limits.monthlyCapTotal) return `прогноз месяца всего ${round2(projTotal)} > общего лимита ${limits.monthlyCapTotal}`;
  }
  return null;
}

export function idemKey(p: Proposal): string {
  return sha256Hex(`${p.rule}|${p.objectId}|${p.evalUntil}|${p.toDaily}`).slice(0, 32);
}

function change(p: Proposal): BudgetChange {
  return { objectId: p.objectId, level: p.level, fromDaily: p.fromDaily, toDaily: p.toDaily, currency: p.currency };
}

async function execute(ctx: EngineContext, id: number, p: Proposal, by: string): Promise<ActionStatus> {
  const now = ctx.now ?? new Date();
  try {
    const res = await ctx.writer.setDailyBudget(change(p), idemKey(p));
    ctx.db
      .prepare("UPDATE actions SET status = ?, result = ?, decided_by = ?, executed_at = ? WHERE id = ?")
      .run(res.ok ? "executed" : "failed", res.detail, by, now.toISOString(), id);
    log("rules.executed", { id, rule: p.rule, object_id: p.objectId, simulated: res.simulated, ok: res.ok });
    return res.ok ? "executed" : "failed";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.db.prepare("UPDATE actions SET status = 'failed', result = ?, decided_by = ? WHERE id = ?").run(message.slice(0, 300), by, id);
    return "failed";
  }
}

export interface RunSummary {
  proposals: number;
  recorded: { id: number; rule: string; objectId: string; status: ActionStatus; note: string }[];
}

export async function runRules(ctx: EngineContext): Promise<RunSummary> {
  const { db, mode } = ctx;
  const now = ctx.now ?? new Date();
  const proposals = propose(ctx);
  const recorded: RunSummary["recorded"] = [];
  for (const p of proposals) {
    const key = idemKey(p);
    if (db.prepare("SELECT id FROM actions WHERE idem_key = ?").get(key)) continue;
    const blocked = guard(ctx, p);
    const status: ActionStatus = blocked
      ? "blocked"
      : mode === "observe"
        ? "recommended"
        : mode === "approve"
          ? "pending_approval"
          : "pending_approval"; // auto: recorded, then executed right below
    const info = db
      .prepare(
        `INSERT INTO actions(idem_key, created_at, rule, market, object_id, mode, reason, action_json, status, result)
         VALUES(?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(key, now.toISOString(), p.rule, p.market, p.objectId, mode, p.reason, JSON.stringify(p), status, blocked);
    const id = Number(info.lastInsertRowid);
    let final: ActionStatus = status;
    if (!blocked && mode === "auto") final = await execute(ctx, id, p, "auto");
    if (!blocked && mode === "approve" && ctx.requestApproval) await ctx.requestApproval(id, p);
    recorded.push({ id, rule: p.rule, objectId: p.objectId, status: final, note: blocked ?? p.reason });
  }
  log("rules.run", { mode, proposals: proposals.length, recorded: recorded.length });
  return { proposals: proposals.length, recorded };
}

export async function decide(
  ctx: EngineContext,
  id: number,
  decision: "approve" | "reject",
  by: string,
): Promise<{ status: ActionStatus; note: string }> {
  const { db } = ctx;
  const now = ctx.now ?? new Date();
  const row = db.prepare("SELECT status, created_at, action_json FROM actions WHERE id = ?").get(id) as
    | { status: ActionStatus; created_at: string; action_json: string }
    | undefined;
  if (!row) return { status: "failed", note: "нет такого действия" };
  if (row.status !== "pending_approval") return { status: row.status, note: `уже ${row.status}` };
  if (decision === "reject") {
    db.prepare("UPDATE actions SET status = 'rejected', decided_by = ?, result = 'отклонено человеком' WHERE id = ?").run(by, id);
    return { status: "rejected", note: "отклонено" };
  }
  if ((now.getTime() - Date.parse(row.created_at)) / 3600_000 > APPROVAL_TTL_HOURS) {
    db.prepare("UPDATE actions SET status = 'expired', decided_by = ? WHERE id = ?").run(by, id);
    return { status: "expired", note: `старше ${APPROVAL_TTL_HOURS} ч — данные устарели, пересчитайте` };
  }
  const p = JSON.parse(row.action_json) as Proposal;
  const blocked = guard(ctx, p);
  if (blocked) {
    db.prepare("UPDATE actions SET status = 'blocked', decided_by = ?, result = ? WHERE id = ?").run(by, blocked, id);
    return { status: "blocked", note: blocked };
  }
  const status = await execute(ctx, id, p, by);
  return { status, note: status === "executed" ? "выполнено (симуляция)" : "сбой исполнителя" };
}
