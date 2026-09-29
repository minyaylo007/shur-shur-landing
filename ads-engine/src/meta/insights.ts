import { readFileSync } from "node:fs";
import type { Db } from "../db.ts";
import { tx } from "../db.ts";
import type { Market } from "../config.ts";
import { deriveMarket } from "../leads.ts";
import { addDays, dateInZone } from "../time.ts";
import { GraphReader, type FetchLike } from "./graph.ts";
import { log } from "../log.ts";

/* Insights collector. Read-only by construction: the reader interface has no
   method that changes anything in the ad account. Days are in the ACCOUNT
   time zone, spend in the ACCOUNT currency, and the last 7 days are re-read
   every run because Meta recomputes attribution for recent days. */

export type Level = "campaign" | "adset" | "ad";
export const LEVELS: Level[] = ["campaign", "adset", "ad"];
export const REREAD_DAYS = 7;

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
    const raw = await this.graph.getAll<RawInsight>(`${this.accountId}/insights`, {
      level,
      fields,
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
      limit: "500",
    });
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
interface FixtureFile {
  account: AccountInfo;
  budgets: (Omit<BudgetRow, "created_time"> & { created_days_ago: number })[];
  rows: (Omit<InsightRow, "date"> & { day_offset: number })[];
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
      .map(({ day_offset, ...r }) => ({ ...r, date: addDays(today, day_offset) }))
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
    const have = db.prepare("SELECT COUNT(*) AS n FROM insights WHERE source = ?").get(reader.source) as {
      n: number;
    };
    const since = addDays(today, -(have.n === 0 ? (opts.backfillDays ?? 30) : REREAD_DAYS));
    const until = today;

    const byLevel = new Map<Level, InsightRow[]>();
    for (const level of LEVELS) byLevel.set(level, await reader.insights(level, since, until));
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
        `INSERT INTO insights(source, level, object_id, date, campaign_id, campaign_name, adset_id, ad_id,
           object_name, market, spend, currency, timezone, impressions, clicks, platform_leads, fetched_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
            at,
          );
          rows++;
        }
      }
      db.prepare("DELETE FROM budgets WHERE source = ?").run(reader.source);
      const bud = db.prepare(
        `INSERT INTO budgets(source, object_id, level, name, market, daily_budget, currency, status, fetched_at)
         VALUES(?,?,?,?,?,?,?,?,?)`,
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
        );
      }
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
