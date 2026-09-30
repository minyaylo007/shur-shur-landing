import { createHmac } from "node:crypto";
import type { Attribution, Market } from "./attribution";

/**
 * The lead ledger — a SECOND, best-effort copy of every accepted lead, per
 * the «site → lead ledger» contract (v1, 29.09.2026). Server-only.
 *
 * Telegram stays the main channel. The ledger call is made after Telegram
 * has taken the lead, is bounded by a 2 s timeout, and NEVER throws: its
 * failure cannot change what the visitor is answered. With no `LEDGER_URL`
 * or no `LEDGER_HMAC_SECRET` the step is skipped and the log gets the NAMES
 * of the missing variables — no value, no prefix, no length. The log never
 * gets anything from the lead either: no name, no contact, no body.
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
}

export const LEDGER_TIMEOUT_MS = 2000;

/** `sha256=<hex HMAC-SHA256(secret, timestamp + "." + raw body)>` */
export function signLedgerBody(secret: string, timestamp: string, rawBody: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
}

export type LedgerOutcome = "sent" | "skipped" | "failed";

export async function sendLeadToLedger(lead: LedgerLead): Promise<LedgerOutcome> {
  const base = process.env.LEDGER_URL?.trim();
  const secret = process.env.LEDGER_HMAC_SECRET;
  const missing = [base ? null : "LEDGER_URL", secret ? null : "LEDGER_HMAC_SECRET"].filter(
    (name): name is string => name !== null,
  );
  if (missing.length > 0) {
    console.info(`[lead] ledger skipped: missing env ${missing.join(", ")}`);
    return "skipped";
  }

  const body = JSON.stringify(lead);
  const timestamp = String(Math.floor(Date.now() / 1000));
  try {
    const response = await fetch(`${base!.replace(/\/+$/, "")}/v1/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shur-Timestamp": timestamp,
        "X-Shur-Signature": signLedgerBody(secret!, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(LEDGER_TIMEOUT_MS),
    });
    if (!response.ok) {
      // Status only: the ledger's answer may echo the lead back.
      console.error(`[lead] ledger refused: HTTP ${response.status} (lead_id=${lead.lead_id})`);
      return "failed";
    }
    return "sent";
  } catch (error) {
    // The error NAME only (TimeoutError, TypeError…): a message can quote the URL.
    const kind = error instanceof Error ? error.name : "unknown";
    console.error(`[lead] ledger unreachable: ${kind} (lead_id=${lead.lead_id})`);
    return "failed";
  }
}
