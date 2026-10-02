import { loadConfig, HOST } from "./config.ts";
import { createApp, runDaily, redeliver } from "./app.ts";
import { deleteLead } from "./delivery.ts";
import { listen } from "./server.ts";
import { collect } from "./meta/insights.ts";
import { setStatus, resolveLeadId, FunnelError, LOST_REASONS, type Status, type LostReason } from "./funnel.ts";
import { sendStageEvent } from "./meta/capi.ts";
import { buildReport } from "./report.ts";
import { runRules, decide } from "./rules.ts";
import { setStop, clearStop, isStopped } from "./safety.ts";
import { log } from "./log.ts";

/* node ads-engine/src/cli.ts <command>. The CLI never prints names or
   contacts: `leads` lists id, date, market, kind, status only. */

const USAGE = `Команды:
  serve                         приём лидов на ${HOST}:PORT + служебный бот (long polling)
  daily                         сбор Meta → правила → отчёт (то, что делает таймер)
  collect                       только сбор Meta Insights
  report                        напечатать отчёт
  rules                         прогнать правила
  leads [N]                     последние N заявок (без имён и контактов), с отметкой доставки
  redeliver                     один проход повторной доставки (то, что serve делает раз в 30 с)
  delete-lead <lead_id>         удалить одну заявку целиком (полный UUID), напр. тестовую
  set <id> <статус> [--reason R] [--amount N --currency EUR]
                                статусы: new contacted qualified proposal won lost
                                причины: ${Object.keys(LOST_REASONS).join(", ")}
  actions [N]                   журнал правил «причина → действие → результат»
  approve <id> | reject <id>    решение по действию в режиме approve
  stop [причина] | resume       аварийная остановка / снять
  status                        режимы и состояние`;

const REDELIVERY_TICK_MS = 30_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const app = createApp(loadConfig());
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
