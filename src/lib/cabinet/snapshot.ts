import { z } from "zod";

/**
 * The cabinet snapshot, v1 — the only thing the stats page shows. Built by
 * ads-engine on ace-main (ads-engine/src/cabinet.ts) and pushed signed to
 * /api/cabinet/ingest.
 *
 * Counters only. Every object is STRICT: a field the schema does not name —
 * `name`, `contact`, `phone`, `email`, `lead_id`, anything — fails the whole
 * snapshot, so personal data cannot ride in by accident. Free text that the
 * schema does allow (campaign names, the conclusions) is scanned for things
 * that look like an e-mail or a phone number on top of that.
 */

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count = z.number().int().min(0);
const money = z.number().min(0);
const nullableRate = z.number().min(0).nullable();

export const adsDaySchema = z.strictObject({
  date,
  campaign: z.string().min(1).max(200),
  spend: money,
  impressions: count,
  clicks: count,
  ctr: nullableRate,
  cpc: nullableRate,
  /** Leads the ledger attributes to this campaign (UTM / click id). */
  leads: count,
});

export const siteDaySchema = z.strictObject({
  date,
  /** null = no source for this counter yet; shown as «нет данных», never 0. */
  visits: count.nullable(),
  form_reached: count.nullable(),
  leads: count,
});

export const snapshotSchema = z.strictObject({
  version: z.literal(1),
  generated_at: z.iso.datetime({ offset: true }),
  /** True while ads-engine reads Meta FIXTURES: the ad rows are made up and
      the page must not show them as real. Site counters come from the lead
      ledger and are real either way. */
  test_data: z.boolean(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  ads: z.strictObject({
    connected: z.boolean(),
    days: z.array(adsDaySchema).max(5000),
  }),
  site: z.strictObject({
    days: z.array(siteDaySchema).max(400),
  }),
  insights: z
    .strictObject({
      date,
      markdown: z.string().max(20_000),
    })
    .nullable(),
});

export type Snapshot = z.infer<typeof snapshotSchema>;

const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
/* A plus and 8+ digits, or 10+ digits in a row: phones, not dates or money. */
const PHONE = /\+\s*\d(?:[\s().-]*\d){7,}|\d{10,}/;

/** Strings in the snapshot that look like someone's contact. */
export function personalDataHits(snapshot: Snapshot): string[] {
  const texts: [string, string][] = [
    ...snapshot.ads.days.map((d, i): [string, string] => [`ads.days[${i}].campaign`, d.campaign]),
    ...(snapshot.insights ? [["insights.markdown", snapshot.insights.markdown] as [string, string]] : []),
  ];
  return texts.filter(([, text]) => EMAIL.test(text) || PHONE.test(text)).map(([where]) => where);
}

export type ParsedSnapshot =
  | { ok: true; snapshot: Snapshot }
  | { ok: false; error: "invalid_snapshot" | "personal_data"; where?: string[] };

export function parseSnapshot(input: unknown): ParsedSnapshot {
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) {
    // Paths only: an issue message can quote the offending value.
    return { ok: false, error: "invalid_snapshot", where: parsed.error.issues.map((i) => i.path.join(".")) };
  }
  const hits = personalDataHits(parsed.data);
  if (hits.length > 0) return { ok: false, error: "personal_data", where: hits };
  return { ok: true, snapshot: parsed.data };
}

/** What the page may present as real numbers: connected and not fixtures. */
export function hasRealAds(snapshot: Snapshot | null): boolean {
  return !!snapshot && snapshot.ads.connected && !snapshot.test_data && snapshot.ads.days.length > 0;
}
