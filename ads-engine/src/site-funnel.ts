import type { Db } from "./db.ts";
import { MARKETS, type Market } from "./config.ts";
import { LOCALES } from "./leads.ts";

/* Site funnel counters (B3.2, 04.11.2026; not the lead-status funnel of
   funnel.ts): visits, «reached the form» and messenger clicks, per UTC day. The site posts `{ funnel: {...} }`
   signed on POST /v1/leads (the only path Caddy lets through) and the ledger
   adds 1 to a daily aggregate — no row per visitor, no IP, no UA, no id, no
   path. A body with any field not named here is refused whole, so nothing
   personal can ride along into storage. */

export const FUNNEL_EVENTS = ["visit", "form_reached", "contact_click"] as const;
export const FUNNEL_CHANNELS = ["whatsapp", "telegram", "instagram", "viber", "phone"] as const;
export const FUNNEL_PLACEMENTS = ["header", "hero", "contact_bar", "contact_section", "packages", "footer"] as const;
const KEYS = new Set(["event", "locale", "market", "channel", "placement"]);

export interface FunnelEvent {
  event: (typeof FUNNEL_EVENTS)[number];
  locale: (typeof LOCALES)[number];
  market: Market;
  channel: string;
  placement: string;
}

export function parseFunnel(raw: unknown): { ok: true; event: FunnelEvent } | { ok: false; field: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, field: "funnel" };
  const b = raw as Record<string, unknown>;
  for (const key of Object.keys(b)) if (!KEYS.has(key)) return { ok: false, field: key };
  if (!FUNNEL_EVENTS.includes(b.event as never)) return { ok: false, field: "event" };
  if (!LOCALES.includes(b.locale as never)) return { ok: false, field: "locale" };
  if (!MARKETS.includes(b.market as never)) return { ok: false, field: "market" };
  const click = b.event === "contact_click";
  // Channel and placement belong to the click only; '' keeps the primary key NOT NULL.
  if (click ? !FUNNEL_CHANNELS.includes(b.channel as never) : b.channel !== undefined) return { ok: false, field: "channel" };
  if (click ? !FUNNEL_PLACEMENTS.includes(b.placement as never) : b.placement !== undefined) return { ok: false, field: "placement" };
  return {
    ok: true,
    event: {
      event: b.event as FunnelEvent["event"],
      locale: b.locale as FunnelEvent["locale"],
      market: b.market as Market,
      channel: click ? (b.channel as string) : "",
      placement: click ? (b.placement as string) : "",
    },
  };
}

export function countFunnel(db: Db, e: FunnelEvent, now: Date = new Date()): void {
  db.prepare(
    `INSERT INTO site_funnel_daily(date, event, locale, market, channel, placement, n) VALUES(?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(date, event, locale, market, channel, placement) DO UPDATE SET n = n + 1`,
  ).run(now.toISOString().slice(0, 10), e.event, e.locale, e.market, e.channel, e.placement);
}

export interface FunnelDay {
  date: string;
  visits: number;
  form_reached: number;
  contact_clicks: number;
}

/** Per-day totals since `since` (inclusive), only days that have a count. */
export function funnelDays(db: Db, since: string): FunnelDay[] {
  return db
    .prepare(
      `SELECT date,
              SUM(CASE WHEN event = 'visit' THEN n ELSE 0 END) AS visits,
              SUM(CASE WHEN event = 'form_reached' THEN n ELSE 0 END) AS form_reached,
              SUM(CASE WHEN event = 'contact_click' THEN n ELSE 0 END) AS contact_clicks
         FROM site_funnel_daily WHERE date >= ? GROUP BY date ORDER BY date`,
    )
    .all(since) as unknown as FunnelDay[];
}

/** The first day the counter ran; before it «no data» (null), never 0. */
export function funnelSince(db: Db): string | null {
  return (db.prepare("SELECT MIN(date) AS d FROM site_funnel_daily").get() as { d: string | null }).d;
}
