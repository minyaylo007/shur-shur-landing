import { z } from "zod";
import { cabinetStore } from "@/lib/cabinet/store";
import type { Account, AccountType, Operation } from "./ledger";

/**
 * Sasha's statement from the monobank PERSONAL API (read only), by the docs at
 * api.monobank.ua/docs — not tried against a live key yet: there is none.
 *
 *   GET /personal/client-info                        → accounts
 *   GET /personal/statement/{account}/{from}/{to}    → ≤ 31 days, ≤ 500 lines
 *   header X-Token; both limited to one call per 60 s.
 *
 * Key: env MONO_PERSONAL_TOKEN (not MONO_TOKEN — that one is the acquiring
 * key for client billing). No key → the page lives on typed-in payments.
 * What the bank said is cached in Blob; each account is asked at most once a
 * minute, accounts themselves once an hour. Server-only.
 */

export const BANK_KEY = "cabinet/groshi-bank.json";
const API = "https://api.monobank.ua";
const STATEMENT_EVERY_MS = 60_000;
const ACCOUNTS_EVERY_MS = 60 * 60_000;
const WANTED: AccountType[] = ["fop", "white", "platinum"];
const CURRENCY: Record<number, "UAH" | "USD"> = { 980: "UAH", 840: "USD" };

const cacheSchema = z.object({
  accountsAt: z.number(),
  accounts: z.array(z.object({ id: z.string(), type: z.enum(["fop", "white", "platinum"]), iban: z.string(), currency: z.enum(["UAH", "USD"]).optional() })),
  /** when each account's statement was last asked for */
  asked: z.record(z.string(), z.number()),
  ops: z.array(
    z.object({
      id: z.string(),
      account: z.string(),
      time: z.number(),
      description: z.string(),
      mcc: z.number(),
      amount: z.number(),
      counterName: z.string().optional(),
      counterIban: z.string().optional(),
      counterEdrpou: z.string().optional(),
    }),
  ),
});
type Cache = z.infer<typeof cacheSchema>;

export type Bank =
  | { status: "off" }
  | { status: "ok" | "stale"; accounts: Account[]; ops: Operation[] };

const clientInfo = z.object({
  accounts: z.array(z.object({ id: z.string(), type: z.string(), iban: z.string().optional().default(""), currencyCode: z.number() })),
});
const statement = z.array(
  z.object({
    id: z.string(),
    time: z.number(),
    description: z.string().optional().default(""),
    mcc: z.number().optional().default(0),
    amount: z.number(),
    counterName: z.string().optional(),
    counterIban: z.string().optional(),
    counterEdrpou: z.string().optional(),
  }),
);

async function ask(path: string, token: string): Promise<unknown> {
  const res = await fetch(API + path, { headers: { "X-Token": token }, cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`monobank ${res.status}`);
  return res.json();
}

/** Start of the current month in Kyiv, unix seconds (a day earlier — the statement is cut by UTC). */
function monthStart(nowMs: number): number {
  const [y, m] = new Date(nowMs).toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv" }).split("-").map(Number);
  return Date.UTC(y, m - 1, 1) / 1000 - 86_400;
}

async function readCache(): Promise<Cache | null> {
  const stored = await cabinetStore().read(BANK_KEY);
  if (!stored) return null;
  const parsed = cacheSchema.safeParse(JSON.parse(stored.text));
  return parsed.success ? parsed.data : null;
}

/** The statement for the page: fresh when the bank allows, the cached one otherwise. */
export async function loadBank(nowMs = Date.now()): Promise<Bank> {
  const token = process.env.MONO_PERSONAL_TOKEN;
  if (!token) return { status: "off" };
  const cache: Cache = (await readCache().catch(() => null)) ?? { accountsAt: 0, accounts: [], asked: {}, ops: [] };
  let changed = false;
  let failed = false;
  try {
    if (nowMs - cache.accountsAt >= ACCOUNTS_EVERY_MS) {
      const info = clientInfo.parse(await ask("/personal/client-info", token));
      cache.accounts = info.accounts
        .filter((a) => WANTED.includes(a.type as AccountType) && CURRENCY[a.currencyCode])
        .map((a) => ({ id: a.id, type: a.type as AccountType, iban: a.iban, currency: CURRENCY[a.currencyCode] }));
      cache.accountsAt = nowMs;
      changed = true;
    }
    const from = monthStart(nowMs);
    const to = Math.floor(nowMs / 1000);
    for (const account of cache.accounts) {
      if (nowMs - (cache.asked[account.id] ?? 0) < STATEMENT_EVERY_MS) continue;
      cache.asked[account.id] = nowMs;
      changed = true;
      const lines = statement.parse(await ask(`/personal/statement/${account.id}/${from}/${to}`, token));
      // this month is replaced by what the bank says now; older months stay as they were
      cache.ops = [
        ...cache.ops.filter((o) => o.account !== account.id || o.time < from),
        ...lines.map((l) => ({ ...l, account: account.id })),
      ];
    }
  } catch (error) {
    failed = true;
    console.error(`[groshi] monobank failed: ${error instanceof Error ? error.message.slice(0, 40) : "unknown"}`);
  }
  if (changed) await cabinetStore().write(BANK_KEY, JSON.stringify(cache)).catch(() => console.error("[groshi] bank cache not saved"));
  return { status: failed ? "stale" : "ok", accounts: cache.accounts, ops: cache.ops };
}
