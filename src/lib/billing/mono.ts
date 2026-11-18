import { createHash, createVerify } from "node:crypto";
import { EMPTY_BILLING, updateClient, type Billing, type Client } from "@/lib/client/clients";

/**
 * The 15 €/month subscription through monobank acquiring. Server-only.
 * What the API takes and answers — docs/monobank-subscription.md.
 *
 * Two rules shape this file:
 *  - a webhook is a TRIGGER, not a source: its signature is checked, then the
 *    state is read back from monobank (status + payments). The body schema of
 *    subscription webhooks is not documented, and this way a replayed or
 *    reordered webhook cannot write a stale state;
 *  - without a token there is no billing at all: no button, nothing charged.
 */

const API = "https://api.monobank.ua";
const TIMEOUT_MS = 10_000;

export const PRICE_EUR = 15;
export const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
/** monobank keeps the payment page alive this long (seconds); ours to set. */
const PAGE_VALIDITY_SECONDS = 24 * 60 * 60;
export const PAGE_REUSE_MS = 23 * 60 * 60 * 1000;

/* ---------- configuration ---------- */

/** A test client pays in the test environment and can never reach the live token. */
export function monoToken(test: boolean): string | null {
  const value = (test ? process.env.MONO_TEST_TOKEN : process.env.MONO_TOKEN)?.trim();
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

const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const time = (value: unknown): number | null => {
  const ms = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : null;
};

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
  status: "active" | "cancelled";
  ccy: number | null;
  amount: number | null;
  nextChargeAt: number | null;
  endedAt: number | null;
  lastPaidAt: number | null;
  lastFailedAt: number | null;
}

async function readRemote(token: string, subscriptionId: string, sinceMs: number): Promise<Remote> {
  const id = encodeURIComponent(subscriptionId);
  const status = (await call(token, "GET", `/api/merchant/subscription/status?subscriptionId=${id}`)) as Record<string, unknown> | null;
  let lastPaidAt: number | null = null;
  let lastFailedAt: number | null = null;
  const from = encodeURIComponent(new Date(sinceMs).toISOString());
  for (let page = 1; page <= 5; page++) {
    const json = (await call(token, "GET", `/api/merchant/subscription/payments?subscriptionId=${id}&dateFrom=${from}&limit=50&page=${page}`)) as {
      payments?: unknown;
      pagination?: { totalPages?: unknown };
    } | null;
    const payments = Array.isArray(json?.payments) ? (json.payments as Record<string, unknown>[]) : [];
    for (const payment of payments) {
      const at = time(payment?.chargedAt);
      if (at === null) continue;
      if (payment.status === "success") lastPaidAt = Math.max(lastPaidAt ?? 0, at);
      if (payment.status === "failed") lastFailedAt = Math.max(lastFailedAt ?? 0, at);
    }
    const pages = Number(json?.pagination?.totalPages);
    if (!Number.isFinite(pages) || page >= pages) break;
  }
  return {
    status: status?.status === "cancelled" ? "cancelled" : "active",
    ccy: typeof status?.ccy === "number" ? status.ccy : null,
    amount: typeof status?.amount === "number" ? status.amount : null,
    nextChargeAt: time(status?.nextChargeDate),
    endedAt: time(status?.endDate),
    lastPaidAt,
    lastFailedAt,
  };
}

/* ---------- state ---------- */

const SEEN_KEPT = 50;

function apply(billing: Billing, remote: Remote, nowMs: number): void {
  // A new subscription starts with no payments; the month paid under the previous one still counts.
  billing.lastPaidAt = Math.max(billing.lastPaidAt ?? 0, remote.lastPaidAt ?? 0) || null;
  billing.lastFailedAt = remote.lastFailedAt;
  billing.status = remote.status === "cancelled" ? "cancelled" : remote.lastPaidAt ? "active" : "pending";
  billing.ccy = remote.ccy ?? billing.ccy;
  billing.amount = remote.amount ?? billing.amount;
  billing.nextChargeAt = remote.status === "cancelled" ? null : remote.nextChargeAt;
  billing.endedAt = remote.endedAt;
  billing.syncedAt = nowMs;
  if (billing.status !== "pending") billing.pageUrl = null;
}

/**
 * Reads the subscription back from monobank and writes it into the client
 * record. `seen` (a webhook digest) is recorded in the same write. Returns the
 * fresh record, or null when there is nothing to sync.
 */
export async function syncBilling(client: Client, seen?: string, nowMs = Date.now()): Promise<Client | null> {
  const token = monoToken(client.test);
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
 */
export function accessOf(client: Client, nowMs = Date.now()): Access {
  if (!monoToken(client.test)) return { open: true, state: "no_billing" };
  const { lastPaidAt, status } = client.billing;
  if (!lastPaidAt) return { open: false, state: "unpaid" };
  const paidUntil = addMonth(lastPaidAt);
  if (nowMs < paidUntil) return { open: true, state: "paid", paidUntil };
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
  const token = monoToken(test);
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
