import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { loadConfig, type Config, type Limits, DEFAULT_LIMITS } from "../src/config.ts";
import { createApp, type App } from "../src/app.ts";
import { openDb, type Db } from "../src/db.ts";
import { FakeTelegram } from "../src/telegram.ts";
import { sign } from "../src/hmac.ts";
import { setLogSink } from "../src/log.ts";
import type { AdsReader } from "../src/meta/insights.ts";

// Quiet by default; captureLog() below switches the sink on per test.
setLogSink(() => {});

export const SECRET = "test-secret-not-real";
export const CHAT = "-1001";
export const NOW = new Date("2026-09-29T09:00:00Z");

export function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), "shur-ads-test-"));
}

export function testApp(
  opts: { env?: Record<string, string>; limits?: Partial<Limits>; reader?: AdsReader; fetchFn?: typeof fetch; now?: Date } = {},
): App & { tg: FakeTelegram } {
  const dir = tmpDir();
  const limitsFile = join(dir, "limits.json");
  writeFileSync(limitsFile, JSON.stringify({ ...DEFAULT_LIMITS, ...(opts.limits ?? {}) }));
  const config: Config = loadConfig({
    SHUR_ADS_DATA_DIR: join(dir, "data"),
    SHUR_ADS_LIMITS_FILE: limitsFile,
    LEDGER_HMAC_SECRET: SECRET,
    SHUR_OPS_CHAT_ID: CHAT,
    ...(opts.env ?? {}),
  });
  const tg = new FakeTelegram();
  const now = opts.now ?? NOW;
  const app = createApp(config, {
    db: openDb(config.dataDir),
    telegram: tg,
    reader: opts.reader,
    fetchFn: opts.fetchFn,
    now: () => now,
  });
  return Object.assign(app, { tg });
}

export function memDb(): Db {
  return openDb(":memory:");
}

export function leadBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    lead_id: randomUUID(),
    created_at: NOW.toISOString(),
    kind: "lead",
    locale: "ro",
    market: "suceava",
    name: "Ioana Testescu",
    contact: "+40 712 345 678",
    message: "Vrem o sesiune foto",
    ig_handle: null,
    attribution: { utm_source: "facebook", utm_campaign: "sv_prospecting_ro", landing_path: "/ro/suceava" },
    consent: { ads: true },
    ...over,
  };
}

export function signedHeaders(raw: string, ts = Math.floor(Date.now() / 1000), secret = SECRET) {
  return {
    "content-type": "application/json",
    "x-shur-timestamp": String(ts),
    "x-shur-signature": sign(secret, String(ts), raw),
  };
}

/** Captures every log line for the duration of fn. */
export async function captureLog<T>(fn: () => Promise<T> | T): Promise<{ out: T; lines: string[] }> {
  const lines: string[] = [];
  const prev = setLogSink((l) => lines.push(l));
  try {
    return { out: await fn(), lines };
  } finally {
    setLogSink(prev);
  }
}

/** Seeds one campaign with a budget and `days` of daily spend ending yesterday. */
export function seedCampaign(
  db: Db,
  o: { id: string; name: string; market: string; daily: number; spendPerDay: number; days: number; today: string; firstDaysAgo?: number },
) {
  const fetched = NOW.toISOString();
  db.prepare(
    "INSERT OR REPLACE INTO budgets(source, object_id, level, name, market, daily_budget, currency, status, fetched_at) VALUES('meta',?, 'campaign', ?, ?, ?, 'EUR', 'ACTIVE', ?)",
  ).run(o.id, o.name, o.market, o.daily, fetched);
  const start = o.firstDaysAgo ?? o.days;
  for (let i = 1; i <= start; i++) {
    const date = new Date(Date.parse(o.today + "T00:00:00Z") - i * 86400_000).toISOString().slice(0, 10);
    db.prepare(
      `INSERT OR REPLACE INTO insights(source, level, object_id, date, campaign_id, campaign_name, object_name, market, spend, currency, timezone, fetched_at)
       VALUES('meta','campaign',?,?,?,?,?,?,?,'EUR','UTC',?)`,
    ).run(o.id, date, o.id, o.name, o.name, o.market, i <= o.days ? o.spendPerDay : 0, fetched);
  }
}

export function markCollected(db: Db, at: Date, ok = true) {
  db.prepare("INSERT INTO collector_runs(at, source, mode, ok, rows) VALUES(?, 'meta', 'fixtures', ?, 1)").run(at.toISOString(), ok ? 1 : 0);
}
