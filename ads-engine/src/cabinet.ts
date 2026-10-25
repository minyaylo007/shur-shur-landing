import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "./db.ts";
import type { FetchLike } from "./meta/graph.ts";
import { sign } from "./hmac.ts";
import { log } from "./log.ts";

/* The owner's stats cabinet (site: /cabinet, src/lib/cabinet/snapshot.ts).
   After the daily report the engine builds ONE snapshot from the ledger and
   pushes it signed (CABINET_HMAC_SECRET, same scheme as the lead contract) to
   <siteUrl>/api/cabinet/ingest. A copy stays in data/cabinet-snapshot.json —
   ops/cabinet/push.mjs can re-send it by hand.

   Counters only. Names, contacts, messages and lead ids never enter the
   snapshot: the queries below select counts, and the site refuses any field
   its schema does not name. While Meta runs on fixtures `test_data` is true
   and the page does not show the ad rows as real. */

export const SNAPSHOT_FILE = "cabinet-snapshot.json";
const DAYS = 60;

export interface CabinetSnapshot {
  version: 1;
  generated_at: string;
  test_data: boolean;
  currency: string | null;
  ads: {
    connected: boolean;
    days: {
      date: string;
      campaign: string;
      spend: number;
      impressions: number;
      clicks: number;
      ctr: number | null;
      cpc: number | null;
      leads: number;
    }[];
  };
  site: { days: { date: string; visits: number | null; form_reached: number | null; leads: number }[] };
  insights: { date: string; markdown: string } | null;
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

export function buildSnapshot(
  db: Db,
  opts: { metaMode: string; insightsFile?: string; now?: Date },
): CabinetSnapshot {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - DAYS * 86_400_000).toISOString().slice(0, 10);

  const rows = db
    .prepare(
      `SELECT date, campaign_id, MAX(campaign_name) AS campaign, currency,
              SUM(spend) AS spend, SUM(impressions) AS impressions, SUM(clicks) AS clicks
         FROM insights
        WHERE source = 'meta' AND level = 'campaign' AND date >= ?
        GROUP BY date, campaign_id, currency
        ORDER BY date, campaign_id`,
    )
    .all(since) as { date: string; campaign_id: string; campaign: string | null; currency: string; spend: number; impressions: number; clicks: number }[];

  // Leads the ledger attributes to a campaign: utm_campaign carries its name or id.
  const attributed = db
    .prepare(
      `SELECT substr(created_at, 1, 10) AS date, json_extract(attribution, '$.utm_campaign') AS utm, COUNT(*) AS n
         FROM leads
        WHERE is_spam = 0 AND is_duplicate = 0 AND created_at >= ?
          AND json_extract(attribution, '$.utm_campaign') IS NOT NULL
        GROUP BY 1, 2`,
    )
    .all(since) as { date: string; utm: string; n: number }[];
  const leadsFor = (date: string, id: string, name: string) =>
    attributed.filter((a) => a.date === date && (a.utm === id || a.utm === name)).reduce((s, a) => s + a.n, 0);

  const currencies = [...new Set(rows.map((r) => r.currency))];

  const site = db
    .prepare(
      `SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS leads
         FROM leads
        WHERE is_spam = 0 AND is_duplicate = 0 AND created_at >= ?
        GROUP BY 1 ORDER BY 1`,
    )
    .all(since) as { date: string; leads: number }[];

  let insights: CabinetSnapshot["insights"] = null;
  if (opts.insightsFile && existsSync(opts.insightsFile)) {
    const markdown = readFileSync(opts.insightsFile, "utf8").trim();
    if (markdown) insights = { date: statSync(opts.insightsFile).mtime.toISOString().slice(0, 10), markdown };
  }

  return {
    version: 1,
    generated_at: now.toISOString(),
    test_data: opts.metaMode !== "live",
    currency: currencies.length === 1 ? currencies[0] : null,
    ads: {
      connected: rows.length > 0,
      days: rows.map((r) => {
        const name = r.campaign || r.campaign_id;
        return {
          date: r.date,
          campaign: name,
          spend: round(r.spend, 2),
          impressions: r.impressions,
          clicks: r.clicks,
          ctr: r.impressions > 0 ? round(r.clicks / r.impressions, 6) : null,
          cpc: r.clicks > 0 ? round(r.spend / r.clicks, 4) : null,
          leads: leadsFor(r.date, r.campaign_id, name),
        };
      }),
    },
    // Visits and «reached the form» have no source on this server yet: null,
    // which the page shows as «нет данных», never as 0.
    site: { days: site.map((d) => ({ date: d.date, visits: null, form_reached: null, leads: d.leads })) },
    insights,
  };
}

export type PushOutcome = "sent" | "skipped" | "failed";

export async function pushSnapshot(
  snapshot: CabinetSnapshot,
  cfg: { siteUrl: string | undefined; secret: string | undefined; dataDir: string; fetchFn?: FetchLike },
): Promise<PushOutcome> {
  const body = JSON.stringify(snapshot);
  writeFileSync(join(cfg.dataDir, SNAPSHOT_FILE), body + "\n", { mode: 0o600 });
  if (!cfg.siteUrl || !cfg.secret) {
    log("cabinet.skipped", { missing: [cfg.siteUrl ? null : "SHUR_SITE_URL", cfg.secret ? null : "CABINET_HMAC_SECRET"].filter(Boolean).join(",") });
    return "skipped";
  }
  const ts = String(Math.floor(Date.now() / 1000));
  try {
    const res = await (cfg.fetchFn ?? fetch)(`${cfg.siteUrl.replace(/\/+$/, "")}/api/cabinet/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shur-Timestamp": ts, "X-Shur-Signature": sign(cfg.secret, ts, body) },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      log("cabinet.refused", { status: res.status });
      return "failed";
    }
    log("cabinet.sent", { ad_rows: snapshot.ads.days.length, test_data: snapshot.test_data });
    return "sent";
  } catch (e) {
    log("cabinet.unreachable", { error: e instanceof Error ? e.name : "unknown" });
    return "failed";
  }
}
