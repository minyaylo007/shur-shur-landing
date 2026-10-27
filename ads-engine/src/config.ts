import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/* Everything the service reads from the environment, in one place.
   Secrets are read here and passed down as values; their NAMES may appear in
   logs (“missing LEDGER_HMAC_SECRET”), their values never do. A missing token
   is not an error: each integration has a dry mode (Telegram → outbox file,
   Meta → fixtures, Conversions API → off). */

export const MARKETS = ["suceava", "tel_aviv", "other"] as const;
export type Market = (typeof MARKETS)[number];

export type RulesMode = "observe" | "approve" | "auto";

export interface MarketLimits {
  /** Hard ceiling for the calendar month, in the ad account currency. */
  monthlyCap: number;
  /** Target cost per qualified lead; rules scale below it and cut above it. */
  targetCpql: number;
}

export interface Limits {
  mode: RulesMode;
  /** Ceiling across all markets for the calendar month, account currency. */
  monthlyCapTotal: number;
  markets: Record<Market, MarketLimits>;
  /** Largest single budget change, percent of the current daily budget. */
  maxStepPct: number;
  /** No decision before this much spend and this many leads in the window. */
  minSpend: number;
  minLeads: number;
  /** Hours between two changes of the same object. */
  minHoursBetweenChanges: number;
  /** Evaluation window, days, and how many most-recent days to skip
      because qualified/won statuses arrive late. */
  evalDays: number;
  conversionLagDays: number;
  /** An object younger than this (days since first spend) is still learning. */
  learningDays: number;
  /** Data older than this blocks increases and raises an alert. */
  staleHours: number;
  /** Alert: this much spend in the market over alertWindowDays with zero leads. */
  spendWithoutLeadsAlert: number;
  alertWindowDays: number;
  /** Below this many trials a rate is marked «мало данных». */
  smallSample: number;
  /** Explicit exchange rates, e.g. {"RON_EUR": 0.2}. No rate — no mixing. */
  fx: Record<string, number>;
  /** Target cost per client, account currency; 0 = not set. The daily analysis
      judges a campaign after max(30, 2 × targetCac) of spend. */
  targetCac?: number;
}

export const DEFAULT_LIMITS: Limits = {
  mode: "observe",
  monthlyCapTotal: 0,
  markets: {
    suceava: { monthlyCap: 0, targetCpql: 0 },
    tel_aviv: { monthlyCap: 0, targetCpql: 0 },
    other: { monthlyCap: 0, targetCpql: 0 },
  },
  maxStepPct: 20,
  minSpend: 50,
  minLeads: 10,
  minHoursBetweenChanges: 72,
  evalDays: 14,
  conversionLagDays: 3,
  learningDays: 7,
  staleHours: 36,
  spendWithoutLeadsAlert: 50,
  alertWindowDays: 3,
  smallSample: 30,
  fx: {},
  targetCac: 0,
};

export function loadLimits(file: string | undefined): Limits {
  if (!file || !existsSync(file)) return structuredClone(DEFAULT_LIMITS);
  const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<Limits>;
  const merged: Limits = { ...structuredClone(DEFAULT_LIMITS), ...raw };
  merged.markets = { ...DEFAULT_LIMITS.markets, ...(raw.markets ?? {}) };
  if (!["observe", "approve", "auto"].includes(merged.mode)) {
    throw new Error(`limits: unknown mode ${String(merged.mode)}`);
  }
  return merged;
}

export interface Config {
  port: number;
  dataDir: string;
  hmacSecret: string | undefined;
  /** Site origin for lead redelivery (POST <siteUrl>/api/lead/redeliver). */
  siteUrl: string | undefined;
  opsBotToken: string | undefined;
  opsChatId: string | undefined;
  metaToken: string | undefined;
  metaAdAccountId: string | undefined;
  metaDatasetId: string | undefined;
  capiEnabled: boolean;
  capiTestEventCode: string | undefined;
  fixturesFile: string;
  limitsFile: string | undefined;
  /** Env var modes overrides limits.mode so a unit drop-in can switch it. */
  modeOverride: RulesMode | undefined;
  /** Signs the cabinet snapshot (POST <siteUrl>/api/cabinet/ingest). No key — no push. */
  cabinetSecret: string | undefined;
  /** The conductor's conclusions for the cabinet, markdown. Missing file — no block. */
  cabinetInsightsFile: string;
  /** Opens her Meta key handed in on the site (meta-key.ts). Same value in Vercel. */
  cabinetMetaKey: string | undefined;
  /** This service's own env file: the Meta key from the cabinet is written here. */
  envFile: string;
  /** Tells the shur conductor the analysis file is ready (lead-say.sh). Unset = off. */
  analysisNotify: string | undefined;
}

/** The service only ever binds loopback (PORTS.md rule): not configurable. */
export const HOST = "127.0.0.1";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const here = new URL("..", import.meta.url).pathname;
  const dataDir = env.SHUR_ADS_DATA_DIR || "/opt/ihor/shur-ads/data";
  const mode = env.SHUR_ADS_RULES_MODE;
  if (mode && !["observe", "approve", "auto"].includes(mode)) {
    throw new Error("SHUR_ADS_RULES_MODE must be observe | approve | auto");
  }
  return {
    port: Number(env.SHUR_ADS_PORT || 8014),
    dataDir,
    hmacSecret: env.LEDGER_HMAC_SECRET || undefined,
    // "off" switches redelivery off; unset = the production site.
    siteUrl: env.SHUR_SITE_URL === "off" ? undefined : env.SHUR_SITE_URL || "https://shur-shur.com",
    opsBotToken: env.SHUR_OPS_BOT_TOKEN || undefined,
    opsChatId: env.SHUR_OPS_CHAT_ID || undefined,
    metaToken: env.META_ACCESS_TOKEN || undefined,
    metaAdAccountId: env.META_AD_ACCOUNT_ID || undefined,
    metaDatasetId: env.META_DATASET_ID || undefined,
    capiEnabled: env.META_CAPI_ENABLED === "1",
    capiTestEventCode: env.META_CAPI_TEST_EVENT_CODE || undefined,
    fixturesFile: env.SHUR_ADS_FIXTURES || join(here, "fixtures", "meta-insights.json"),
    limitsFile: env.SHUR_ADS_LIMITS_FILE || join(dataDir, "..", "limits.json"),
    modeOverride: (mode as RulesMode | undefined) || undefined,
    cabinetSecret: env.CABINET_HMAC_SECRET || undefined,
    cabinetInsightsFile: env.SHUR_CABINET_INSIGHTS_FILE || join(dataDir, "..", "cabinet-insights.md"),
    cabinetMetaKey: env.CABINET_META_KEY || undefined,
    envFile: env.SHUR_ADS_ENV_FILE || join(dataDir, "..", "env"),
    // "off" switches it off; unset = ~/bin/lead-say.sh when it exists.
    analysisNotify:
      env.SHUR_ANALYSIS_NOTIFY === "off"
        ? undefined
        : env.SHUR_ANALYSIS_NOTIFY ||
          (env.HOME && existsSync(join(env.HOME, "bin", "lead-say.sh")) ? join(env.HOME, "bin", "lead-say.sh") : undefined),
  };
}

/** What runs for real and what is simulated — shown by /healthz and the report. */
export function modes(c: Config) {
  return {
    telegram: c.opsBotToken && c.opsChatId ? "live" : "dry",
    meta: c.metaToken && c.metaAdAccountId ? "live" : "fixtures",
    capi: c.capiEnabled && c.metaToken && c.metaDatasetId ? "on" : "off",
    ingest: c.hmacSecret ? "on" : "not_configured",
    redelivery: c.hmacSecret && c.siteUrl ? "on" : "off",
    cabinet: c.cabinetSecret && c.siteUrl ? "on" : "off",
    writes: "simulator",
  } as const;
}
