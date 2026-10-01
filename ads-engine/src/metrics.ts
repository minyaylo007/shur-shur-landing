import type { Db } from "./db.ts";
import { MARKETS, type Market, type Limits } from "./config.ts";

/* Per-market metrics. Markets are never summed into one number silently, and
   currencies are never mixed without an explicit rate from the limits file.
   Small samples are honest: every rate carries a 95 % Wilson interval, every
   cost-per-X a Poisson interval on the count, and a «мало данных» flag. */

const Z = 1.96;

export interface Rate {
  k: number;
  n: number;
  rate: number | null;
  low: number | null;
  high: number | null;
  smallSample: boolean;
}

export function wilson(k: number, n: number, smallSample = 30): Rate {
  if (n === 0) return { k, n, rate: null, low: null, high: null, smallSample: true };
  const p = k / n;
  const z2 = Z * Z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (Z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return {
    k,
    n,
    rate: p,
    low: Math.max(0, centre - half),
    high: Math.min(1, centre + half),
    smallSample: n < smallSample,
  };
}

/** Byar's approximation to the exact 95 % Poisson interval for a count. */
export function poissonInterval(k: number): { low: number; high: number } {
  const low = k === 0 ? 0 : k * Math.pow(1 - 1 / (9 * k) - Z / (3 * Math.sqrt(k)), 3);
  const k1 = k + 1;
  const high = k1 * Math.pow(1 - 1 / (9 * k1) + Z / (3 * Math.sqrt(k1)), 3);
  return { low, high };
}

export interface CostPer {
  currency: string;
  value: number | null;
  /** Range from the count's interval: spend / high … spend / low. */
  low: number | null;
  high: number | null;
  smallSample: boolean;
}

export function costPer(spend: number, count: number, currency: string, smallSample = 30): CostPer {
  const { low, high } = poissonInterval(count);
  return {
    currency,
    value: count > 0 ? spend / count : null,
    low: high > 0 ? spend / high : null,
    high: low > 0 ? spend / low : null,
    smallSample: count < Math.max(5, Math.round(smallSample / 3)),
  };
}

export function convert(amount: number, from: string, to: string, fx: Record<string, number>): number | null {
  if (from === to) return amount;
  if (fx[`${from}_${to}`]) return amount * fx[`${from}_${to}`];
  if (fx[`${to}_${from}`]) return amount / fx[`${to}_${from}`];
  return null;
}

export interface MarketMetrics {
  market: Market;
  spend: Record<string, number>;
  platformLeads: number;
  leads: number;
  duplicates: number;
  spam: number;
  contacted: number;
  qualified: number;
  proposals: number;
  won: number;
  revenue: Record<string, number>;
  cpql: CostPer[];
  cac: CostPer[];
  /** Revenue / spend, only where revenue is in (or has a rate to) the spend currency. */
  roas: { currency: string; value: number }[];
  conversions: {
    leadToQualified: Rate;
    qualifiedToProposal: Rate;
    proposalToWon: Rate;
    leadToWon: Rate;
  };
}

export interface MetricsReport {
  since: string;
  until: string;
  markets: MarketMetrics[];
}

export function computeMetrics(db: Db, since: string, until: string, limits: Pick<Limits, "fx" | "smallSample">): MetricsReport {
  const small = limits.smallSample;
  const markets = MARKETS.map((market): MarketMetrics => {
    const spendRows = db
      .prepare(
        `SELECT currency, SUM(spend) AS spend, SUM(platform_leads) AS pl FROM insights
         WHERE level = 'campaign' AND market = ? AND date >= ? AND date <= ? GROUP BY currency`,
      )
      .all(market, since, until) as { currency: string; spend: number; pl: number }[];
    const spend: Record<string, number> = {};
    let platformLeads = 0;
    for (const r of spendRows) {
      spend[r.currency] = r.spend;
      platformLeads += r.pl;
    }

    // Lead dates are UTC calendar days of created_at.
    const c = db
      .prepare(
        `SELECT
           SUM(CASE WHEN is_spam = 0 AND is_duplicate = 0 THEN 1 ELSE 0 END) AS leads,
           SUM(is_duplicate) AS duplicates,
           SUM(is_spam) AS spam,
           SUM(CASE WHEN is_spam = 0 AND is_duplicate = 0 AND max_stage >= 1 THEN 1 ELSE 0 END) AS contacted,
           SUM(CASE WHEN is_spam = 0 AND is_duplicate = 0 AND max_stage >= 2 THEN 1 ELSE 0 END) AS qualified,
           SUM(CASE WHEN is_spam = 0 AND is_duplicate = 0 AND max_stage >= 3 THEN 1 ELSE 0 END) AS proposals,
           SUM(CASE WHEN is_spam = 0 AND is_duplicate = 0 AND status = 'won' THEN 1 ELSE 0 END) AS won
         FROM leads WHERE market = ? AND substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?`,
      )
      .get(market, since, until) as Record<string, number | null>;
    const n = (k: string) => Number(c[k] ?? 0);

    const revRows = db
      .prepare(
        `SELECT deal_currency AS currency, SUM(deal_amount) AS amount FROM leads
         WHERE market = ? AND status = 'won' AND is_spam = 0 AND is_duplicate = 0
           AND substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ? GROUP BY deal_currency`,
      )
      .all(market, since, until) as { currency: string; amount: number }[];
    const revenue: Record<string, number> = {};
    for (const r of revRows) revenue[r.currency] = r.amount;

    const roas: { currency: string; value: number }[] = [];
    for (const [cur, s] of Object.entries(spend)) {
      if (s <= 0) continue;
      let total = 0;
      let complete = true;
      for (const [rc, amount] of Object.entries(revenue)) {
        const v = convert(amount, rc, cur, limits.fx);
        if (v === null) complete = false;
        else total += v;
      }
      if (complete && Object.keys(revenue).length > 0) roas.push({ currency: cur, value: total / s });
    }

    const leads = n("leads");
    const qualified = n("qualified");
    const proposals = n("proposals");
    const won = n("won");
    return {
      market,
      spend,
      platformLeads,
      leads,
      duplicates: n("duplicates"),
      spam: n("spam"),
      contacted: n("contacted"),
      qualified,
      proposals,
      won,
      revenue,
      cpql: Object.entries(spend).map(([cur, s]) => costPer(s, qualified, cur, small)),
      cac: Object.entries(spend).map(([cur, s]) => costPer(s, won, cur, small)),
      roas,
      conversions: {
        leadToQualified: wilson(qualified, leads, small),
        qualifiedToProposal: wilson(proposals, qualified, small),
        proposalToWon: wilson(won, proposals, small),
        leadToWon: wilson(won, leads, small),
      },
    };
  });
  return { since, until, markets };
}

/** Sum of spend across markets in one currency — or null if a rate is missing. */
export function totalSpend(report: MetricsReport, currency: string, fx: Record<string, number>): number | null {
  let total = 0;
  for (const m of report.markets) {
    for (const [cur, s] of Object.entries(m.spend)) {
      const v = convert(s, cur, currency, fx);
      if (v === null) return null;
      total += v;
    }
  }
  return total;
}
