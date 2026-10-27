import { readFileSync } from "node:fs";
import type { Db } from "../db.ts";
import { tx, kvGet, kvSet } from "../db.ts";
import type { Market } from "../config.ts";
import { deriveMarket } from "../leads.ts";
import { addDays, dateInZone } from "../time.ts";
import { GraphError, GraphReader, type FetchLike } from "./graph.ts";
import { log } from "../log.ts";

/* Insights collector. Read-only by construction: the reader interface has no
   method that changes anything in the ad account. Days are in the ACCOUNT
   time zone, spend in the ACCOUNT currency, and the last 7 days are re-read
   every run because Meta recomputes attribution for recent days. */

export type Level = "campaign" | "adset" | "ad";
export const LEVELS: Level[] = ["campaign", "adset", "ad"];
export const REREAD_DAYS = 7;
/* The whole account, not a recent window: Meta keeps insights for 37 months,
   so the first run per reader mode reads ~36 of them, in 90-day pieces so no
   single request asks for too much. After that, the 7-day re-read. */
export const ALL_TIME_DAYS = 1095;
export const CHUNK_DAYS = 90;

export interface AccountInfo {
  currency: string;
  timezone_name: string;
}

export interface InsightRow {
  level: Level;
  object_id: string;
  date: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string | null;
  ad_id: string | null;
  object_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  platform_leads: number;
  /** Messaging conversations started (Direct / Messenger / WhatsApp), 7-day click window. */
  conversations: number;
  /** Instant-form (on-Facebook) leads; platform_leads counts pixel leads too. */
  form_leads: number;
  landing_views: number;
}

export interface BudgetRow {
  object_id: string;
  level: "campaign" | "adset";
  name: string;
  /** Daily budget in account currency MAJOR units, or null (lifetime / CBO elsewhere). */
  daily_budget: number | null;
  status: string;
  created_time: string | null;
}

/** Common read interface for ad platforms. */
export interface AdsReader {
  readonly source: "meta" | "google";
  readonly mode: "live" | "fixtures" | "stub";
  account(): Promise<AccountInfo>;
  insights(level: Level, since: string, until: string): Promise<InsightRow[]>;
  budgets(): Promise<BudgetRow[]>;
}

/** Campaign naming follows the utm_campaign rule of the contract: sv_ / ta_ prefixes. */
export function marketOfCampaign(name: string): Market {
  return deriveMarket(undefined, name);
}

// Currencies without minor units (Meta's “offset 1”): budgets come in whole units.
const ZERO_DECIMAL = new Set(["JPY", "KRW", "CLP", "COP", "CRC", "HUF", "ISK", "IDR", "PYG", "TWD", "VND"]);

const LEAD_ACTIONS = ["lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped"];

function leadsFromActions(actions: { action_type: string; value: string }[] | undefined): number {
  if (!actions) return 0;
  const by = new Map(actions.map((a) => [a.action_type, Number(a.value) || 0]));
  // “lead” already aggregates pixel + on-Facebook leads; fall back to parts.
  if (by.has("lead")) return by.get("lead")!;
  return LEAD_ACTIONS.slice(1).reduce((s, k) => s + (by.get(k) ?? 0), 0);
}

function actionValue(actions: { action_type: string; value: string }[] | undefined, ...types: string[]): number {
  for (const t of types) {
    const hit = actions?.find((a) => a.action_type === t);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

/* Every delivery status: without this filter account-level insights may leave
   out archived and deleted ads, and the history ends where the oldest
   still-visible campaign starts. */
const ALL_STATUSES = [
  "ACTIVE", "PAUSED", "DELETED", "PENDING_REVIEW", "DISAPPROVED", "PREAPPROVED", "PENDING_BILLING_INFO",
  "CAMPAIGN_PAUSED", "ARCHIVED", "ADSET_PAUSED", "IN_PROCESS", "WITH_ISSUES",
];

interface RawInsight {
  date_start: string;
  campaign_id: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: { action_type: string; value: string }[];
}

export class MetaHttpReader implements AdsReader {
  readonly source = "meta" as const;
  readonly mode = "live" as const;
  private readonly graph: GraphReader;
  private readonly accountId: string;
  private cachedAccount: AccountInfo | undefined;
  /** False once Meta refused the status filter: read without it from then on. */
  private statusFilter = true;

  constructor(token: string, adAccountId: string, fetchFn?: FetchLike) {
    this.graph = new GraphReader(token, fetchFn);
    this.accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  }

  async account(): Promise<AccountInfo> {
    if (!this.cachedAccount) {
      const a = (await this.graph.get(this.accountId, { fields: "currency,timezone_name" })) as AccountInfo;
      this.cachedAccount = { currency: a.currency, timezone_name: a.timezone_name };
    }
    return this.cachedAccount;
  }

  async insights(level: Level, since: string, until: string): Promise<InsightRow[]> {
    const fields = [
      "date_start",
      "campaign_id",
      "campaign_name",
      "adset_id",
      "adset_name",
      "ad_id",
      "ad_name",
      "spend",
      "impressions",
      "clicks",
      "actions",
    ].join(",");
    const params: Record<string, string> = {
      level,
      fields,
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
      limit: "500",
    };
    const path = `${this.accountId}/insights`;
    let raw: RawInsight[] | undefined;
    if (this.statusFilter) {
      try {
        raw = await this.graph.getAll<RawInsight>(path, {
          ...params,
          filtering: JSON.stringify([{ field: "ad.effective_status", operator: "IN", value: ALL_STATUSES }]),
        });
      } catch (error) {
        if (!(error instanceof GraphError && error.code === 100)) throw error;
        log("collect.status_filter_refused", { level });
        this.statusFilter = false;
      }
    }
    raw ??= await this.graph.getAll<RawInsight>(path, params);
    return raw.map((r) => ({
      level,
      object_id: level === "campaign" ? r.campaign_id : level === "adset" ? r.adset_id! : r.ad_id!,
      date: r.date_start,
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name ?? "",
      adset_id: r.adset_id ?? null,
      ad_id: r.ad_id ?? null,
      object_name:
        (level === "campaign" ? r.campaign_name : level === "adset" ? r.adset_name : r.ad_name) ?? "",
      spend: Number(r.spend ?? 0),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      platform_leads: leadsFromActions(r.actions),
      conversations: actionValue(r.actions, "onsite_conversion.messaging_conversation_started_7d"),
      form_leads: actionValue(r.actions, "onsite_conversion.lead_grouped", "leadgen_grouped"),
      landing_views: actionValue(r.actions, "landing_page_view"),
    }));
  }

  async budgets(): Promise<BudgetRow[]> {
    const { currency } = await this.account();
    const div = ZERO_DECIMAL.has(currency) ? 1 : 100;
    const fields = "id,name,daily_budget,effective_status,created_time";
    const campaigns = await this.graph.getAll<Record<string, string>>(`${this.accountId}/campaigns`, {
      fields,
      limit: "500",
    });
    const adsets = await this.graph.getAll<Record<string, string>>(`${this.accountId}/adsets`, {
      fields: fields + ",campaign{name}",
      limit: "500",
    });
    const map = (level: "campaign" | "adset") => (r: Record<string, unknown>) => ({
      object_id: String(r.id),
      level,
      name:
        level === "adset"
          ? String((r.campaign as { name?: string } | undefined)?.name ?? r.name ?? "")
          : String(r.name ?? ""),
      daily_budget: r.daily_budget ? Number(r.daily_budget) / div : null,
      status: String(r.effective_status ?? ""),
      created_time: (r.created_time as string | undefined) ?? null,
    });
    return [...campaigns.map(map("campaign")), ...adsets.map(map("adset"))];
  }
}

/* Fixture mode: no token, same pipeline. Days are offsets from “today” in the
   fixture account's zone, so the dry run looks fresh instead of raising a
   stale-data alert forever. Every fixture id is fake. */
type MessagingFields = "conversations" | "form_leads" | "landing_views";

interface FixtureFile {
  account: AccountInfo;
  budgets: (Omit<BudgetRow, "created_time"> & { created_days_ago: number })[];
  rows: (Omit<InsightRow, "date" | MessagingFields> & Partial<Pick<InsightRow, MessagingFields>> & { day_offset: number })[];
}

export class FixtureReader implements AdsReader {
  readonly source = "meta" as const;
  readonly mode = "fixtures" as const;
  private readonly data: FixtureFile;
  private readonly now: () => Date;

  constructor(file: string, now: () => Date = () => new Date()) {
    this.data = JSON.parse(readFileSync(file, "utf8")) as FixtureFile;
    this.now = now;
  }

  private today(): string {
    return dateInZone(this.now(), this.data.account.timezone_name);
  }

  async account(): Promise<AccountInfo> {
    return this.data.account;
  }

  async insights(level: Level, since: string, until: string): Promise<InsightRow[]> {
    const today = this.today();
    return this.data.rows
      .filter((r) => r.level === level)
      .map(({ day_offset, ...r }) => ({ conversations: 0, form_leads: 0, landing_views: 0, ...r, date: addDays(today, day_offset) }))
      .filter((r) => r.date >= since && r.date <= until);
  }

  async budgets(): Promise<BudgetRow[]> {
    const today = this.today();
    return this.data.budgets.map(({ created_days_ago, ...b }) => ({
      ...b,
      created_time: addDays(today, -created_days_ago) + "T00:00:00Z",
    }));
  }
}

export interface CollectSummary {
  ok: boolean;
  mode: string;
  since?: string;
  until?: string;
  rows: number;
  error?: string;
}

export async function collect(
  db: Db,
  reader: AdsReader,
  opts: { now?: Date; backfillDays?: number } = {},
): Promise<CollectSummary> {
  const now = opts.now ?? new Date();
  const at = now.toISOString();
  try {
    const account = await reader.account();
    const today = dateInZone(now, account.timezone_name);
    const have = db.prepare("SELECT COUNT(*) AS n FROM insights WHERE source = ? AND mode = ?").get(reader.source, reader.mode) as {
      n: number;
    };
    // A ledger that only ever read a recent window (before 27.10.2026) reads the whole account once.
    const allTimeKey = `meta_all_time:${reader.source}:${reader.mode}`;
    const firstRun = have.n === 0 || !kvGet(db, allTimeKey);
    const since = addDays(today, -(firstRun ? (opts.backfillDays ?? ALL_TIME_DAYS) : REREAD_DAYS));
    const until = today;

    const byLevel = new Map<Level, InsightRow[]>();
    for (const level of LEVELS) {
      const list: InsightRow[] = [];
      for (let from = since; from <= until; from = addDays(from, CHUNK_DAYS)) {
        const to = addDays(from, CHUNK_DAYS - 1);
        list.push(...(await reader.insights(level, from, to < until ? to : until)));
      }
      byLevel.set(level, list);
    }
    const budgets = await reader.budgets();

    let rows = 0;
    tx(db, () => {
      // Re-read window is replaced wholesale: rows Meta no longer reports must go too.
      db.prepare("DELETE FROM insights WHERE source = ? AND date >= ? AND date <= ?").run(
        reader.source,
        since,
        until,
      );
      const ins = db.prepare(
        `INSERT OR REPLACE INTO insights(source, level, object_id, date, campaign_id, campaign_name, adset_id, ad_id,
           object_name, market, spend, currency, timezone, impressions, clicks, platform_leads,
           conversations, form_leads, landing_views, fetched_at, mode)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      );
      for (const list of byLevel.values()) {
        for (const r of list) {
          ins.run(
            reader.source,
            r.level,
            r.object_id,
            r.date,
            r.campaign_id,
            r.campaign_name,
            r.adset_id,
            r.ad_id,
            r.object_name,
            marketOfCampaign(r.campaign_name),
            r.spend,
            account.currency,
            account.timezone_name,
            r.impressions,
            r.clicks,
            r.platform_leads,
            r.conversations,
            r.form_leads,
            r.landing_views,
            at,
            reader.mode,
          );
          rows++;
        }
      }
      db.prepare("DELETE FROM budgets WHERE source = ?").run(reader.source);
      const bud = db.prepare(
        `INSERT INTO budgets(source, object_id, level, name, market, daily_budget, currency, status, fetched_at, mode)
         VALUES(?,?,?,?,?,?,?,?,?,?)`,
      );
      for (const b of budgets) {
        bud.run(
          reader.source,
          b.object_id,
          b.level,
          b.name,
          marketOfCampaign(b.name),
          b.daily_budget,
          account.currency,
          b.status,
          at,
          reader.mode,
        );
      }
      if (firstRun) kvSet(db, allTimeKey, since);
      db.prepare("INSERT INTO collector_runs(at, source, mode, ok, rows) VALUES(?,?,?,?,?)").run(
        at,
        reader.source,
        reader.mode,
        1,
        rows,
      );
    });
    log("collect.ok", { source: reader.source, mode: reader.mode, since, until, rows });
    return { ok: true, mode: reader.mode, since, until, rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    db.prepare("INSERT INTO collector_runs(at, source, mode, ok, rows, error) VALUES(?,?,?,?,?,?)").run(
      at,
      reader.source,
      reader.mode,
      0,
      0,
      message.slice(0, 500),
    );
    log("collect.failed", { source: reader.source, mode: reader.mode, error: message.slice(0, 200) });
    return { ok: false, mode: reader.mode, rows: 0, error: message };
  }
}

export interface Freshness {
  lastOkAt: string | null;
  lastRunOk: boolean | null;
  ageHours: number | null;
}

export function freshness(db: Db, source: string, now = new Date()): Freshness {
  const ok = db
    .prepare("SELECT at FROM collector_runs WHERE source = ? AND ok = 1 ORDER BY id DESC LIMIT 1")
    .get(source) as { at: string } | undefined;
  const last = db
    .prepare("SELECT ok FROM collector_runs WHERE source = ? ORDER BY id DESC LIMIT 1")
    .get(source) as { ok: number } | undefined;
  return {
    lastOkAt: ok?.at ?? null,
    lastRunOk: last ? last.ok === 1 : null,
    ageHours: ok ? (now.getTime() - Date.parse(ok.at)) / 3600_000 : null,
  };
}
