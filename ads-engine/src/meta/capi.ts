import type { Db } from "../db.ts";
import { normalizeContact, sha256Hex } from "../normalize.ts";
import { graphPost, type FetchLike } from "./graph.ts";
import type { Status } from "../funnel.ts";
import { log } from "../log.ts";

/* Quality signal back to Meta (Conversions API, CRM funnel events).
   OFF by default. Sends only when: enabled, token and dataset present, the
   lead is not spam, and consent.ads was true at submission. Identifiers go
   out only as SHA-256 of the normalised value; fbc/fbp are passed as-is (they
   are Meta's own cookies, not personal data we collected). event_id is the
   lead_id — the same id the site uses for Pixel ↔ CAPI deduplication. */

export const CAPI_EVENTS: Partial<Record<Status, string>> = {
  qualified: "QualifiedLead",
  won: "Purchase",
};

export interface CapiSettings {
  enabled: boolean;
  token: string | undefined;
  datasetId: string | undefined;
  testEventCode?: string;
}

interface LeadRow {
  lead_id: string;
  contact: string | null;
  market: string;
  attribution: string;
  consent_ads: number;
  is_spam: number;
  deal_amount: number | null;
  deal_currency: string | null;
}

export function buildEvent(lead: LeadRow, eventName: string, eventTime: Date): Record<string, unknown> {
  const attribution = JSON.parse(lead.attribution) as Record<string, string>;
  const user_data: Record<string, unknown> = { external_id: [sha256Hex(lead.lead_id)] };
  const norm = lead.contact ? normalizeContact(lead.contact, lead.market) : null;
  if (norm?.kind === "email") user_data.em = [sha256Hex(norm.value)];
  if (norm?.kind === "phone") user_data.ph = [sha256Hex(norm.value)];
  if (attribution.fbc) user_data.fbc = attribution.fbc;
  if (attribution.fbp) user_data.fbp = attribution.fbp;

  const custom_data: Record<string, unknown> = { event_source: "crm", lead_event_source: "shur-ads-engine" };
  if (eventName === "Purchase" && lead.deal_amount && lead.deal_currency) {
    custom_data.value = lead.deal_amount;
    custom_data.currency = lead.deal_currency;
  }
  return {
    event_name: eventName,
    event_time: Math.floor(eventTime.getTime() / 1000),
    event_id: lead.lead_id,
    action_source: "system_generated",
    user_data,
    custom_data,
  };
}

export type CapiOutcome = "sent" | "disabled" | "no_consent" | "spam" | "already_sent" | "failed" | "not_tracked";

export async function sendStageEvent(
  db: Db,
  settings: CapiSettings,
  leadId: string,
  status: Status,
  fetchFn: FetchLike = fetch,
  now = new Date(),
): Promise<CapiOutcome> {
  const eventName = CAPI_EVENTS[status];
  if (!eventName) return "not_tracked";
  const record = (outcome: CapiOutcome, detail: string | null = null) => {
    db.prepare(
      `INSERT INTO capi_events(lead_id, event_name, at, status, detail) VALUES(?,?,?,?,?)
       ON CONFLICT(lead_id, event_name) DO UPDATE SET at = excluded.at, status = excluded.status, detail = excluded.detail`,
    ).run(leadId, eventName, now.toISOString(), outcome, detail);
    return outcome;
  };
  const prior = db
    .prepare("SELECT status FROM capi_events WHERE lead_id = ? AND event_name = ?")
    .get(leadId, eventName) as { status: string } | undefined;
  if (prior?.status === "sent") return "already_sent";

  if (!settings.enabled || !settings.token || !settings.datasetId) return record("disabled");
  const lead = db
    .prepare(
      "SELECT lead_id, contact, market, attribution, consent_ads, is_spam, deal_amount, deal_currency FROM leads WHERE lead_id = ?",
    )
    .get(leadId) as LeadRow | undefined;
  if (!lead) return "failed";
  if (lead.is_spam) return record("spam");
  if (!lead.consent_ads) return record("no_consent");

  const body: Record<string, unknown> = { data: [buildEvent(lead, eventName, now)] };
  if (settings.testEventCode) body.test_event_code = settings.testEventCode;
  try {
    await graphPost(fetchFn, `${settings.datasetId}/events`, settings.token, body);
    log("capi.sent", { lead_id: leadId, event: eventName });
    return record("sent");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("capi.failed", { lead_id: leadId, event: eventName, error: message.slice(0, 200) });
    return record("failed", message.slice(0, 300));
  }
}

/** Daily retry of failed sends (Meta accepts events up to 7 days old). */
export async function retryFailed(db: Db, settings: CapiSettings, fetchFn: FetchLike = fetch, now = new Date()) {
  const since = new Date(now.getTime() - 6 * 86400_000).toISOString();
  const rows = db
    .prepare("SELECT lead_id, event_name FROM capi_events WHERE status = 'failed' AND at >= ?")
    .all(since) as { lead_id: string; event_name: string }[];
  let sent = 0;
  for (const r of rows) {
    const status = (Object.entries(CAPI_EVENTS).find(([, v]) => v === r.event_name)?.[0] ?? "") as Status;
    if ((await sendStageEvent(db, settings, r.lead_id, status, fetchFn, now)) === "sent") sent++;
  }
  return { retried: rows.length, sent };
}
