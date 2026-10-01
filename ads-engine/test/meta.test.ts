import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ingestLead, parseLead } from "../src/leads.ts";
import { setStatus } from "../src/funnel.ts";
import { MetaHttpReader, FixtureReader, collect, freshness, type AdsReader } from "../src/meta/insights.ts";
import { GRAPH_API_VERSION, GRAPH_API_VERSION_CHECKED } from "../src/meta/graph.ts";
import { sendStageEvent, retryFailed, type CapiSettings } from "../src/meta/capi.ts";
import { GoogleAdsStubReader, GoogleAdsNotConfigured } from "../src/google.ts";
import { sha256Hex } from "../src/normalize.ts";
import { memDb, leadBody, NOW, testApp } from "./helpers.ts";
import { setLogSink } from "../src/log.ts";

/* Сбор Meta Insights (только чтение, закреплённая версия Graph API,
   перечитывание 7 дней) и Conversions API (выключен по умолчанию, только с
   согласием, только хэши). Сеть — поддельная. */

type Call = { url: URL; method: string; body?: string };

function fakeGraph(routes: (u: URL) => unknown) {
  const calls: Call[] = [];
  const fn = async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    calls.push({ url: u, method: init?.method ?? "GET", body: init?.body as string | undefined });
    const out = routes(u);
    if (out instanceof Error) return new Response(JSON.stringify({ error: { message: out.message, code: 190 } }), { status: 400 });
    return new Response(JSON.stringify(out), { status: 200 });
  };
  return { calls, fn: fn as unknown as typeof fetch };
}

const ACCOUNT = { currency: "EUR", timezone_name: "Europe/Bucharest" };

function row(level: string, date: string, spend: string, extra: Record<string, unknown> = {}) {
  return {
    date_start: date,
    campaign_id: "111",
    campaign_name: "sv_fake",
    adset_id: level === "campaign" ? undefined : "222",
    adset_name: "sv_fake_set",
    ad_id: level === "ad" ? "333" : undefined,
    ad_name: "sv_fake_ad",
    spend,
    actions: [{ action_type: "lead", value: "2" }],
    ...extra,
  };
}

describe("Meta Insights reader", () => {
  it("pins the Graph API version checked against the changelog", () => {
    expect(GRAPH_API_VERSION).toBe("v26.0");
    expect(GRAPH_API_VERSION_CHECKED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reads three levels by day with paging, GET only, token never in errors", async () => {
    let spend = "10.50";
    const g = fakeGraph((u) => {
      if (u.pathname.endsWith("/act_999")) return ACCOUNT;
      if (u.pathname.endsWith("/insights")) {
        const level = u.searchParams.get("level")!;
        if (u.searchParams.get("after") === "p2") return { data: [row(level, "2026-09-28", spend)] };
        return { data: [row(level, "2026-09-27", "5")], paging: { next: `https://graph.facebook.com/${GRAPH_API_VERSION}/act_999/insights?level=${level}&after=p2&access_token=tok` } };
      }
      if (u.pathname.endsWith("/campaigns")) return { data: [{ id: "111", name: "sv_fake", daily_budget: "2000", effective_status: "ACTIVE" }] };
      if (u.pathname.endsWith("/adsets")) return { data: [] };
      return new Error("unexpected");
    });
    const reader = new MetaHttpReader("tok", "999", g.fn);
    const db = memDb();
    const s = await collect(db, reader, { now: NOW });
    expect(s).toMatchObject({ ok: true, rows: 6, mode: "live" });
    expect(g.calls.every((c) => c.method === "GET")).toBe(true);
    expect(g.calls.every((c) => c.url.pathname.startsWith(`/${GRAPH_API_VERSION}/`))).toBe(true);
    const first = g.calls.find((c) => c.url.pathname.endsWith("/insights"))!.url.searchParams;
    expect(first.get("time_increment")).toBe("1");
    expect(JSON.parse(first.get("time_range")!)).toEqual({ since: "2026-08-30", until: "2026-09-29" });
    expect([...new Set(g.calls.map((c) => c.url.searchParams.get("level")).filter(Boolean))]).toEqual(["campaign", "adset", "ad"]);

    const rows = db.prepare("SELECT level, date, spend, currency, timezone, market, platform_leads FROM insights ORDER BY level, date").all();
    expect(rows).toContainEqual({ level: "campaign", date: "2026-09-28", spend: 10.5, currency: "EUR", timezone: "Europe/Bucharest", market: "suceava", platform_leads: 2 });
    expect(db.prepare("SELECT daily_budget FROM budgets").get()).toEqual({ daily_budget: 20 });

    // Next run re-reads only the last 7 days and replaces them (Meta restates spend).
    spend = "12";
    const again = await collect(db, reader, { now: NOW });
    expect(again.since).toBe("2026-09-22");
    const restated = db.prepare("SELECT spend FROM insights WHERE level='campaign' AND date='2026-09-28'").get();
    expect(restated).toEqual({ spend: 12 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM insights").get()).toEqual({ n: 6 });
  });

  it("falls back to pixel + on-Facebook leads when the aggregate is absent", async () => {
    const g = fakeGraph((u) => {
      if (u.pathname.endsWith("/act_999")) return ACCOUNT;
      if (u.pathname.endsWith("/insights"))
        return {
          data: [
            row(u.searchParams.get("level")!, "2026-09-28", "3", {
              actions: [
                { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
                { action_type: "onsite_conversion.lead_grouped", value: "2" },
              ],
            }),
          ],
        };
      return { data: [] };
    });
    const db = memDb();
    await collect(db, new MetaHttpReader("tok", "act_999", g.fn), { now: NOW });
    expect(db.prepare("SELECT platform_leads FROM insights WHERE level='campaign'").get()).toEqual({ platform_leads: 3 });
  });

  it("records a failed run without leaking the token, and keeps old data", async () => {
    const g = fakeGraph(() => new Error("Invalid OAuth access token"));
    const db = memDb();
    const s = await collect(db, new MetaHttpReader("secret-token-xyz", "999", g.fn), { now: NOW });
    expect(s.ok).toBe(false);
    expect(s.error).not.toContain("secret-token-xyz");
    expect(freshness(db, "meta", NOW)).toMatchObject({ lastRunOk: false, lastOkAt: null });
  });

  it("works on fixtures without a token; fixtures look fresh", async () => {
    const db = memDb();
    const reader = new FixtureReader("ads-engine/fixtures/meta-insights.json", () => NOW);
    const s = await collect(db, reader, { now: NOW });
    expect(s).toMatchObject({ ok: true, mode: "fixtures" });
    expect(s.rows).toBeGreaterThan(100);
    const markets = db.prepare("SELECT DISTINCT market FROM insights ORDER BY market").all().map((r) => (r as { market: string }).market);
    expect(markets).toEqual(["other", "suceava", "tel_aviv"]);
    expect(db.prepare("SELECT MAX(date) AS d FROM insights").get()).toEqual({ d: "2026-09-29" });
  });

  it("fixture ids are fake — nothing that looks like a real account", () => {
    const raw = readFileSync("ads-engine/fixtures/meta-insights.json", "utf8");
    expect(raw).not.toMatch(/act_\d{6,}/);
    const ids = [...raw.matchAll(/"(?:object_id|campaign_id|adset_id|ad_id)":\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    // Obviously synthetic: 7/8/9 followed by a run of zeros.
    expect(ids.every((id) => /^[789]0{9,}\d{1,3}$/.test(id))).toBe(true);
  });

  it("Google Ads is an interface stub", async () => {
    const g: AdsReader = new GoogleAdsStubReader();
    await expect(g.account()).rejects.toBeInstanceOf(GoogleAdsNotConfigured);
  });
});

describe("Conversions API", () => {
  const ON: CapiSettings = { enabled: true, token: "tok", datasetId: "555" };

  function withLead(over: Record<string, unknown> = {}) {
    const db = memDb();
    const p = parseLead(
      leadBody({ contact: " Ana.Pop@Example.COM ", attribution: { fbc: "fb.1.1.abc", landing_path: "/ro/suceava" }, ...over }),
    );
    if (!p.ok) throw new Error(p.field);
    ingestLead(db, p.lead);
    return { db, id: p.lead.lead_id };
  }

  it("is off by default in the app", () => {
    expect(testApp().capi.enabled).toBe(false);
    expect(testApp({ env: { META_ACCESS_TOKEN: "x", META_DATASET_ID: "1" } }).capi.enabled).toBe(false);
  });

  it("sends a hashed QualifiedLead with event_id = lead_id and no raw contact", async () => {
    const { db, id } = withLead();
    const g = fakeGraph(() => ({ events_received: 1 }));
    setStatus(db, id, { to: "qualified", actor: "t" });
    expect(await sendStageEvent(db, ON, id, "qualified", g.fn, NOW)).toBe("sent");
    const [call] = g.calls;
    expect(call.method).toBe("POST");
    expect(call.url.pathname).toBe(`/${GRAPH_API_VERSION}/555/events`);
    expect(call.body).not.toMatch(/ana|example|Ioana/i);
    const ev = JSON.parse(call.body!).data[0];
    expect(ev).toMatchObject({ event_name: "QualifiedLead", event_id: id, action_source: "system_generated" });
    expect(ev.user_data.em).toEqual([sha256Hex("ana.pop@example.com")]);
    expect(ev.user_data.fbc).toBe("fb.1.1.abc");
    // idempotent
    expect(await sendStageEvent(db, ON, id, "qualified", g.fn, NOW)).toBe("already_sent");
    expect(g.calls).toHaveLength(1);
  });

  it("Purchase carries value and currency; phones are hashed in E.164 digits", async () => {
    const { db, id } = withLead({ contact: "0712 345 678" });
    const g = fakeGraph(() => ({ events_received: 1 }));
    setStatus(db, id, { to: "won", actor: "t", amount: 900, currency: "RON" });
    expect(await sendStageEvent(db, ON, id, "won", g.fn, NOW)).toBe("sent");
    const ev = JSON.parse(g.calls[0].body!).data[0];
    expect(ev.custom_data).toMatchObject({ value: 900, currency: "RON" });
    expect(ev.user_data.ph).toEqual([sha256Hex("40712345678")]);
  });

  it("never sends without consent, for spam, or when disabled", async () => {
    const g = fakeGraph(() => ({ events_received: 1 }));
    const a = withLead({ consent: { ads: false } });
    expect(await sendStageEvent(a.db, ON, a.id, "qualified", g.fn, NOW)).toBe("no_consent");
    const b = withLead({ message: "http://a http://b http://c" });
    expect(await sendStageEvent(b.db, ON, b.id, "won", g.fn, NOW)).toBe("spam");
    const c = withLead();
    expect(await sendStageEvent(c.db, { ...ON, enabled: false }, c.id, "qualified", g.fn, NOW)).toBe("disabled");
    expect(await sendStageEvent(c.db, ON, c.id, "contacted", g.fn, NOW)).toBe("not_tracked");
    expect(g.calls).toHaveLength(0);
  });

  it("a failure is recorded and retried by the daily job", async () => {
    const { db, id } = withLead();
    let up = false;
    const g = fakeGraph(() => (up ? { events_received: 1 } : new Error("temporarily unavailable")));
    expect(await sendStageEvent(db, ON, id, "qualified", g.fn, NOW)).toBe("failed");
    up = true;
    expect(await retryFailed(db, ON, g.fn, NOW)).toEqual({ retried: 1, sent: 1 });
  });
});

describe("Graph token never in a URL, an error or the log", () => {
  const TOKEN = "EAAsecret-token-5f3a";

  type Seen = { url: string; method: string; auth: string | null; body?: string };
  function spyFetch(fail: "none" | "network" | "graph") {
    const seen: Seen[] = [];
    const fn = async (url: string, init?: RequestInit) => {
      seen.push({
        url,
        method: init?.method ?? "GET",
        auth: new Headers(init?.headers).get("authorization"),
        body: init?.body as string | undefined,
      });
      // A client that puts the full URL into its error text (node-fetch does).
      if (fail === "network") throw new TypeError(`request to ${url} failed, reason: ECONNRESET`);
      if (fail === "graph") return new Response(JSON.stringify({ error: { message: "Invalid OAuth access token", code: 190 } }), { status: 400 });
      const u = new URL(url);
      if (u.pathname.endsWith("/act_999")) return new Response(JSON.stringify(ACCOUNT));
      if (u.pathname.endsWith("/insights") && !u.searchParams.get("after"))
        // Meta echoes the token into paging.next when it was sent in the query.
        return new Response(JSON.stringify({ data: [row(u.searchParams.get("level")!, "2026-09-27", "5")], paging: { next: `${u.origin}${u.pathname}?level=x&after=p2&access_token=${TOKEN}` } }));
      return new Response(JSON.stringify({ data: [], events_received: 1 }));
    };
    return { seen, fn: fn as unknown as typeof fetch };
  }

  function captureLog() {
    const lines: string[] = [];
    const prev = setLogSink((l) => lines.push(l));
    return { lines, restore: () => setLogSink(prev) };
  }

  async function capiWithLead(fetchFn: typeof fetch) {
    const db = memDb();
    const p = parseLead(leadBody({ contact: "ana@example.com" }));
    if (!p.ok) throw new Error(p.field);
    ingestLead(db, p.lead);
    const outcome = await sendStageEvent(db, { enabled: true, token: TOKEN, datasetId: "555" }, p.lead.lead_id, "qualified", fetchFn, NOW);
    const detail = (db.prepare("SELECT detail FROM capi_events").get() as { detail: string | null }).detail;
    return { outcome, detail };
  }

  for (const fail of ["none", "network", "graph"] as const) {
    it(`CAPI POST (${fail}): token only in the JSON body`, async () => {
      const g = spyFetch(fail);
      const log = captureLog();
      try {
        const { outcome, detail } = await capiWithLead(g.fn);
        expect(outcome).toBe(fail === "none" ? "sent" : "failed");
        expect(g.seen).toHaveLength(1);
        expect(g.seen[0].url).not.toContain(TOKEN);
        expect(new URL(g.seen[0].url).search).toBe("");
        expect(JSON.parse(g.seen[0].body!).access_token).toBe(TOKEN);
        expect(detail ?? "").not.toContain(TOKEN);
        expect(log.lines.join("\n")).not.toContain(TOKEN);
        if (fail === "network") expect(detail).toContain("ECONNRESET");
      } finally {
        log.restore();
      }
    });

    it(`Insights GET (${fail}): token only in the Authorization header`, async () => {
      const g = spyFetch(fail);
      const log = captureLog();
      try {
        const s = await collect(memDb(), new MetaHttpReader(TOKEN, "999", g.fn), { now: NOW });
        expect(s.ok).toBe(fail === "none");
        expect(g.seen.length).toBeGreaterThan(0);
        if (fail === "none") expect(g.seen.some((c) => c.url.includes("after=p2"))).toBe(true);
        for (const c of g.seen) {
          expect(c.method).toBe("GET");
          expect(c.url).not.toContain(TOKEN);
          expect(c.auth).toBe(`Bearer ${TOKEN}`);
        }
        expect(JSON.stringify(s)).not.toContain(TOKEN);
        expect(log.lines.join("\n")).not.toContain(TOKEN);
      } finally {
        log.restore();
      }
    });
  }
});
