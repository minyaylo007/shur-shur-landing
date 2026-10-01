import type { Db } from "./db.ts";
import type { Limits } from "./config.ts";
import { MARKETS } from "./config.ts";
import { computeMetrics, type Rate, type CostPer, type MarketMetrics } from "./metrics.ts";
import { freshness } from "./meta/insights.ts";
import { isStopped } from "./safety.ts";
import { addDays, dateInZone } from "./time.ts";
import { MARKET_LABEL } from "./bot.ts";

/* Daily report and alerts. Plain text, Russian, per market — markets are
   never folded into one line. Every rate shows its interval, and small
   samples say so, because 2 of 3 is not «67 %». No personal data. */

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
const money = (x: number) => (Math.round(x * 100) / 100).toLocaleString("ru-RU");

export function fmtRate(r: Rate): string {
  if (r.n === 0) return "— (нет данных)";
  const tag = r.smallSample ? " · мало данных" : "";
  return `${pct(r.rate)} [${pct(r.low)}–${pct(r.high)}] (${r.k}/${r.n})${tag}`;
}

export function fmtCost(c: CostPer): string {
  const tag = c.smallSample ? " · мало данных" : "";
  if (c.value === null) return `— (0 шт., расход ${c.currency})${tag}`;
  const hi = c.high === null ? "∞" : money(c.high);
  return `${money(c.value)} ${c.currency} [${c.low === null ? "—" : money(c.low)}–${hi}]${tag}`;
}

function marketBlock(m: MarketMetrics): string {
  const spend = Object.entries(m.spend).map(([c, s]) => `${money(s)} ${c}`).join(" + ") || "0";
  const revenue = Object.entries(m.revenue).map(([c, s]) => `${money(s)} ${c}`).join(" + ") || "0";
  return [
    `${MARKET_LABEL[m.market] ?? m.market}`,
    `  расход ${spend} · лиды ${m.leads} (Meta считает ${m.platformLeads}) · повторы ${m.duplicates} · спам ${m.spam}`,
    `  связались ${m.contacted} · квал. ${m.qualified} · предложения ${m.proposals} · сделки ${m.won} на ${revenue}`,
    `  CPQL ${m.cpql.map(fmtCost).join("; ") || "—"}`,
    `  CAC  ${m.cac.map(fmtCost).join("; ") || "—"}`,
    ...(m.roas.length ? [`  ROAS ${m.roas.map((r) => `${r.value.toFixed(2)} (${r.currency})`).join("; ")}`] : []),
    `  лид→квал ${fmtRate(m.conversions.leadToQualified)}`,
    `  квал→предл ${fmtRate(m.conversions.qualifiedToProposal)}`,
    `  предл→сделка ${fmtRate(m.conversions.proposalToWon)}`,
  ].join("\n");
}

export function alerts(db: Db, limits: Limits, dataDir: string, now = new Date()): string[] {
  const out: string[] = [];
  const stop = isStopped(dataDir);
  if (stop.stopped) out.push(`⛔ Аварийная остановка включена: ${stop.reason}`);
  const f = freshness(db, "meta", now);
  if (f.ageHours === null) out.push("⚠ Данные Meta ни разу не собирались");
  else if (f.ageHours > limits.staleHours) out.push(`⚠ Данные Meta не обновлялись ${Math.floor(f.ageHours)} ч (порог ${limits.staleHours} ч)`);
  if (f.lastRunOk === false) out.push("⚠ Последний сбор данных Meta завершился ошибкой");

  const today = dateInZone(now, "UTC");
  const feedSince = addDays(today, -(limits.evalDays - 1));
  const anySpend = db.prepare("SELECT COALESCE(SUM(spend),0) AS s FROM insights WHERE level='campaign' AND date>=?").get(feedSince) as { s: number };
  const anyLead = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE substr(created_at,1,10)>=?").get(feedSince) as { n: number };
  if (anySpend.s > 0 && anyLead.n === 0) {
    out.push(`⚠ За ${limits.evalDays} дн. в учёт не пришло ни одной заявки при расходе — проверьте связь сайт → учёт (LEDGER_URL, секрет). Правила по лидам молчат.`);
  }
  const since = addDays(today, -(limits.alertWindowDays - 1));
  for (const market of MARKETS) {
    const spend = db
      .prepare("SELECT COALESCE(SUM(spend),0) AS s, MAX(currency) AS c FROM insights WHERE level='campaign' AND market=? AND date>=? AND date<=?")
      .get(market, since, today) as { s: number; c: string | null };
    const leads = db
      .prepare("SELECT COUNT(*) AS n FROM leads WHERE market=? AND is_spam=0 AND substr(created_at,1,10)>=? AND substr(created_at,1,10)<=?")
      .get(market, since, today) as { n: number };
    if (spend.s >= limits.spendWithoutLeadsAlert && leads.n === 0) {
      out.push(`⚠ ${MARKET_LABEL[market]}: расход ${money(spend.s)} ${spend.c ?? ""} за ${limits.alertWindowDays} дн. и ни одного лида`);
    }
  }
  return out;
}

export function buildReport(
  db: Db,
  limits: Limits,
  dataDir: string,
  opts: { now?: Date; days?: number; modes: Record<string, string>; mode: string },
): string {
  const now = opts.now ?? new Date();
  const until = dateInZone(now, "UTC");
  const since = addDays(until, -((opts.days ?? 30) - 1));
  const m = computeMetrics(db, since, until, limits);
  const actions = db
    .prepare("SELECT id, rule, status, reason, result FROM actions WHERE created_at >= ? ORDER BY id DESC LIMIT 10")
    .all(new Date(now.getTime() - 86400_000).toISOString()) as { id: number; rule: string; status: string; reason: string; result: string | null }[];
  const al = alerts(db, limits, dataDir, now);

  const header = [
    `📊 SHUR-SHUR · реклама и лиды · ${since}…${until}`,
    `Meta: ${opts.modes.meta === "fixtures" ? "ФИКСТУРЫ (не настоящие цифры)" : "живые данные"} · Google Ads: не подключён · правила: ${opts.mode} · исполнитель: симулятор`,
    "Интервалы — 95 %; «мало данных» = выборка меньше порога.",
  ];
  return [
    ...header,
    ...(al.length ? ["", ...al] : []),
    "",
    ...m.markets.map(marketBlock).flatMap((b) => [b, ""]),
    actions.length ? "Правила за сутки:" : "Правила за сутки: предложений нет.",
    ...actions.map((a) => `  #${a.id} ${a.rule} → ${a.status}: ${a.result ?? a.reason}`),
  ].join("\n");
}
