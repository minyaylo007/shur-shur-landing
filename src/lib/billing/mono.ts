import { createHash, createVerify } from "node:crypto";
import { EMPTY_BILLING, updateClient, type Billing, type Client } from "@/lib/client/clients";
import { liveToken } from "./settings";

/**
 * The 15 €/month subscription through monobank acquiring. Server-only.
 * What the API takes and answers — docs/monobank-subscription.md.
 *
 * Two rules shape this file:
 *  - a webhook is a TRIGGER, not a source: its signature is checked, then the
 *    state is read back from monobank (status + payments). The body schema of
 *    subscription webhooks is not documented, and this way a replayed or
 *    reordered webhook cannot write a stale state;
 *  - without a token there is no billing at all: no button, nothing charged;
 *  - the answers are read by the published schema, but nobody here has seen a
 *    live one yet. So the reader also takes near spellings, and an answer it
 *    does not understand changes nothing for the worse: the stored state
 *    stands, a client who has paid stays open, and one warning names the keys
 *    that came (never the values). Paid-but-closed is the costly mistake.
 */

const API = "https://api.monobank.ua";
const TIMEOUT_MS = 10_000;

export const PRICE_EUR = 15;
export const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
/** monobank keeps the payment page alive this long (seconds); ours to set. */
const PAGE_VALIDITY_SECONDS = 24 * 60 * 60;
export const PAGE_REUSE_MS = 23 * 60 * 60 * 1000;

/* ---------- configuration ---------- */

/**
 * A test client pays in the test environment and can never reach the live token.
 * The live one: env MONO_TOKEN, else the one Sasha saved in her cabinet (settings.ts).
 */
export async function monoToken(test: boolean): Promise<string | null> {
  if (!test) return liveToken();
  const value = process.env.MONO_TEST_TOKEN?.trim();
  return value ? value : null;
}

export interface Price {
  ccy: 978 | 980;
  /** Minor units: euro cents or kopiykas. */
  amount: number;
  label: string;
}

/**
 * EUR by default (ccy 978, 1500). If monobank refuses a euro subscription for
 * this merchant, set MONO_PRICE_UAH to whole hryvnias: the charge becomes UAH
 * and the page says «15 € (≈ N грн)».
 */
export function price(): Price {
  const raw = process.env.MONO_PRICE_UAH?.trim();
  if (raw && /^\d{2,6}$/.test(raw)) {
    return { ccy: 980, amount: Number(raw) * 100, label: `${PRICE_EUR} € (≈ ${Number(raw)} грн)` };
  }
  return { ccy: 978, amount: PRICE_EUR * 100, label: `${PRICE_EUR} €` };
}

/* ---------- API ---------- */

export class MonoError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`monobank ${status} ${code}`);
    this.name = "MonoError";
  }
}

async function call(token: string, method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { "X-Token": token, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    const code = (json as { errCode?: unknown } | null)?.errCode;
    // errText is monobank's free text — kept out: the code and the status are enough.
    throw new MonoError(response.status, typeof code === "string" ? code.slice(0, 40) : "unknown");
  }
  return json;
}

/**
 * The token check behind the cabinet form: one read request. Returns the
 * merchant's name as monobank knows it; a refused token throws MonoError.
 */
export async function merchantDetails(token: string): Promise<{ merchantName: string | null }> {
  const json = object(await call(token, "GET", "/api/merchant/details"));
  const name = field(json, "merchantName", "name");
  return { merchantName: typeof name === "string" && name.trim() ? name.trim().slice(0, 120) : null };
}

const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
/** An RFC 3339 string by the schema; epoch seconds or milliseconds are taken too. */
const time = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value < 1e11 ? value * 1000 : value;
  const ms = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : null;
};
type Json = Record<string, unknown>;
const object = (value: unknown): Json | null => (value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null);
/** The first of `names` the object has, whatever the letter case or underscores. */
function field(source: Json | null, ...names: string[]): unknown {
  if (!source) return undefined;
  const flat = (name: string) => name.toLowerCase().replace(/_/g, "");
  for (const name of names) {
    for (const key of Object.keys(source)) {
      if (flat(key) === flat(name) && source[key] !== null && source[key] !== undefined) return source[key];
    }
  }
  return undefined;
}
const word = (value: unknown): string => (typeof value === "string" ? value.trim().toLowerCase() : "");

export async function createSubscription(token: string, input: { redirectUrl: string; webhookUrl: string }): Promise<{ subscriptionId: string; pageUrl: string; price: Price }> {
  const p = price();
  const json = (await call(token, "POST", "/api/merchant/subscription/create", {
    amount: p.amount,
    ccy: p.ccy,
    interval: "1m",
    redirectUrl: input.redirectUrl,
    webHookUrls: { chargeUrl: input.webhookUrl, statusUrl: input.webhookUrl },
    validity: PAGE_VALIDITY_SECONDS,
  })) as { subscriptionId?: unknown; pageUrl?: unknown } | null;
  const subscriptionId = str(json?.subscriptionId);
  const pageUrl = str(json?.pageUrl);
  if (!subscriptionId || !pageUrl || !pageUrl.startsWith("https://")) throw new MonoError(502, "bad_answer");
  return { subscriptionId, pageUrl, price: p };
}

/** Stops future charges. The paid month stays paid — no refund is asked for. */
export async function cancelSubscription(token: string, subscriptionId: string): Promise<void> {
  await call(token, "POST", "/api/merchant/subscription/edit", { subscriptionId, action: "cancel" });
}

/** Deletes a subscription that was never paid (monobank answers 1001 once it was). */
export async function removeSubscription(token: string, subscriptionId: string): Promise<void> {
  await call(token, "POST", "/api/merchant/subscription/remove", { subscriptionId });
}

interface Remote {
  /** null: the answer did not say it in a way we know. */
  status: "active" | "cancelled" | null;
  ccy: number | null;
  amount: number | null;
  nextChargeAt: number | null;
  endedAt: number | null;
  lastPaidAt: number | null;
  lastFailedAt: number | null;
  /** The payments were read in full; false → the stored failure date stands. */
  paymentsRead: boolean;
  /** What was not understood — key names only. Empty: all clear. */
  unclear: string[];
}

const SUBSCRIPTION_STATUS: Record<string, "active" | "cancelled"> = { active: "active", cancelled: "cancelled", canceled: "cancelled" };
const PAID = new Set(["success", "successful", "succeeded", "paid", "ok"]);
const FAILED = new Set(["failed", "failure", "fail", "declined", "rejected", "error"]);
const WAITING = new Set(["new", "created", "processing", "pending", "hold"]);

/** monobank's status answer → what we take from it. Exported for the reading script and the tests. */
export function parseStatus(json: unknown): Pick<Remote, "status" | "ccy" | "amount" | "nextChargeAt" | "endedAt"> & { paidCount: number | null; paidAtGuess: number | null; unclear: string[] } {
  const source = object(json);
  const unclear: string[] = [];
  const status = SUBSCRIPTION_STATUS[word(field(source, "status", "state"))] ?? null;
  if (!status) unclear.push(`status answer: no known status; keys: ${source ? Object.keys(source).sort().join(",") : "not an object"}`);
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const nextChargeAt = time(field(source, "nextChargeDate", "nextChargeAt", "nextPaymentDate", "nextCharge"));
  const paidCount = number(field(object(field(source, "summary")), "totalPaid", "paid", "successCount"));
  // Only for an answer whose payments could not be read: the month that the
  // next charge closes, else the first charge.
  const started = time(field(source, "startDate", "startedAt", "firstChargeDate"));
  const paidAtGuess = nextChargeAt ? subMonth(nextChargeAt) : started;
  return {
    status,
    ccy: number(field(source, "ccy", "currency")),
    amount: number(field(source, "amount")),
    nextChargeAt,
    endedAt: time(field(source, "endDate", "endedAt", "cancelledAt", "canceledAt")),
    paidCount,
    paidAtGuess,
    unclear,
  };
}

/** One page of monobank's payments answer. `pages` null → not told. */
export function parsePayments(json: unknown): { lastPaidAt: number | null; lastFailedAt: number | null; pages: number | null; unclear: string[] } {
  const source = object(json);
  const unclear: string[] = [];
  const raw = Array.isArray(json) ? json : field(source, "payments", "list", "items", "data");
  let lastPaidAt: number | null = null;
  let lastFailedAt: number | null = null;
  if (!Array.isArray(raw)) {
    unclear.push(`payments answer: no list; keys: ${source ? Object.keys(source).sort().join(",") : "not an object"}`);
  } else {
    const odd = new Set<string>();
    for (const item of raw) {
      const payment = object(item);
      const status = word(field(payment, "status", "state"));
      const at = time(field(payment, "chargedAt", "chargeDate", "chargeAt", "paidAt", "date", "createdDate", "createdAt", "time"));
      if (WAITING.has(status)) continue;
      const known = PAID.has(status) || FAILED.has(status);
      if (!known || at === null) {
        odd.add(payment ? Object.keys(payment).sort().join(",") : "not an object");
        continue;
      }
      if (PAID.has(status)) lastPaidAt = Math.max(lastPaidAt ?? 0, at);
      else lastFailedAt = Math.max(lastFailedAt ?? 0, at);
    }
    for (const keys of odd) unclear.push(`payment: unknown status or no date; keys: ${keys}`);
  }
  const pages = Number(field(object(field(source, "pagination", "paging")), "totalPages", "pages", "pageCount"));
  return { lastPaidAt, lastFailedAt, pages: Number.isFinite(pages) ? pages : null, unclear };
}

async function readRemote(token: string, subscriptionId: string, sinceMs: number): Promise<Remote> {
  const id = encodeURIComponent(subscriptionId);
  const status = parseStatus(await call(token, "GET", `/api/merchant/subscription/status?subscriptionId=${id}`));
  const unclear = new Set(status.unclear);
  let lastPaidAt: number | null = null;
  let lastFailedAt: number | null = null;
  const from = encodeURIComponent(new Date(sinceMs).toISOString());
  for (let page = 1; page <= 5; page++) {
    const answer = parsePayments(await call(token, "GET", `/api/merchant/subscription/payments?subscriptionId=${id}&dateFrom=${from}&limit=50&page=${page}`));
    for (const note of answer.unclear) unclear.add(note);
    if (answer.lastPaidAt) lastPaidAt = Math.max(lastPaidAt ?? 0, answer.lastPaidAt);
    if (answer.lastFailedAt) lastFailedAt = Math.max(lastFailedAt ?? 0, answer.lastFailedAt);
    if (answer.pages === null || page >= answer.pages) break;
  }
  const paymentsRead = ![...unclear].some((note) => note.startsWith("payment"));
  // monobank counts a paid charge that the list did not show us.
  if (!lastPaidAt && (status.paidCount ?? 0) > 0) {
    unclear.add("payments: summary counts a paid charge, the list shows none");
    lastPaidAt = status.paidAtGuess;
  }
  // One line, key names only: an answer may carry a card token or a wallet id.
  if (unclear.size) console.warn(`[billing] monobank answer not understood, stored state kept: ${[...unclear].slice(0, 6).join(" | ")}`);
  return { status: status.status, ccy: status.ccy, amount: status.amount, nextChargeAt: status.nextChargeAt, endedAt: status.endedAt, lastPaidAt, lastFailedAt, paymentsRead, unclear: [...unclear] };
}

/** The key names and value types of an answer — never a value. */
export function shape(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return value.length && depth < 4 ? [shape(value[0], depth + 1)] : [];
  const source = object(value);
  if (source && depth < 4) return Object.fromEntries(Object.keys(source).sort().map((key) => [key, shape(source[key], depth + 1)]));
  return value === null ? "null" : typeof value;
}

/**
 * For ops/billing/test-cycle.mjs: what monobank answers about a subscription,
 * as key names, and what this file made of it. No value of the answer leaves.
 */
export async function inspectSubscription(token: string, subscriptionId: string, sinceMs: number) {
  const id = encodeURIComponent(subscriptionId);
  const from = encodeURIComponent(new Date(sinceMs).toISOString());
  const status = await call(token, "GET", `/api/merchant/subscription/status?subscriptionId=${id}`);
  const payments = await call(token, "GET", `/api/merchant/subscription/payments?subscriptionId=${id}&dateFrom=${from}&limit=50&page=1`);
  const s = parseStatus(status);
  const p = parsePayments(payments);
  return {
    status_keys: shape(status),
    payments_keys: shape(payments),
    read: {
      status: s.status,
      next_charge_read: s.nextChargeAt !== null,
      end_read: s.endedAt !== null,
      paid_count: s.paidCount,
      paid_payment_found: p.lastPaidAt !== null,
      failed_payment_found: p.lastFailedAt !== null,
      pages: p.pages,
      not_understood: [...s.unclear, ...p.unclear],
    },
  };
}

/* ---------- state ---------- */

const SEEN_KEPT = 50;

function apply(billing: Billing, remote: Remote, nowMs: number): void {
  // A new subscription starts with no payments; the month paid under the previous one still counts.
  billing.lastPaidAt = Math.max(billing.lastPaidAt ?? 0, remote.lastPaidAt ?? 0) || null;
  if (remote.paymentsRead) billing.lastFailedAt = remote.lastFailedAt;
  if (remote.status === "cancelled") billing.status = "cancelled";
  else if (remote.lastPaidAt) billing.status = "active";
  else if (remote.status === "active" && remote.paymentsRead) billing.status = "pending";
  // Otherwise the answer does not say: the stored status stands.
  billing.ccy = remote.ccy ?? billing.ccy;
  billing.amount = remote.amount ?? billing.amount;
  billing.nextChargeAt = billing.status === "cancelled" ? null : (remote.nextChargeAt ?? billing.nextChargeAt);
  billing.endedAt = remote.endedAt ?? (billing.status === "cancelled" ? billing.endedAt : null);
  billing.syncedAt = nowMs;
  billing.unclearAt = remote.unclear.length ? nowMs : null;
  if (billing.status !== "pending") billing.pageUrl = null;
}

/**
 * Reads the subscription back from monobank and writes it into the client
 * record. `seen` (a webhook digest) is recorded in the same write. Returns the
 * fresh record, or null when there is nothing to sync.
 */
export async function syncBilling(client: Client, seen?: string, nowMs = Date.now()): Promise<Client | null> {
  const token = await monoToken(client.test);
  const subscriptionId = client.billing.subscriptionId;
  if (!token || !subscriptionId) return null;
  const since = (client.billing.createdAt ?? nowMs) - 24 * 60 * 60 * 1000;
  const remote = await readRemote(token, subscriptionId, since);
  return updateClient(client.id, (c) => {
    // The client started another subscription meanwhile: this answer is about the old one.
    if (c.billing.subscriptionId !== subscriptionId) return false;
    apply(c.billing, remote, nowMs);
    if (seen && !c.billing.seen.includes(seen)) c.billing.seen = [...c.billing.seen, seen].slice(-SEEN_KEPT);
  });
}

export async function startSubscription(client: Client, created: { subscriptionId: string; pageUrl: string; price: Price }, nowMs = Date.now()): Promise<void> {
  await updateClient(client.id, (c) => {
    c.billing = {
      ...EMPTY_BILLING,
      lastPaidAt: c.billing.lastPaidAt,
      seen: c.billing.seen,
      subscriptionId: created.subscriptionId,
      pageUrl: created.pageUrl,
      createdAt: nowMs,
      status: "pending",
      ccy: created.price.ccy,
      amount: created.price.amount,
    };
  });
}

/* ---------- access ---------- */

/** The same day next month; the 31st falls back to the month's last day. */
export function addMonth(ms: number): number {
  const d = new Date(ms);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.getTime();
}

/** The same day a month earlier. */
function subMonth(ms: number): number {
  const d = new Date(ms);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.getTime();
}

export type Access =
  /** Billing is not switched on for this client: nothing to pay, results open. */
  | { open: true; state: "no_billing" }
  | { open: true; state: "paid"; paidUntil: number }
  /** The month ran out, the charge has not come through: three more days. */
  | { open: true; state: "grace"; paidUntil: number; closesAt: number }
  | { open: false; state: "unpaid" }
  | { open: false; state: "expired"; paidUntil: number };

/**
 * Results are open while the last successful charge covers today, plus three
 * days of grace when the next charge failed or is late. A cancelled
 * subscription gets its paid month and no grace.
 *
 * While monobank's last answer was not understood (billing.unclearAt), a
 * client who has paid before is NOT closed: we cannot tell a missed charge
 * from an answer we failed to read, and the warning in the log is what gets
 * that fixed.
 */
export async function accessOf(client: Client, nowMs = Date.now()): Promise<Access> {
  if (!(await monoToken(client.test))) return { open: true, state: "no_billing" };
  const { lastPaidAt, status, unclearAt } = client.billing;
  if (!lastPaidAt) return { open: false, state: "unpaid" };
  const paidUntil = addMonth(lastPaidAt);
  if (nowMs < paidUntil) return { open: true, state: "paid", paidUntil };
  if (unclearAt && status === "active") return { open: true, state: "paid", paidUntil: Math.max(paidUntil, nowMs) };
  const closesAt = paidUntil + GRACE_MS;
  if (status === "active" && nowMs < closesAt) return { open: true, state: "grace", paidUntil, closesAt };
  return { open: false, state: "expired", paidUntil };
}

/* ---------- webhook signature ---------- */

type Kind = "live" | "test";
const keys: Partial<Record<Kind, string>> = {};
const fetchedAt: Partial<Record<Kind, number>> = {};
const REFETCH_GAP_MS = 30_000;

async function fetchKey(kind: Kind, token: string, nowMs: number): Promise<string | null> {
  fetchedAt[kind] = nowMs;
  const json = (await call(token, "GET", "/api/merchant/pubkey")) as { key?: unknown } | null;
  const key = str(json?.key);
  if (!key) return null;
  // The answer is base64 of a PEM public key.
  keys[kind] = Buffer.from(key, "base64").toString("utf8");
  return keys[kind]!;
}

function verify(pem: string, body: string, signature: string): boolean {
  try {
    return createVerify("SHA256").update(body).verify(pem, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

/**
 * X-Sign is ECDSA over the raw body. The key is cached in memory and fetched
 * again only when a signature does not verify (monobank may rotate it) — and
 * then at most once per 30 s, so a flood of forged webhooks cannot turn this
 * endpoint into a hammer on monobank's API.
 */
export async function webhookSigned(test: boolean, body: string, signature: string | null, nowMs = Date.now()): Promise<boolean> {
  const token = await monoToken(test);
  if (!token || !signature || signature.length > 400) return false;
  const kind: Kind = test ? "test" : "live";
  const cached = keys[kind];
  if (cached && verify(cached, body, signature)) return true;
  if (cached && nowMs - (fetchedAt[kind] ?? 0) < REFETCH_GAP_MS) return false;
  const fresh = await fetchKey(kind, token, nowMs);
  return !!fresh && verify(fresh, body, signature);
}

export const webhookDigest = (body: string) => createHash("sha256").update(body).digest("hex");

/** Tests only. */
export function forgetWebhookKeys(): void {
  for (const kind of ["live", "test"] as const) {
    delete keys[kind];
    delete fetchedAt[kind];
  }
}
