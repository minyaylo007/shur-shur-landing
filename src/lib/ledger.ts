import { createHmac, timingSafeEqual } from "node:crypto";
import type { Attribution, Market } from "./attribution";

/**
 * The lead ledger (ads-engine on ace-main), contract v1.1 (03.10.2026).
 * Server-only.
 *
 * v1 made the ledger a best-effort copy written AFTER Telegram, so a Telegram
 * outage lost the lead outright. v1.1 turns the order round: the ledger takes
 * the lead first with `delivery: "pending"`, Telegram second, and on success
 * the site marks the lead delivered. A lead the ledger holds without that mark
 * for 2 minutes is re-sent by the ledger through `/api/lead/redeliver` — the
 * ledger lives on a server that never sleeps, a Vercel function does not.
 *
 * Every call here is bounded by a 2 s timeout and NEVER throws. With no
 * `LEDGER_URL` or no `LEDGER_HMAC_SECRET` the step is skipped and the log gets
 * the NAMES of the missing variables — no value, no prefix, no length. The log
 * never gets anything from the lead either: no name, no contact, no body.
 */

export interface LedgerLead {
  lead_id: string;
  created_at: string;
  kind: "lead" | "audit";
  locale: string;
  market: Market;
  name?: string;
  contact?: string;
  message?: string;
  ig_handle?: string;
  attribution?: Attribution;
  consent: { ads: boolean };
  /** v1.1: Telegram has not seen it yet; the ledger re-sends it unless marked. */
  delivery?: "pending";
}

export const LEDGER_TIMEOUT_MS = 2000;
/** Same window as the ledger's own check (ads-engine/src/hmac.ts). */
export const SIGNATURE_WINDOW_SECONDS = 300;

/** `sha256=<hex HMAC-SHA256(secret, timestamp + "." + raw body)>` */
export function signLedgerBody(secret: string, timestamp: string, rawBody: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
}

/** The reverse direction (ledger → site): same scheme, same secret, same window. */
export function verifyLedgerSignature(
  secret: string,
  timestamp: string | null,
  signature: string | null,
  rawBody: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!timestamp || !/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > SIGNATURE_WINDOW_SECONDS) return false;
  if (!signature || !/^sha256=[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signLedgerBody(secret, timestamp, rawBody).slice(7), "hex");
  const given = Buffer.from(signature.slice(7), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type LedgerOutcome = "sent" | "skipped" | "failed";

function ledgerConfig(): { base: string; secret: string } | null {
  const base = process.env.LEDGER_URL?.trim();
  const secret = process.env.LEDGER_HMAC_SECRET;
  const missing = [base ? null : "LEDGER_URL", secret ? null : "LEDGER_HMAC_SECRET"].filter(
    (name): name is string => name !== null,
  );
  if (missing.length > 0) {
    console.info(`[lead] ledger skipped: missing env ${missing.join(", ")}`);
    return null;
  }
  return { base: base!.replace(/\/+$/, ""), secret: secret! };
}

async function postSigned(
  url: string,
  secret: string,
  payload: unknown,
  what: string,
  leadId: string,
): Promise<LedgerOutcome> {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shur-Timestamp": timestamp,
        "X-Shur-Signature": signLedgerBody(secret, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(LEDGER_TIMEOUT_MS),
    });
    if (!response.ok) {
      // Status only: the ledger's answer may echo the lead back.
      console.error(`[lead] ${what} refused: HTTP ${response.status} (lead_id=${leadId})`);
      return "failed";
    }
    return "sent";
  } catch (error) {
    // The error NAME only (TimeoutError, TypeError…): a message can quote the URL.
    const kind = error instanceof Error ? error.name : "unknown";
    console.error(`[lead] ${what} unreachable: ${kind} (lead_id=${leadId})`);
    return "failed";
  }
}

export async function sendLeadToLedger(lead: LedgerLead): Promise<LedgerOutcome> {
  const config = ledgerConfig();
  if (!config) return "skipped";
  return postSigned(`${config.base}/v1/leads`, config.secret, lead, "ledger", lead.lead_id);
}

/** Telegram took the lead: tell the ledger not to re-send it. */
export async function markLeadDelivered(leadId: string): Promise<LedgerOutcome> {
  const config = ledgerConfig();
  if (!config) return "skipped";
  return postSigned(
    `${config.base}/v1/leads/${leadId}/delivered`,
    config.secret,
    { lead_id: leadId },
    "ledger delivery mark",
    leadId,
  );
}
