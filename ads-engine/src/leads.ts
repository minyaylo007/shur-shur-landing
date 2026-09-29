import type { Db } from "./db.ts";
import { tx } from "./db.ts";
import { MARKETS, type Market } from "./config.ts";
import { normalizeContact, contactHash } from "./normalize.ts";

/* POST /v1/leads body, contract v1 (~/maestro/tasks/shur-ads-contract.md).
   Validation is hand-written on purpose: the service has no dependencies. */

export const KINDS = ["lead", "audit"] as const;
export const LOCALES = ["uk", "en", "he", "ro"] as const;
export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "fbc",
  "fbp",
  "landing_path",
  "referrer_host",
  "first_seen_at",
] as const;
export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];
export type Attribution = Partial<Record<AttributionKey, string>>;

export interface LeadInput {
  lead_id: string;
  created_at: string;
  kind: (typeof KINDS)[number];
  locale: (typeof LOCALES)[number] | null;
  market: Market;
  name: string | null;
  contact: string | null;
  message: string | null;
  ig_handle: string | null;
  attribution: Attribution;
  consent: { ads: boolean };
}

export const DUPLICATE_WINDOW_DAYS = 30;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIMITS = { name: 100, contact: 100, message: 1000, ig_handle: 61 } as const;
const ATTRIBUTION_MAX = 300;

/** Contract: 1) landing path /ro/suceava… or /he/tel-aviv…; 2) utm_campaign sv_ / ta_; 3) other. */
export function deriveMarket(landingPath?: string, utmCampaign?: string): Market {
  const path = (landingPath ?? "").toLowerCase();
  if (path.startsWith("/ro/suceava")) return "suceava";
  if (path.startsWith("/he/tel-aviv")) return "tel_aviv";
  const campaign = (utmCampaign ?? "").toLowerCase();
  if (campaign.startsWith("sv_")) return "suceava";
  if (campaign.startsWith("ta_")) return "tel_aviv";
  return "other";
}

export type ParseResult = { ok: true; lead: LeadInput } | { ok: false; field: string };

function optString(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string" || v.length > max) return undefined;
  const t = v.trim();
  return t === "" ? null : t;
}

export function parseLead(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, field: "body" };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.lead_id !== "string" || !UUID_V4.test(b.lead_id)) return { ok: false, field: "lead_id" };
  if (typeof b.created_at !== "string" || !Number.isFinite(Date.parse(b.created_at))) {
    return { ok: false, field: "created_at" };
  }
  if (!KINDS.includes(b.kind as never)) return { ok: false, field: "kind" };
  let locale: LeadInput["locale"] = null;
  if (b.locale !== undefined && b.locale !== null) {
    if (!LOCALES.includes(b.locale as never)) return { ok: false, field: "locale" };
    locale = b.locale as LeadInput["locale"];
  }

  const fields: Record<keyof typeof LIMITS, string | null> = {
    name: null,
    contact: null,
    message: null,
    ig_handle: null,
  };
  for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    const v = optString(b[key], LIMITS[key]);
    if (v === undefined) return { ok: false, field: key };
    fields[key] = v;
  }

  const attribution: Attribution = {};
  if (b.attribution !== undefined && b.attribution !== null) {
    if (typeof b.attribution !== "object" || Array.isArray(b.attribution)) {
      return { ok: false, field: "attribution" };
    }
    const a = b.attribution as Record<string, unknown>;
    for (const key of ATTRIBUTION_KEYS) {
      const v = optString(a[key], ATTRIBUTION_MAX);
      if (v === undefined) return { ok: false, field: `attribution.${key}` };
      if (v !== null) attribution[key] = v;
    }
  }

  const consent = b.consent as Record<string, unknown> | undefined;
  if (typeof consent !== "object" || consent === null || typeof consent.ads !== "boolean") {
    return { ok: false, field: "consent" };
  }

  // The site computes the market with the same rule; if it sent a valid one we
  // keep it (it saw the page), otherwise derive it here.
  const market: Market = MARKETS.includes(b.market as never)
    ? (b.market as Market)
    : deriveMarket(attribution.landing_path, attribution.utm_campaign);

  return {
    ok: true,
    lead: {
      lead_id: b.lead_id.toLowerCase(),
      created_at: new Date(b.created_at).toISOString(),
      kind: b.kind as LeadInput["kind"],
      locale,
      market,
      ...fields,
      attribution,
      consent: { ads: consent.ads },
    },
  };
}

export interface IngestResult {
  ok: true;
  lead_id: string;
  market: Market;
  status: string;
  duplicate: boolean;
  spam: boolean;
}

function spamReason(db: Db, lead: LeadInput, hash: string | null): string | null {
  const urls = (s: string | null) => (s ? (s.match(/https?:\/\/|www\./gi) ?? []).length : 0);
  if (lead.kind === "lead" && !lead.contact) return "no_contact";
  if (urls(lead.name) > 0) return "link_in_name";
  if (urls(lead.message) >= 3) return "links_in_message";
  if (hash) {
    const since = new Date(Date.parse(lead.created_at) - 24 * 3600_000).toISOString();
    const row = db
      .prepare("SELECT COUNT(*) AS n FROM leads WHERE contact_hash = ? AND created_at >= ?")
      .get(hash, since) as { n: number };
    if (row.n >= 5) return "flood";
  }
  return null;
}

/** Stores a lead once. A replay of the same lead_id returns the stored result unchanged. */
export function ingestLead(
  db: Db,
  lead: LeadInput,
  now: Date = new Date(),
): { result: IngestResult; created: boolean } {
  return tx(db, () => {
    const existing = db.prepare("SELECT result_json FROM leads WHERE lead_id = ?").get(lead.lead_id) as
      | { result_json: string }
      | undefined;
    if (existing) return { result: JSON.parse(existing.result_json) as IngestResult, created: false };

    const norm = lead.contact ? normalizeContact(lead.contact, lead.market) : null;
    const hash = norm ? contactHash(norm) : null;

    let duplicateOf: string | null = null;
    if (hash) {
      const since = new Date(Date.parse(lead.created_at) - DUPLICATE_WINDOW_DAYS * 86400_000).toISOString();
      const prev = db
        .prepare(
          "SELECT lead_id FROM leads WHERE contact_hash = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at ASC LIMIT 1",
        )
        .get(hash, since, lead.created_at) as { lead_id: string } | undefined;
      duplicateOf = prev?.lead_id ?? null;
    }
    const spam = spamReason(db, lead, hash);
    const result: IngestResult = {
      ok: true,
      lead_id: lead.lead_id,
      market: lead.market,
      status: spam ? "lost" : "new",
      duplicate: duplicateOf !== null,
      spam: spam !== null,
    };
    const at = now.toISOString();
    db.prepare(
      `INSERT INTO leads(lead_id, received_at, created_at, kind, locale, market, name, contact, message,
         ig_handle, contact_hash, attribution, consent_ads, is_duplicate, duplicate_of, is_spam, spam_reason,
         status, lost_reason, status_at, result_json)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      lead.lead_id,
      at,
      lead.created_at,
      lead.kind,
      lead.locale,
      lead.market,
      lead.name,
      lead.contact,
      lead.message,
      lead.ig_handle,
      hash,
      JSON.stringify(lead.attribution),
      lead.consent.ads ? 1 : 0,
      duplicateOf ? 1 : 0,
      duplicateOf,
      spam ? 1 : 0,
      spam,
      result.status,
      spam ? "spam" : null,
      at,
      JSON.stringify(result),
    );
    db.prepare(
      "INSERT INTO lead_events(lead_id, at, from_status, to_status, actor, reason) VALUES(?,?,?,?,?,?)",
    ).run(lead.lead_id, at, null, result.status, "ingest", spam);
    return { result, created: true };
  });
}
