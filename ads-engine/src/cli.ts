import { loadConfig, HOST } from "./config.ts";
import { createApp, runDaily, redeliver, pushCabinet } from "./app.ts";
import { deleteLead } from "./delivery.ts";
import { listen } from "./server.ts";
import { collect } from "./meta/insights.ts";
import { setStatus, resolveLeadId, FunnelError, LOST_REASONS, type Status, type LostReason } from "./funnel.ts";
import { sendStageEvent } from "./meta/capi.ts";
import { buildReport } from "./report.ts";
import { runRules, decide } from "./rules.ts";
import { setStop, clearStop, isStopped } from "./safety.ts";
import { log } from "./log.ts";
import { pickupMetaKey, pickupOpsBot } from "./meta-key.ts";
import { execFile } from "node:child_process";
import { parseSale, recordSale, deleteSale, listSales, SALE_USAGE } from "./sales.ts";
import { buildAnalysis, writeAnalysis } from "./analysis.ts";

/* node ads-engine/src/cli.ts <command>. The CLI never prints names or
   contacts: `leads` lists id, date, market, kind, status only. */

const USAGE = `Команды:
  serve                         приём лидов на ${HOST}:PORT + служебный бот (long polling)
  daily                         сбор Meta → правила → отчёт (то, что делает таймер)
  cabinet                       снимок для кабинета хозяйки → сайт (daily делает это сам)
  ops-bot                       забрать токен служебного бота, переданный в кабинете, в env (daily делает это сам)
  meta-key                      забрать ключ Meta, переданный в кабинете, в env (daily делает это сам)
  collect                       только сбор Meta Insights
  report                        напечатать отчёт
  rules                         прогнать правила
  leads [N]                     последние N заявок (без имён и контактов), с отметкой доставки
  redeliver                     один проход повторной доставки (то, что serve делает раз в 30 с)
  delete-lead <lead_id>         удалить одну заявку целиком (полный UUID), напр. тестовую
  set <id> <статус> [--reason R] [--amount N --currency EUR]
                                статусы: new contacted qualified proposal won lost
                                причины: ${Object.keys(LOST_REASONS).join(", ")}
  client <сумма> <валюта> <источник> [рынок]
                                клиент без заявки на сайте (Direct, форма Meta): учёт в CAC, без имён
  clients [N]                   последние N таких продаж
  delete-client <id>            удалить ошибочную запись продажи
  analysis-data                 JSON для ежедневного разбора → data/analysis/<дата>.json (daily делает это сам)
  actions [N]                   журнал правил «причина → действие → результат»
  approve <id> | reject <id>    решение по действию в режиме approve
  stop [причина] | resume       аварийная остановка / снять
  status                        режимы и состояние`;

const REDELIVERY_TICK_MS = 30_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only this project's own unit, by its exact name; never anything else on the machine. */
function restartOwnService(): Promise<void> {
  return new Promise((resolve) => {
    execFile("systemctl", ["--user", "try-restart", "ihor-shur-ads.service"], { timeout: 30_000 }, (error) => {
      log("ops_bot.service_restart", { ok: !error });
      resolve();
    });
  });
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main(argv: string[]) {
  const [cmd, ...args] = argv;
  if (!cmd || cmd === "help" || cmd === "--help") {
    console.log(USAGE);
    return 0;
  }
  let config = loadConfig();
  if (cmd === "daily" || cmd === "meta-key") {
    // Her Meta key from the cabinet first, so this very run already uses it.
    const got = await pickupMetaKey({
      siteUrl: config.siteUrl,
      secret: config.cabinetSecret,
      cryptKey: config.cabinetMetaKey,
      envFile: config.envFile,
    });
    if (got.values) {
      Object.assign(process.env, got.values);
      config = loadConfig();
    }
    if (cmd === "meta-key") {
      const names = got.values ? ` → ${Object.keys(got.values).join(", ")} в ${config.envFile}` : "";
      console.log(`ключ Meta: ${got.outcome}${names}`);
      return got.outcome === "failed" || got.outcome === "refused" ? 1 : 0;
    }
  }
  if (cmd === "daily" || cmd === "ops-bot") {
    // Her ops-bot token from the cabinet: this run reports through it, and the
    // long-polling service is restarted so /client and the buttons use it too.
    const got = await pickupOpsBot({
      siteUrl: config.siteUrl,
      secret: config.cabinetSecret,
      cryptKey: config.cabinetMetaKey,
      envFile: config.envFile,
    });
    if (got.values) {
      Object.assign(process.env, got.values);
      config = loadConfig();
      await restartOwnService();
    }
    if (cmd === "ops-bot") {
      const names = got.values ? ` → ${Object.keys(got.values).join(", ")} в ${config.envFile}` : "";
      console.log(`служебный бот: ${got.outcome}${names}`);
      return got.outcome === "failed" || got.outcome === "refused" ? 1 : 0;
    }
  }
  const app = createApp(config);
  switch (cmd) {
    case "serve": {
      const server = await listen(app);
      const ac = new AbortController();
      log("serve.start", { host: HOST, port: app.config.port, ...app.modes, rules_mode: app.engine().mode });
      const polling = app.modes.telegram === "live" ? app.bot.poll(ac.signal) : Promise.resolve();
      // Contract v1.1: leads the site could not hand to Telegram, every 30 s.
      const tick = () =>
        redeliver(app).catch((e) => log("redelivery.error", { error: e instanceof Error ? e.message.slice(0, 200) : "unknown" }));
      const redelivery = setInterval(tick, REDELIVERY_TICK_MS);
      void tick();
      const shutdown = () => {
        log("serve.stop", {});
        clearInterval(redelivery);
        ac.abort();
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 3000).unref();
      };
      process.on("SIGTERM", shutdown);
      process.on("SIGINT", shutdown);
      await polling;
      await new Promise(() => {});
      return 0;
    }
    case "daily":
      console.log(JSON.stringify(await runDaily(app), null, 2));
      return 0;
    case "cabinet":
      console.log(await pushCabinet(app));
      return 0;
    case "collect":
      console.log(JSON.stringify(await collect(app.db, app.reader), null, 2));
      return 0;
    case "report":
      console.log(buildReport(app.db, app.limits, app.config.dataDir, { modes: app.modes, mode: app.engine().mode }));
      return 0;
    case "rules":
      console.log(JSON.stringify(await runRules(app.engine()), null, 2));
      return 0;
    case "leads": {
      const rows = app.db
        .prepare(
          "SELECT lead_id, created_at, market, kind, status, is_duplicate AS dup, is_spam AS spam, COALESCE(delivered_by, CASE WHEN delivery_gave_up_at IS NULL THEN 'ждёт' ELSE 'не доставлена' END) AS delivered FROM leads ORDER BY created_at DESC LIMIT ?",
        )
        .all(Number(args[0] ?? 20));
      console.table(rows);
      return 0;
    }
    case "redeliver":
      console.log(JSON.stringify(await redeliver(app), null, 2));
      return 0;
    case "delete-lead": {
      // Full id only: a prefix that happens to match is not a delete target.
      const id = (args[0] ?? "").toLowerCase();
      if (!UUID.test(id)) {
        console.error("delete-lead: нужен полный lead_id (UUID)");
        return 2;
      }
      const n = deleteLead(app.db, id);
      log("lead.deleted", { lead_id: id, rows: n, actor: `cli:${process.env.USER ?? "?"}` });
      console.log(n === 1 ? `удалена: ${id}` : `не найдена: ${id}`);
      return n === 1 ? 0 : 1;
    }
    case "set": {
      const [id, to] = args;
      try {
        const leadId = resolveLeadId(app.db, id ?? "");
        const amount = flag(args, "--amount");
        const t = setStatus(app.db, leadId, {
          to: to as Status,
          actor: `cli:${process.env.USER ?? "?"}`,
          reason: flag(args, "--reason") as LostReason | undefined,
          amount: amount === undefined ? undefined : Number(amount),
          currency: flag(args, "--currency")?.toUpperCase(),
        });
        log("funnel.transition", { lead_id: leadId, from: t.from, to: t.to, actor: "cli" });
        const capi = await sendStageEvent(app.db, app.capi, leadId, t.to, app.fetchFn);
        console.log(`${leadId.slice(0, 8)}: ${t.from} → ${t.to} (Conversions API: ${capi})`);
        return 0;
      } catch (e) {
        console.error(e instanceof FunnelError ? `${e.code}: ${e.message}` : e);
        return 1;
      }
    }
    case "client": {
      const sale = parseSale(args.join(" "));
      if (!sale) {
        console.error(SALE_USAGE.replaceAll("/client", "client"));
        return 2;
      }
      const id = recordSale(app.db, sale, `cli:${process.env.USER ?? "?"}`);
      log("sale.recorded", { id, source: sale.source, market: sale.market, by: "cli" });
      console.log(`клиент #${id}: ${sale.amount} ${sale.currency}, ${sale.source}, ${sale.market}`);
      return 0;
    }
    case "clients":
      console.table(listSales(app.db, Number(args[0] ?? 20)));
      return 0;
    case "delete-client": {
      const ok = deleteSale(app.db, Number(args[0]));
      if (ok) log("sale.deleted", { id: Number(args[0]), by: "cli" });
      console.log(ok ? `удалена #${args[0]}` : `не найдена #${args[0] ?? ""}`);
      return ok ? 0 : 1;
    }
    case "analysis-data":
      console.log(writeAnalysis(app.config.dataDir, buildAnalysis(app.db, { metaMode: app.modes.meta, limits: app.limits })));
      return 0;
    case "actions":
      console.table(
        app.db
          .prepare("SELECT id, created_at, rule, market, mode, status, reason, result FROM actions ORDER BY id DESC LIMIT ?")
          .all(Number(args[0] ?? 20)),
      );
      return 0;
    case "approve":
    case "reject": {
      const r = await decide(app.engine(), Number(args[0]), cmd, `cli:${process.env.USER ?? "?"}`);
      console.log(`${r.status}: ${r.note}`);
      return r.status === "failed" ? 1 : 0;
    }
    case "stop":
      setStop(app.config.dataDir, args.join(" ") || "команда stop", `cli:${process.env.USER ?? "?"}`);
      console.log("Аварийная остановка включена.");
      return 0;
    case "resume":
      console.log(clearStop(app.config.dataDir) ? "Остановка снята." : "Остановки не было.");
      return 0;
    case "status":
      console.log(JSON.stringify({ modes: app.modes, rules_mode: app.engine().mode, stop: isStopped(app.config.dataDir) }, null, 2));
      return 0;
    default:
      console.error(USAGE);
      return 2;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
