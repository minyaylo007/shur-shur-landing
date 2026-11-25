import { createHash, createVerify } from "node:crypto";
import { listClients, updateClient, type Billing, type Charge, type Client } from "@/lib/client/clients";
import { site } from "@/lib/site";
import { chargeBlock, liveToken, openCard, sealCard, setChargeBlock } from "./settings";

/**
 * The 15 €/month subscription through monobank acquiring. Server-only.
 * What the API takes and answers — docs/monobank-subscription.md.
 *
 * monobank switched «Оплата по підписці» on for this merchant as CARD SAVING,
 * not as its subscription API (subscription/create answers 1001 «h2h not
 * allowed»). So the month is ours to run:
 *  - «Оформити підписку» → an invoice (invoice/create) with saveCardData:
 *    the client pays 15 € on monobank's page and the card is saved; the
 *    card token comes back in the invoice status (walletData) and is kept
 *    SEALED in the client record;
 *  - once a day (Vercel cron → /api/billing/charge) a client whose paid month
 *    ran out is charged 15 € by that token (wallet/payment). One attempt per
 *    paid period: the attempt is written into the record (conditional write)
 *    BEFORE monobank is asked, so a second run, a retry or a parallel run
 *    finds it and asks nothing;
 *  - a refused charge → the 3 days of grace, then closed;
 *  - «Скасувати» → no more charges, the paid month stays.
 *
 * Other rules:
 *  - a webhook is a TRIGGER, not a source: its signature is checked, then the
 *    invoice is read back from monobank (invoice/status);
 *  - without a token there is no billing at all: no button, nothing charged;
 *  - neither the merchant token nor a card token reaches a log line, a page
 *    or an answer.
 */

const API = "https://api.monobank.ua";
const TIMEOUT_MS = 15_000;

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
 * EUR by default (ccy 978, 1500). If monobank refuses euro for this merchant,
 * set MONO_PRICE_UAH to whole hryvnias: the charge becomes UAH and the page
 * says «15 € (≈ N грн)».
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
    /** monobank refused the call type for this merchant («h2h not allowed / not supported»). */
    readonly h2h = false,
  ) {
    super(`monobank ${status} ${code}${h2h ? " h2h" : ""}`);
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
    const answer = json as { errCode?: unknown; errText?: unknown } | null;
    const code = answer?.errCode;
    // errText is monobank's free text — kept out of messages; only «is it h2h» is read from it.
    const h2h = typeof answer?.errText === "string" && /h2h/i.test(answer.errText);
    throw new MonoError(response.status, typeof code === "string" || typeof code === "number" ? String(code).slice(0, 40) : "unknown", h2h);
  }
  return json;
}

type Json = Record<string, unknown>;
const object = (value: unknown): Json | null => (value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null);
const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const word = (value: unknown): string => (typeof value === "string" ? value.trim().toLowerCase() : "");
/** RFC 3339 by the schema; epoch seconds or milliseconds are taken too. */
const time = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value < 1e11 ? value * 1000 : value;
  const ms = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : null;
};

/**
 * The token check behind the cabinet form: one read request. Returns the
 * merchant's name as monobank knows it; a refused token throws MonoError.
 */
export async function merchantDetails(token: string): Promise<{ merchantName: string | null }> {
  const json = object(await call(token, "GET", "/api/merchant/details"));
  const name = json?.merchantName;
  return { merchantName: typeof name === "string" && name.trim() ? name.trim().slice(0, 120) : null };
}

const webhookUrl = (clientId: string) => `${site.siteUrl}/api/billing/mono?c=${clientId}`;
const DESTINATION = "Підписка SHUR-SHUR: результати бота, 1 місяць";

/**
 * The first payment: an invoice that also saves the card into the wallet
 * named after the client. `walletId` is the client id — not personal data.
 */
export async function createInvoice(token: string, input: { clientId: string; redirectUrl: string; reference: string; amount?: number }): Promise<{ invoiceId: string; pageUrl: string; price: Price }> {
  // `amount`: the owner's one-off card check (billing.first) — same currency, another sum.
  const p = input.amount ? { ...price(), amount: input.amount } : price();
  const json = object(
    await call(token, "POST", "/api/merchant/invoice/create", {
      amount: p.amount,
      ccy: p.ccy,
      merchantPaymInfo: { reference: input.reference, destination: DESTINATION },
      redirectUrl: input.redirectUrl,
      webHookUrl: webhookUrl(input.clientId),
      validity: PAGE_VALIDITY_SECONDS,
      paymentType: "debit",
      saveCardData: { saveCard: true, walletId: input.clientId },
    }),
  );
  const invoiceId = str(json?.invoiceId);
  const pageUrl = str(json?.pageUrl);
  if (!invoiceId || !pageUrl || !pageUrl.startsWith("https://")) throw new MonoError(502, "bad_answer");
  return { invoiceId, pageUrl, price: p };
}

/** Invalidates an invoice nobody paid. monobank refuses once it was paid. */
export async function removeInvoice(token: string, invoiceId: string): Promise<void> {
  await call(token, "POST", "/api/merchant/invoice/remove", { invoiceId });
}

export type InvoiceState = "waiting" | "success" | "failure" | "unknown";

export interface InvoiceRead {
  state: InvoiceState;
  /** When monobank last changed it (paid at, for a success). */
  at: number | null;
  /** walletData.cardToken once the card is saved (walletData.status created). Never logged. */
  cardToken: string | null;
  /** walletData.status: new | created | failed, or null. */
  walletStatus: string | null;
  /** monobank's errCode of a failed payment — a short code, not text. */
  errCode: string | null;
}

const WAITING = new Set(["created", "processing", "hold"]);
const FAILED = new Set(["failure", "reversed", "expired"]);

/** monobank's invoice status answer → what we take from it. Exported for the tests. */
export function readInvoice(json: unknown): InvoiceRead {
  const source = object(json);
  const status = word(source?.status);
  const state: InvoiceState = status === "success" ? "success" : FAILED.has(status) ? "failure" : WAITING.has(status) ? "waiting" : "unknown";
  const wallet = object(source?.walletData);
  const walletStatus = word(wallet?.status) || null;
  const cardToken = walletStatus === "created" ? str(wallet?.cardToken) : null;
  const err = source?.errCode;
  return {
    state,
    at: time(source?.modifiedDate) ?? time(source?.createdDate),
    cardToken,
    walletStatus,
    errCode: typeof err === "string" || typeof err === "number" ? String(err).slice(0, 12) : null,
  };
}

async function invoiceStatus(token: string, invoiceId: string): Promise<InvoiceRead> {
  const json = await call(token, "GET", `/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`);
  const read = readInvoice(json);
  // One line, key names only: the answer may carry a card token.
  if (read.state === "unknown") console.warn(`[billing] invoice status not understood; keys: ${Object.keys(object(json) ?? {}).sort().join(",") || "not an object"}`);
  return read;
}

/** A charge by the saved card, initiated by us (no client on the line). */
async function payByCard(token: string, input: { cardToken: string; clientId: string; reference: string }): Promise<{ invoiceId: string | null; state: InvoiceState; tds: boolean }> {
  const p = price();
  const json = object(
    await call(token, "POST", "/api/merchant/wallet/payment", {
      cardToken: input.cardToken,
      amount: p.amount,
      ccy: p.ccy,
      initiationKind: "merchant",
      paymentType: "debit",
      merchantPaymInfo: { reference: input.reference, destination: DESTINATION },
      webHookUrl: webhookUrl(input.clientId),
    }),
  );
  const status = word(json?.status);
  return {
    invoiceId: str(json?.invoiceId),
    state: status === "success" ? "success" : status === "failure" ? "failure" : status === "processing" ? "waiting" : "unknown",
    tds: !!str(json?.tdsUrl),
  };
}

/** The key names and value types of an answer — never a value. */
export function shape(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return value.length && depth < 4 ? [shape(value[0], depth + 1)] : [];
  const source = object(value);
  if (source && depth < 4) return Object.fromEntries(Object.keys(source).sort().map((key) => [key, shape(source[key], depth + 1)]));
  return value === null ? "null" : typeof value;
}

/** For ops/billing/test-cycle.mjs: an invoice's answer as key names and what we read. No value leaves. */
export async function inspectInvoice(token: string, invoiceId: string) {
  const json = await call(token, "GET", `/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`);
  const read = readInvoice(json);
  return { keys: shape(json), read: { state: read.state, at_read: read.at !== null, wallet_status: read.walletStatus, card_token_read: read.cardToken !== null, err_code: read.errCode } };
}

/* ---------- months ---------- */

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

/** The start of a "month" that ends at `endMs` (the short first period of a card check). */
export function monthEndingAt(endMs: number): number {
  const d = new Date(endMs);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.getTime() + (endMs - addMonth(d.getTime()));
}

/* ---------- state ---------- */

const SEEN_KEPT = 50;

function paid(billing: Billing, startMs: number): void {
  billing.lastPaidAt = Math.max(billing.lastPaidAt ?? 0, startMs);
  billing.nextChargeAt = billing.status === "cancelled" ? null : addMonth(billing.lastPaidAt);
}

/** What the first invoice says, into the record. */
function applyFirst(billing: Billing, read: InvoiceRead, nowMs: number): void {
  if (read.cardToken) billing.card = sealCard(read.cardToken) ?? billing.card;
  if (billing.status !== "pending") return;
  if (read.state === "success") {
    billing.status = "active";
    billing.pageUrl = null;
    billing.charge = null;
    const at = read.at ?? nowMs;
    // A card check pays a little for a few days; the monthly charge comes when they end.
    paid(billing, billing.first ? monthEndingAt(at + billing.first.days * 24 * 60 * 60 * 1000) : at);
    billing.first = null;
  } else if (read.state === "failure") {
    // Expired or declined: the next click opens a fresh page. A subscriber who
    // tried another card in her grace days keeps the subscription and the old card.
    const subscribed = !!billing.card && !!billing.lastPaidAt && nowMs < addMonth(billing.lastPaidAt) + GRACE_MS;
    billing.status = subscribed ? "active" : "none";
    billing.pageUrl = null;
    billing.lastFailedAt = nowMs;
  }
}

/** What the charge's invoice says, into the record. */
function applyCharge(billing: Billing, charge: Charge, read: InvoiceRead, nowMs: number): void {
  if (read.state === "success") {
    charge.status = "success";
    charge.note = null;
    paid(billing, charge.period);
  } else if (read.state === "failure") {
    charge.status = "failure";
    charge.note = read.errCode ? `refused ${read.errCode}` : "refused";
    billing.lastFailedAt = nowMs;
  }
}

/**
 * Reads back from monobank what may have changed: the first invoice while it
 * waits (or while its card token has not come yet), the month's charge while
 * it is processing. `seen` (a webhook digest) is recorded in the same write.
 * Null: nothing to read.
 */
export async function syncBilling(client: Client, seen?: string, nowMs = Date.now()): Promise<Client | null> {
  const token = await monoToken(client.test);
  if (!token) return null;
  const { billing } = client;
  const first = billing.invoiceId && (billing.status === "pending" || (!billing.card && billing.status === "active")) ? billing.invoiceId : null;
  const charge = billing.charge && billing.charge.invoiceId && billing.charge.status === "processing" ? billing.charge : null;
  if (!first && !charge) return null;
  const firstRead = first ? await invoiceStatus(token, first) : null;
  const chargeRead = charge ? await invoiceStatus(token, charge.invoiceId!) : null;
  return updateClient(client.id, (c) => {
    if (firstRead && c.billing.invoiceId === first) applyFirst(c.billing, firstRead, nowMs);
    if (chargeRead && c.billing.charge?.invoiceId === charge!.invoiceId && c.billing.charge.status === "processing") applyCharge(c.billing, c.billing.charge, chargeRead, nowMs);
    c.billing.syncedAt = nowMs;
    if (seen && !c.billing.seen.includes(seen)) c.billing.seen = [...c.billing.seen, seen].slice(-SEEN_KEPT);
  });
}

/** «Оформити підписку» after monobank opened the page: the record waits for the first payment. */
export async function startPayment(client: Client, created: { invoiceId: string; pageUrl: string; price: Price }, nowMs = Date.now()): Promise<void> {
  await updateClient(client.id, (c) => {
    c.billing.invoiceId = created.invoiceId;
    c.billing.pageUrl = created.pageUrl;
    c.billing.createdAt = nowMs;
    c.billing.status = "pending";
    c.billing.ccy = created.price.ccy;
    c.billing.amount = created.price.amount;
  });
}

/* ---------- the monthly charge ---------- */

export type ChargeOutcome = "not_due" | "no_card" | "no_token" | "already" | "success" | "processing" | "failure" | "error" | "h2h" | "blocked";

/**
 * One client, once a day. Charges only when ALL hold: the subscription is
 * active (not cancelled, not waiting), a card is saved, the paid month ran out
 * and the grace days have not, and nothing was asked for this period yet.
 * `force` (test clients only, ops/billing/test-cycle.mjs): the period is the
 * coming one even before it is due.
 */
export async function chargeClient(client: Client, nowMs = Date.now(), force = false): Promise<ChargeOutcome> {
  const token = await monoToken(client.test);
  if (!token) return "no_token";
  let { billing } = client;
  if (billing.status !== "active" || !billing.lastPaidAt) return "not_due";
  const period = addMonth(billing.lastPaidAt);
  if (!force && (nowMs < period || nowMs >= period + GRACE_MS)) return "not_due";
  if (billing.charge?.period === period) {
    if (billing.charge.status === "processing") await syncBilling(client, undefined, nowMs).catch(() => null);
    return "already";
  }
  if (!billing.card && billing.invoiceId) {
    // The token may have come after the payment: one look at the first invoice.
    billing = (await syncBilling(client, undefined, nowMs).catch(() => null))?.billing ?? billing;
  }
  const cardToken = openCard(billing.card);
  if (!cardToken) return "no_card";
  if (!client.test && (await chargeBlock())) return "blocked";

  // The lock: the attempt is on record before monobank hears of it.
  let mine = false;
  await updateClient(client.id, (c) => {
    if (c.billing.status !== "active" || c.billing.charge?.period === period || c.billing.lastPaidAt !== client.billing.lastPaidAt) return false;
    c.billing.charge = { period, at: nowMs, invoiceId: null, status: "started", note: null };
    mine = true;
  });
  if (!mine) return "already";

  const reference = `${client.id}-${new Date(period).toISOString().slice(0, 10)}`;
  let result: { status: Charge["status"]; invoiceId: string | null; note: string | null; read: InvoiceRead | null };
  let outcome: ChargeOutcome;
  try {
    const answer = await payByCard(token, { cardToken, clientId: client.id, reference });
    if (answer.state === "success") {
      result = { status: "success", invoiceId: answer.invoiceId, note: null, read: null };
      outcome = "success";
    } else if (answer.state === "failure" || answer.tds) {
      // A merchant-initiated charge that asks for 3-D Secure cannot be finished without the client.
      result = { status: "failure", invoiceId: answer.invoiceId, note: answer.tds ? "3ds" : "refused", read: null };
      outcome = "failure";
    } else {
      result = { status: answer.invoiceId ? "processing" : "error", invoiceId: answer.invoiceId, note: answer.invoiceId ? null : "bad_answer", read: null };
      outcome = answer.invoiceId ? "processing" : "error";
    }
  } catch (error) {
    if (error instanceof MonoError && error.h2h) {
      result = { status: "error", invoiceId: null, note: "h2h", read: null };
      outcome = "h2h";
    } else if (error instanceof MonoError && error.status >= 400 && error.status < 500) {
      result = { status: "failure", invoiceId: null, note: `refused ${error.code}`.slice(0, 40), read: null };
      outcome = "failure";
    } else {
      // No answer: it may or may not have gone through — not asked again; the cabinet says check monobank.
      result = { status: "error", invoiceId: null, note: "no_answer", read: null };
      outcome = "error";
    }
  }

  await updateClient(client.id, (c) => {
    const charge = c.billing.charge;
    if (!charge || charge.period !== period) return false;
    charge.status = result.status;
    charge.invoiceId = result.invoiceId;
    charge.note = result.note;
    if (result.status === "success") paid(c.billing, period);
    if (result.status === "failure") c.billing.lastFailedAt = nowMs;
  });
  return outcome;
}

/**
 * The daily run (Vercel cron → /api/billing/charge). Counts only: no name,
 * no id, no token in what it returns or logs. A merchant-level h2h refusal
 * on the live token stops the run and marks the cabinet once.
 */
export async function runCharges(nowMs = Date.now()): Promise<Record<ChargeOutcome, number>> {
  const counts = { not_due: 0, no_card: 0, no_token: 0, already: 0, success: 0, processing: 0, failure: 0, error: 0, h2h: 0, blocked: 0 } as Record<ChargeOutcome, number>;
  const all = await listClients();
  for (const client of all) {
    let outcome: ChargeOutcome;
    try {
      outcome = await chargeClient(client, nowMs);
    } catch (error) {
      console.error(`[billing] charge run: one client failed: ${error instanceof Error ? error.name : "unknown"}`);
      outcome = "error";
    }
    counts[outcome] += 1;
    if (outcome === "h2h") {
      if (!client.test) {
        await setChargeBlock("h2h", nowMs);
        console.error("[billing] monobank refuses charges by saved card for this merchant (h2h) — charges stopped until the token is saved again in /cabinet");
        break;
      }
      console.error("[billing] monobank test environment refuses charges by saved card (h2h)");
    }
  }
  return counts;
}

/* ---------- access ---------- */

export type Access =
  /** Billing is not switched on for this client: nothing to pay, results open. */
  | { open: true; state: "no_billing" }
  | { open: true; state: "paid"; paidUntil: number }
  /** The month ran out, the charge has not come through: three more days. */
  | { open: true; state: "grace"; paidUntil: number; closesAt: number }
  | { open: false; state: "unpaid" }
  | { open: false; state: "expired"; paidUntil: number };

/**
 * Results are open while the last paid month covers today, plus three days of
 * grace while the subscription runs and the month's charge has not come
 * through. A cancelled subscription gets its paid month and no grace.
 */
export async function accessOf(client: Client, nowMs = Date.now()): Promise<Access> {
  if (!(await monoToken(client.test))) return { open: true, state: "no_billing" };
  const { lastPaidAt, status } = client.billing;
  if (!lastPaidAt) return { open: false, state: "unpaid" };
  const paidUntil = addMonth(lastPaidAt);
  if (nowMs < paidUntil) return { open: true, state: "paid", paidUntil };
  const closesAt = paidUntil + GRACE_MS;
  if ((status === "active" || status === "pending") && nowMs < closesAt) return { open: true, state: "grace", paidUntil, closesAt };
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
