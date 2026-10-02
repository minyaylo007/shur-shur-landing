import { tx, type Db } from "./db.ts";
import type { FetchLike } from "./meta/graph.ts";
import { sign } from "./hmac.ts";
import { log } from "./log.ts";

/* Contract v1.1 (03.10.2026): the lead must reach the lead chat even when
   Telegram was down at submit time.

   The site writes the lead here FIRST with `delivery: "pending"`, then tries
   Telegram, and on success calls POST /v1/leads/<id>/delivered. A pending
   lead with no mark after REDELIVERY_AFTER_MS (2 min, set at ingest as
   next_attempt_at) is re-sent through the site's POST /api/lead/redeliver —
   the site owns the lead bot, so its token never has to live on this server.

   No duplicates: each attempt first CLAIMS the row with one conditional
   UPDATE (still undelivered, still due → push next_attempt_at past the
   request timeout). Two passes, two processes or a late site mark cannot
   both win; the loser sends nothing. Backoff 1, 2, 5, 10, 30, then every
   60 minutes; after 24 h the lead is given up on — it stays in the ledger,
   and the ops chat gets its id (never a name or a contact). */

export const BACKOFF_MS = [60_000, 2 * 60_000, 5 * 60_000, 10 * 60_000, 30 * 60_000, 60 * 60_000];
export const GIVE_UP_AFTER_MS = 24 * 3600_000;
export const REDELIVER_TIMEOUT_MS = 15_000;
const BATCH = 20;

export type MarkResult = "marked" | "already" | "unknown";

/** The site's «Telegram has it» (or a successful redelivery). Idempotent. */
export function markDelivered(db: Db, leadId: string, by: string, now: Date = new Date()): MarkResult {
  const r = db
    .prepare(
      "UPDATE leads SET delivered_at = ?, delivered_by = ?, next_attempt_at = NULL WHERE lead_id = ? AND delivered_at IS NULL",
    )
    .run(now.toISOString(), by, leadId);
  if (Number(r.changes) === 1) return "marked";
  const row = db.prepare("SELECT 1 AS x FROM leads WHERE lead_id = ?").get(leadId);
  return row ? "already" : "unknown";
}

export interface RedeliveryDeps {
  db: Db;
  /** The site origin, e.g. https://shur-shur.com. Unset = the loop is off. */
  siteUrl: string | undefined;
  secret: string | undefined;
  fetchFn: FetchLike;
  now?: () => Date;
  /** Ops chat: told by lead id only when a lead is given up on. */
  alert?: (text: string) => Promise<unknown>;
}

export interface RedeliveryPass {
  due: number;
  delivered: number;
  failed: number;
  gaveUp: number;
}

interface PendingRow {
  lead_id: string;
  received_at: string;
  kind: string;
  locale: string | null;
  market: string;
  name: string | null;
  contact: string | null;
  message: string | null;
  ig_handle: string | null;
  attribution: string;
  delivery_attempts: number;
}

async function post(deps: RedeliveryDeps, row: PendingRow, now: Date): Promise<number | string> {
  const raw = JSON.stringify({
    lead_id: row.lead_id,
    kind: row.kind,
    locale: row.locale,
    market: row.market,
    name: row.name,
    contact: row.contact,
    message: row.message,
    ig_handle: row.ig_handle,
    attribution: JSON.parse(row.attribution) as unknown,
  });
  const ts = String(Math.floor(now.getTime() / 1000));
  try {
    const res = await deps.fetchFn(`${deps.siteUrl!.replace(/\/+$/, "")}/api/lead/redeliver`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-shur-timestamp": ts,
        "x-shur-signature": sign(deps.secret!, ts, raw),
      },
      body: raw,
      signal: AbortSignal.timeout(REDELIVER_TIMEOUT_MS),
    });
    return res.status;
  } catch (error) {
    // The error NAME only: a message may quote the URL.
    return error instanceof Error ? error.name : "error";
  }
}

/** One pass over the due leads. Safe to call concurrently and repeatedly. */
export async function redeliverDue(deps: RedeliveryDeps): Promise<RedeliveryPass> {
  const pass: RedeliveryPass = { due: 0, delivered: 0, failed: 0, gaveUp: 0 };
  if (!deps.siteUrl || !deps.secret) return pass;
  const now = deps.now?.() ?? new Date();
  const at = now.toISOString();
  const rows = deps.db
    .prepare(
      `SELECT lead_id, received_at, kind, locale, market, name, contact, message, ig_handle, attribution, delivery_attempts
         FROM leads
        WHERE delivered_at IS NULL AND delivery_gave_up_at IS NULL AND next_attempt_at <= ?
        ORDER BY next_attempt_at LIMIT ${BATCH}`,
    )
    .all(at) as unknown as PendingRow[];

  for (const row of rows) {
    // Claim: whoever moves next_attempt_at first owns this attempt.
    const lease = new Date(now.getTime() + 2 * REDELIVER_TIMEOUT_MS).toISOString();
    const claim = deps.db
      .prepare(
        "UPDATE leads SET next_attempt_at = ? WHERE lead_id = ? AND delivered_at IS NULL AND delivery_gave_up_at IS NULL AND next_attempt_at <= ?",
      )
      .run(lease, row.lead_id, at);
    if (Number(claim.changes) !== 1) continue;
    pass.due += 1;

    const attempt = row.delivery_attempts + 1;
    const outcome = await post(deps, row, now);
    const done = new Date().toISOString();
    if (outcome === 200) {
      deps.db
        .prepare(
          "UPDATE leads SET delivered_at = ?, delivered_by = 'redelivery', delivery_attempts = ?, next_attempt_at = NULL WHERE lead_id = ? AND delivered_at IS NULL",
        )
        .run(done, attempt, row.lead_id);
      pass.delivered += 1;
      log("lead.redelivered", { lead_id: row.lead_id, attempt });
      continue;
    }

    pass.failed += 1;
    const age = now.getTime() - Date.parse(row.received_at);
    if (age >= GIVE_UP_AFTER_MS) {
      deps.db
        .prepare(
          "UPDATE leads SET delivery_attempts = ?, next_attempt_at = NULL, delivery_gave_up_at = ? WHERE lead_id = ? AND delivered_at IS NULL",
        )
        .run(attempt, done, row.lead_id);
      pass.gaveUp += 1;
      log("lead.delivery_gave_up", { lead_id: row.lead_id, attempt, outcome: String(outcome) });
      await deps
        .alert?.(
          `🚨 Заявка ${row.lead_id} не дошла в чат заявок за 24 ч (${attempt} попыток). Она в журнале, повторы остановлены.`,
        )
        .catch(() => undefined);
      continue;
    }
    const next = new Date(now.getTime() + BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)]).toISOString();
    deps.db
      .prepare("UPDATE leads SET delivery_attempts = ?, next_attempt_at = ? WHERE lead_id = ? AND delivered_at IS NULL")
      .run(attempt, next, row.lead_id);
    log("lead.redeliver_failed", { lead_id: row.lead_id, attempt, outcome: String(outcome), next_attempt_at: next });
  }
  return pass;
}

/** CLI `delete-lead`: removes one lead and everything keyed by it. */
export function deleteLead(db: Db, leadId: string): number {
  return tx(db, () => {
    db.prepare("DELETE FROM lead_events WHERE lead_id = ?").run(leadId);
    db.prepare("DELETE FROM capi_events WHERE lead_id = ?").run(leadId);
    return Number(db.prepare("DELETE FROM leads WHERE lead_id = ?").run(leadId).changes);
  });
}
