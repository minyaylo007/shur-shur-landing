import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { type Config, loadLimits, modes, type Limits } from "./config.ts";
import { openDb, type Db } from "./db.ts";
import { OpsBot } from "./bot.ts";
import { HttpTelegram, OutboxTelegram, type TelegramApi } from "./telegram.ts";
import { FixtureReader, MetaHttpReader, collect, type AdsReader } from "./meta/insights.ts";
import { SimulatorWriter, type AdsWriter } from "./meta/writer.ts";
import { sendStageEvent, retryFailed, type CapiSettings } from "./meta/capi.ts";
import type { FetchLike } from "./meta/graph.ts";
import { runRules, type EngineContext } from "./rules.ts";
import { buildReport, alerts } from "./report.ts";
import { GoogleAdsStubReader } from "./google.ts";
import type { Status } from "./funnel.ts";
import { redeliverDue, type RedeliveryPass } from "./delivery.ts";
import { log } from "./log.ts";

/* Wiring: picks live or dry implementations from the config. Tests build the
   same App with fakes through the overrides. */

export interface App {
  config: Config;
  limits: Limits;
  db: Db;
  telegram: TelegramApi;
  bot: OpsBot;
  reader: AdsReader;
  writer: AdsWriter;
  capi: CapiSettings;
  fetchFn: FetchLike;
  engine(): EngineContext;
  modes: ReturnType<typeof modes>;
}

export interface Overrides {
  db?: Db;
  telegram?: TelegramApi;
  reader?: AdsReader;
  fetchFn?: FetchLike;
  now?: () => Date;
}

export function createApp(config: Config, o: Overrides = {}): App {
  const db = o.db ?? openDb(config.dataDir);
  const limits = loadLimits(config.limitsFile);
  const mode = config.modeOverride ?? limits.mode;
  const m = modes(config);
  const fetchFn = o.fetchFn ?? fetch;
  const telegram =
    o.telegram ??
    (m.telegram === "live"
      ? new HttpTelegram(config.opsBotToken!, fetchFn)
      : new OutboxTelegram(join(config.dataDir, "telegram-outbox.jsonl")));
  const reader =
    o.reader ??
    (m.meta === "live"
      ? new MetaHttpReader(config.metaToken!, config.metaAdAccountId!, fetchFn)
      : new FixtureReader(config.fixturesFile, o.now));
  const writer = new SimulatorWriter();
  const capi: CapiSettings = {
    enabled: m.capi === "on",
    token: config.metaToken,
    datasetId: config.metaDatasetId,
    testEventCode: config.capiTestEventCode,
  };

  const engine = (): EngineContext => ({
    db,
    limits,
    mode,
    dataDir: config.dataDir,
    writer,
    now: o.now?.(),
    requestApproval: (id, p) => app.bot.requestApproval(id, p),
  });
  const app: App = { config, limits, db, telegram, reader, writer, capi, fetchFn, engine, modes: m, bot: undefined as unknown as OpsBot };
  app.bot = new OpsBot({
    db,
    api: telegram,
    chatId: config.opsChatId ?? "dry",
    dataDir: config.dataDir,
    engine,
    onTransition: (leadId: string, to: Status) => sendStageEvent(db, capi, leadId, to, fetchFn),
    report: async () => buildReport(db, limits, config.dataDir, { modes: m, mode, now: o.now?.() }),
  });
  return app;
}

/** One redelivery pass (delivery.ts) with this app's wiring. */
export function redeliver(app: App, now?: () => Date): Promise<RedeliveryPass> {
  return redeliverDue({
    db: app.db,
    siteUrl: app.config.siteUrl,
    secret: app.config.hmacSecret,
    fetchFn: app.fetchFn,
    now,
    alert: (text) => app.bot.sendText(text),
  });
}

export interface DailySummary {
  collect: { ok: boolean; rows: number; mode: string; error?: string };
  google: string;
  capiRetry: { retried: number; sent: number };
  rules: { proposals: number; recorded: number };
  delivered: "telegram" | string;
  alerts: number;
}

/** The daily timer job: collect → CAPI retries → rules → report → alerts. */
export async function runDaily(app: App): Promise<DailySummary> {
  const now = app.engine().now ?? new Date();
  const c = await collect(app.db, app.reader, { now });
  let google = "stub";
  try {
    await new GoogleAdsStubReader().account();
  } catch (e) {
    google = e instanceof Error ? "не подключён" : "stub";
  }
  const capiRetry = await retryFailed(app.db, app.capi, app.fetchFn, now);
  const rules = await runRules(app.engine());
  const report = buildReport(app.db, app.limits, app.config.dataDir, { modes: app.modes, mode: app.engine().mode, now });
  const al = alerts(app.db, app.limits, app.config.dataDir, now);

  let delivered: string;
  if (app.telegram.mode === "dry") {
    const dir = join(app.config.dataDir, "reports");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
    const file = join(dir, `${now.toISOString().slice(0, 10)}.txt`);
    writeFileSync(file, report + "\n", { mode: 0o600 });
    if (al.length) writeFileSync(join(dir, `${now.toISOString().slice(0, 10)}-alerts.txt`), al.join("\n") + "\n", { mode: 0o600 });
    delivered = file;
  } else {
    await app.bot.sendText(report);
    if (al.length) await app.bot.sendText(["🚨 Предупреждения", ...al].join("\n"));
    delivered = "telegram";
  }
  log("daily.done", { collect_ok: c.ok, rows: c.rows, proposals: rules.proposals, alerts: al.length, delivered: app.telegram.mode });
  return {
    collect: { ok: c.ok, rows: c.rows, mode: c.mode, error: c.error },
    google,
    capiRetry,
    rules: { proposals: rules.proposals, recorded: rules.recorded.length },
    delivered,
    alerts: al.length,
  };
}
