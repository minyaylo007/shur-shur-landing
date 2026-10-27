import { mkdirSync, chmodSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { join } from "node:path";
import type { Db } from "./db.ts";
import type { Limits } from "./config.ts";
import { addDays } from "./time.ts";
import { log } from "./log.ts";

/* The day's analysis input: ONE JSON the conductor reads with
   prompts/shur-daily-analysis.md and turns into the разбор. The engine never
   calls a model — it writes the file and tells the conductor where it is.

   Counters only. Names, contacts, messages, handles and lead ids never enter
   this file: every query below selects aggregates. Campaign and ad names are
   hers (Meta), not a client's. Measured by sales: clients = won site leads +
   offline sales (Direct, Meta form), CAC = spend / clients. */

export const ANALYSIS_DIR = "analysis";
/** Judge a campaign after this much spend (account currency) or 2 target CACs. */
export const JUDGE_AFTER_SPEND = 30;

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const div = (a: number, b: number, d = 4) => (b > 0 ? round(a / b, d) : null);

interface Counters {
  spend: number;
  impressions: number;
  clicks: number;
  conversations: number;
  form_leads: number;
  landing_views: number;
  platform_leads: number;
}

interface ObjectRow extends Counters {
  id: string;
  name: string;
  campaign_id: string;
  campaign: string;
  currency: string;
}

export interface AnalysisWindow {
  since: string;
  until: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  conversations: number;
  cost_per_conversation: number | null;
  form_leads: number;
  landing_views: number;
  platform_leads: number;
  site_leads: number;
  won_site_leads: number;
  offline_clients: number;
  clients: number;
  revenue: Record<string, number>;
  cac: number | null;
  campaigns: ReturnType<typeof campaignOut>[];
  ads: ReturnType<typeof adOut>[];
}

function campaignOut(r: ObjectRow & { status: string | null; site_leads: number; won: number; revenue: Record<string, number> }, judgeAt: number) {
  return {
    campaign_id: r.id,
    campaign: r.name,
    status: r.status,
    spend: round(r.spend),
    impressions: r.impressions,
    clicks: r.clicks,
    ctr: div(r.clicks, r.impressions, 6),
    cpc: div(r.spend, r.clicks),
    conversations: r.conversations,
    cost_per_conversation: div(r.spend, r.conversations),
    form_leads: r.form_leads,
    landing_views: r.landing_views,
    platform_leads: r.platform_leads,
    site_leads: r.site_leads,
    won_site_leads: r.won,
    revenue: r.revenue,
    /** Below the threshold the prompt must say «мало данных», not judge. */
    enough_spend_to_judge: r.spend >= judgeAt,
  };
}

function adOut(r: ObjectRow, judgeAt: number) {
  return {
    ad_id: r.id,
    ad: r.name,
    campaign: r.campaign,
    spend: round(r.spend),
    impressions: r.impressions,
    clicks: r.clicks,
    ctr: div(r.clicks, r.impressions, 6),
    cpc: div(r.spend, r.clicks),
    conversations: r.conversations,
    cost_per_conversation: div(r.spend, r.conversations),
    form_leads: r.form_leads,
    landing_views: r.landing_views,
    enough_spend_to_judge: r.spend >= judgeAt,
  };
}

function objects(db: Db, level: "campaign" | "ad", mode: string, since: string, until: string): ObjectRow[] {
  return db
    .prepare(
      `SELECT object_id AS id, MAX(object_name) AS name, MAX(campaign_id) AS campaign_id, MAX(campaign_name) AS campaign, currency,
              SUM(spend) AS spend, SUM(impressions) AS impressions, SUM(clicks) AS clicks,
              SUM(conversations) AS conversations, SUM(form_leads) AS form_leads,
              SUM(landing_views) AS landing_views, SUM(platform_leads) AS platform_leads
         FROM insights
        WHERE source = 'meta' AND level = ? AND mode = ? AND date >= ? AND date <= ?
        GROUP BY object_id, currency
        ORDER BY spend DESC`,
    )
    .all(level, mode, since, until)
    .map((r) => {
      const o = r as unknown as ObjectRow;
      return { ...o, name: o.name || o.campaign || o.id, campaign: o.campaign || o.campaign_id || "", spend: Number(o.spend) };
    });
}

function windowOf(db: Db, mode: string, since: string, until: string, judgeAt: number): AnalysisWindow {
  const camps = objects(db, "campaign", mode, since, until);
  const ads = objects(db, "ad", mode, since, until);
  const status = new Map(
    (db.prepare("SELECT object_id, status FROM budgets WHERE source = 'meta' AND level = 'campaign' AND mode = ?").all(mode) as { object_id: string; status: string | null }[]).map(
      (b) => [b.object_id, b.status],
    ),
  );
  // Site leads in the window, by utm_campaign (her campaign name or id). Counts only.
  const leadRows = db
    .prepare(
      `SELECT json_extract(attribution, '$.utm_campaign') AS utm, status, deal_currency AS currency,
              COUNT(*) AS n, SUM(COALESCE(deal_amount, 0)) AS amount
         FROM leads
        WHERE is_spam = 0 AND is_duplicate = 0 AND substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?
        GROUP BY 1, 2, 3`,
    )
    .all(since, until) as { utm: string | null; status: string; currency: string | null; n: number; amount: number }[];
  const sales = db
    .prepare(
      `SELECT currency, COUNT(*) AS n, SUM(amount) AS amount FROM offline_sales
        WHERE substr(at, 1, 10) >= ? AND substr(at, 1, 10) <= ? GROUP BY currency`,
    )
    .all(since, until) as { currency: string; n: number; amount: number }[];

  const revenue: Record<string, number> = {};
  const addRev = (cur: string | null, amount: number) => {
    if (!cur || !amount) return;
    revenue[cur] = round((revenue[cur] ?? 0) + amount);
  };
  for (const l of leadRows) if (l.status === "won") addRev(l.currency, l.amount);
  for (const s of sales) addRev(s.currency, s.amount);

  const campaigns = camps.map((c) => {
    const mine = leadRows.filter((l) => l.utm !== null && (l.utm === c.id || l.utm === c.name));
    const rev: Record<string, number> = {};
    for (const l of mine) if (l.status === "won" && l.currency && l.amount) rev[l.currency] = round((rev[l.currency] ?? 0) + l.amount);
    return campaignOut(
      {
        ...c,
        status: status.get(c.id) ?? null,
        site_leads: mine.reduce((s, l) => s + l.n, 0),
        won: mine.filter((l) => l.status === "won").reduce((s, l) => s + l.n, 0),
        revenue: rev,
      },
      judgeAt,
    );
  });

  const sum = (k: keyof Counters) => camps.reduce((s, c) => s + Number(c[k]), 0);
  const spend = round(sum("spend"));
  const siteLeads = leadRows.reduce((s, l) => s + l.n, 0);
  const won = leadRows.filter((l) => l.status === "won").reduce((s, l) => s + l.n, 0);
  const offline = sales.reduce((s, x) => s + x.n, 0);
  const clients = won + offline;
  return {
    since,
    until,
    spend,
    impressions: sum("impressions"),
    clicks: sum("clicks"),
    ctr: div(sum("clicks"), sum("impressions"), 6),
    cpc: div(spend, sum("clicks")),
    conversations: sum("conversations"),
    cost_per_conversation: div(spend, sum("conversations")),
    form_leads: sum("form_leads"),
    landing_views: sum("landing_views"),
    platform_leads: sum("platform_leads"),
    site_leads: siteLeads,
    won_site_leads: won,
    offline_clients: offline,
    clients,
    revenue,
    cac: div(spend, clients, 2),
    campaigns,
    ads: ads.map((a) => adOut(a, judgeAt)),
  };
}

export function buildAnalysis(db: Db, opts: { metaMode: string; limits: Limits; now?: Date }) {
  const now = opts.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const mode = opts.metaMode;
  const first = (db.prepare("SELECT MIN(date) AS d FROM insights WHERE source = 'meta' AND mode = ?").get(mode) as { d: string | null }).d;
  const currencies = (db.prepare("SELECT DISTINCT currency FROM insights WHERE source = 'meta' AND mode = ?").all(mode) as { currency: string }[]).map((r) => r.currency);
  const targetCac = opts.limits.targetCac ?? 0;
  const judgeAt = Math.max(JUDGE_AFTER_SPEND, 2 * targetCac);

  const byStatus = Object.fromEntries(
    (db.prepare("SELECT status, COUNT(*) AS n FROM leads WHERE is_spam = 0 AND is_duplicate = 0 GROUP BY status").all() as { status: string; n: number }[]).map((r) => [r.status, r.n]),
  );
  const flags = db.prepare("SELECT COUNT(*) AS total, SUM(is_spam) AS spam, SUM(is_duplicate) AS dup FROM leads").get() as { total: number; spam: number | null; dup: number | null };
  const byMarket = Object.fromEntries(
    (db.prepare("SELECT market, COUNT(*) AS n FROM leads WHERE is_spam = 0 AND is_duplicate = 0 GROUP BY market").all() as { market: string; n: number }[]).map((r) => [r.market, r.n]),
  );
  const offline = db
    .prepare("SELECT source, market, currency, COUNT(*) AS n, SUM(amount) AS amount FROM offline_sales GROUP BY 1, 2, 3 ORDER BY 1, 2, 3")
    .all() as { source: string; market: string; currency: string; n: number; amount: number }[];
  const siteDays = db
    .prepare(
      `SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS leads FROM leads
        WHERE is_spam = 0 AND is_duplicate = 0 AND substr(created_at, 1, 10) >= ? GROUP BY 1 ORDER BY 1`,
    )
    .all(addDays(today, -30)) as { date: string; leads: number }[];

  return {
    version: 1 as const,
    generated_at: now.toISOString(),
    date: today,
    meta_mode: mode,
    /** Fixture data must never be read as hers. */
    test_data: mode !== "live",
    account_currency: currencies.length === 1 ? currencies[0] : currencies.length ? currencies : null,
    history_since: first,
    judge: {
      after_spend: judgeAt,
      target_cac: targetCac || null,
      rule: "кампанию судим после 30 в валюте кабинета или 2 целевых CAC (что больше); меньше — «мало данных»",
    },
    windows: {
      d7: windowOf(db, mode, addDays(today, -7), today, judgeAt),
      d30: windowOf(db, mode, addDays(today, -30), today, judgeAt),
      all: windowOf(db, mode, first ?? today, today, judgeAt),
    },
    leads: {
      total: flags.total,
      spam: flags.spam ?? 0,
      duplicates: flags.dup ?? 0,
      by_status: byStatus,
      by_market: byMarket,
    },
    offline_sales: offline.map((o) => ({ source: o.source, market: o.market, currency: o.currency, clients: o.n, amount: round(o.amount) })),
    site_funnel: {
      note: "визиты и «дошли до формы» на сервере пока без источника — null, не 0; landing_views из Meta — заменитель",
      visits: null,
      form_reached: null,
      days: siteDays,
    },
  };
}

export type AnalysisData = ReturnType<typeof buildAnalysis>;

/** Writes <dataDir>/analysis/<date>.json (dir 700, file 600) and returns the path. */
export function writeAnalysis(dataDir: string, data: AnalysisData): string {
  const dir = join(dataDir, ANALYSIS_DIR);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  const file = join(dir, `${data.date}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  chmodSync(file, 0o600);
  return file;
}

/** One line to the shur conductor (lead-say.sh). execFile, no shell: the path
    is an argument, never parsed. Failure is logged, not thrown. */
export function notifyConductor(script: string | undefined, file: string): Promise<"sent" | "off" | "failed"> {
  if (!script) return Promise.resolve("off");
  return new Promise((resolve) => {
    execFile(script, ["shur", `разбор готов: ${file} — по prompts/shur-daily-analysis.md`], { timeout: 15_000 }, (error) => {
      if (error) {
        log("analysis.notify_failed", { code: typeof error.code === "number" ? error.code : "error" });
        resolve("failed");
      } else resolve("sent");
    });
  });
}
