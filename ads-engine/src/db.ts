import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync, existsSync, openSync, closeSync } from "node:fs";
import { join } from "node:path";

/* SQLite through the built-in node:sqlite — no native addon to build, no
   dependency to audit. The directory is 700 and the file 600 (contract:
   personal data lives only here and in Telegram). */

export type Db = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS leads (
  lead_id        TEXT PRIMARY KEY,
  received_at    TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  kind           TEXT NOT NULL,
  locale         TEXT,
  market         TEXT NOT NULL,
  name           TEXT,
  contact        TEXT,
  message        TEXT,
  ig_handle      TEXT,
  contact_hash   TEXT,
  attribution    TEXT NOT NULL DEFAULT '{}',
  consent_ads    INTEGER NOT NULL DEFAULT 0,
  is_duplicate   INTEGER NOT NULL DEFAULT 0,
  duplicate_of   TEXT,
  is_spam        INTEGER NOT NULL DEFAULT 0,
  spam_reason    TEXT,
  status         TEXT NOT NULL DEFAULT 'new',
  max_stage      INTEGER NOT NULL DEFAULT 0,
  lost_reason    TEXT,
  deal_amount    REAL,
  deal_currency  TEXT,
  status_at      TEXT NOT NULL,
  result_json    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leads_contact ON leads(contact_hash, created_at);
CREATE INDEX IF NOT EXISTS leads_market ON leads(market, created_at);

CREATE TABLE IF NOT EXISTS lead_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id     TEXT NOT NULL REFERENCES leads(lead_id),
  at          TEXT NOT NULL,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  actor       TEXT NOT NULL,
  reason      TEXT,
  amount      REAL,
  currency    TEXT
);

CREATE TABLE IF NOT EXISTS insights (
  source      TEXT NOT NULL,
  level       TEXT NOT NULL,
  object_id   TEXT NOT NULL,
  date        TEXT NOT NULL,
  campaign_id TEXT,
  campaign_name TEXT,
  adset_id    TEXT,
  ad_id       TEXT,
  object_name TEXT,
  market      TEXT NOT NULL,
  spend       REAL NOT NULL,
  currency    TEXT NOT NULL,
  timezone    TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks      INTEGER NOT NULL DEFAULT 0,
  platform_leads INTEGER NOT NULL DEFAULT 0,
  fetched_at  TEXT NOT NULL,
  PRIMARY KEY (source, level, object_id, date)
);

CREATE TABLE IF NOT EXISTS budgets (
  source      TEXT NOT NULL,
  object_id   TEXT NOT NULL,
  level       TEXT NOT NULL,
  name        TEXT,
  market      TEXT NOT NULL,
  daily_budget REAL,
  currency    TEXT NOT NULL,
  status      TEXT,
  fetched_at  TEXT NOT NULL,
  PRIMARY KEY (source, object_id)
);

CREATE TABLE IF NOT EXISTS collector_runs (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  at       TEXT NOT NULL,
  source   TEXT NOT NULL,
  mode     TEXT NOT NULL,
  ok       INTEGER NOT NULL,
  rows     INTEGER NOT NULL DEFAULT 0,
  error    TEXT
);

CREATE TABLE IF NOT EXISTS actions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  idem_key    TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL,
  rule        TEXT NOT NULL,
  market      TEXT NOT NULL,
  object_id   TEXT NOT NULL,
  mode        TEXT NOT NULL,
  reason      TEXT NOT NULL,
  action_json TEXT NOT NULL,
  status      TEXT NOT NULL,
  result      TEXT,
  decided_by  TEXT,
  executed_at TEXT
);

CREATE TABLE IF NOT EXISTS capi_events (
  lead_id     TEXT NOT NULL,
  event_name  TEXT NOT NULL,
  at          TEXT NOT NULL,
  status      TEXT NOT NULL,
  detail      TEXT,
  PRIMARY KEY (lead_id, event_name)
);

CREATE TABLE IF NOT EXISTS kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/* Contract v1.1 (03.10.2026): delivery to the lead chat. delivered_at NULL =
   the site took the lead with `delivery: "pending"` and has not yet reported
   Telegram success; the redelivery loop (delivery.ts) owns it from then on.
   Rows that predate these columns came in under v1, where the site wrote the
   ledger only AFTER Telegram had the lead — so they are delivered by
   definition, and the backfill says so; otherwise the first retry pass after
   the upgrade would re-send every old lead to the chat. */
const DELIVERY_COLUMNS: [string, string][] = [
  ["delivered_at", "TEXT"],
  ["delivered_by", "TEXT"],
  ["delivery_attempts", "INTEGER NOT NULL DEFAULT 0"],
  ["next_attempt_at", "TEXT"],
  ["delivery_gave_up_at", "TEXT"],
];

function migrate(db: Db): void {
  const have = new Set(
    (db.prepare("PRAGMA table_info(leads)").all() as { name: string }[]).map((c) => c.name),
  );
  if (have.has("delivered_at")) return;
  tx(db, () => {
    for (const [name, type] of DELIVERY_COLUMNS) {
      if (!have.has(name)) db.exec(`ALTER TABLE leads ADD COLUMN ${name} ${type}`);
    }
    db.exec("UPDATE leads SET delivered_at = received_at, delivered_by = 'v1' WHERE delivered_at IS NULL");
    db.exec("CREATE INDEX IF NOT EXISTS leads_undelivered ON leads(next_attempt_at) WHERE delivered_at IS NULL");
  });
}

export function openDb(dataDir: string | ":memory:"): Db {
  if (dataDir === ":memory:") {
    const db = new DatabaseSync(":memory:");
    db.exec(SCHEMA);
    migrate(db);
    return db;
  }
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  chmodSync(dataDir, 0o700);
  const file = join(dataDir, "ledger.sqlite");
  if (!existsSync(file)) closeSync(openSync(file, "a", 0o600));
  chmodSync(file, 0o600);
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

export function kvGet(db: Db, key: string): string | undefined {
  const row = db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

export function kvSet(db: Db, key: string, value: string): void {
  db.prepare(
    "INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

export function kvDelete(db: Db, key: string): void {
  db.prepare("DELETE FROM kv WHERE key = ?").run(key);
}

/** Runs fn inside one transaction; SQLite serialises writers anyway. */
export function tx<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
