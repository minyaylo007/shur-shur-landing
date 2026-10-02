import { describe, it, expect, afterEach } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { listen } from "../src/server.ts";
import { verify } from "../src/hmac.ts";
import { ingestLead, parseLead, REDELIVERY_AFTER_MS } from "../src/leads.ts";
import { deleteLead, markDelivered, redeliverDue, BACKOFF_MS, GIVE_UP_AFTER_MS } from "../src/delivery.ts";
import { redeliver } from "../src/app.ts";
import { openDb, type Db } from "../src/db.ts";
import { testApp, leadBody, signedHeaders, captureLog, tmpDir, SECRET, NOW } from "./helpers.ts";

/* Договор v1.1: заявка не теряется, когда Telegram лежит в момент отправки.
   Сайт пишет её сюда первой с delivery:"pending"; без отметки «доставлено»
   через 2 минуты журнал сам пересылает её через сайт — ровно один раз. */

const SITE = "https://site.test.invalid";
const at = (ms: number) => new Date(NOW.getTime() + ms);

function ingest(db: Db, over: Record<string, unknown> = {}) {
  const p = parseLead(leadBody({ delivery: "pending", ...over }));
  if (!p.ok) throw new Error(`bad lead: ${p.field}`);
  return ingestLead(db, p.lead, NOW).result.lead_id;
}

function row(db: Db, id: string) {
  return db
    .prepare("SELECT delivered_at, delivered_by, delivery_attempts, next_attempt_at, delivery_gave_up_at FROM leads WHERE lead_id = ?")
    .get(id) as {
    delivered_at: string | null;
    delivered_by: string | null;
    delivery_attempts: number;
    next_attempt_at: string | null;
    delivery_gave_up_at: string | null;
  };
}

/** The site's /api/lead/redeliver: answers by script, records every call. */
function fakeSite(answers: (number | "throw")[] = [200]) {
  const calls: { url: string; headers: Record<string, string>; raw: string }[] = [];
  const queue = [...answers];
  const fetchFn = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), headers: init.headers as Record<string, string>, raw: init.body as string });
    const a = queue.length > 1 ? queue.shift()! : queue[0];
    if (a === "throw") throw new TypeError("fetch failed");
    return new Response("{}", { status: a });
  }) as typeof fetch;
  return { calls, fetchFn };
}

const deps = (db: Db, fetchFn: typeof fetch, now: Date, extra: Partial<Parameters<typeof redeliverDue>[0]> = {}) => ({
  db,
  siteUrl: SITE,
  secret: SECRET,
  fetchFn,
  now: () => now,
  ...extra,
});

describe("ingest: pending vs legacy", () => {
  it("delivery:\"pending\" is undelivered and due in 2 minutes; a v1 lead (no field) counts as delivered", () => {
    const db = openDb(":memory:");
    const pending = ingest(db);
    expect(row(db, pending)).toMatchObject({ delivered_at: null, next_attempt_at: at(REDELIVERY_AFTER_MS).toISOString() });

    const p = parseLead(leadBody());
    if (!p.ok) throw new Error("bad lead");
    const legacy = ingestLead(db, p.lead, NOW).result.lead_id;
    expect(row(db, legacy)).toMatchObject({ delivered_by: "v1", next_attempt_at: null });
  });

  it("any other delivery value is refused by field", () => {
    expect(parseLead(leadBody({ delivery: "done" }))).toEqual({ ok: false, field: "delivery" });
  });
});

describe("Telegram упал → ретрай доставил один раз", () => {
  it("nothing before 2 min; one signed call after; the next passes send nothing", async () => {
    const db = openDb(":memory:");
    const id = ingest(db);
    const site = fakeSite([200]);

    expect((await redeliverDue(deps(db, site.fetchFn, at(REDELIVERY_AFTER_MS - 1000)))).due).toBe(0);
    expect(site.calls).toHaveLength(0);

    const pass = await redeliverDue(deps(db, site.fetchFn, at(REDELIVERY_AFTER_MS)));
    expect(pass).toEqual({ due: 1, delivered: 1, failed: 0, gaveUp: 0 });
    expect(site.calls).toHaveLength(1);

    const call = site.calls[0];
    expect(call.url).toBe(`${SITE}/api/lead/redeliver`);
    const ts = Number(call.headers["x-shur-timestamp"]);
    expect(verify(SECRET, call.headers["x-shur-timestamp"], call.headers["x-shur-signature"], Buffer.from(call.raw), ts).ok).toBe(true);
    const sent = JSON.parse(call.raw);
    expect(sent).toMatchObject({ lead_id: id, kind: "lead", market: "suceava", contact: "+40 712 345 678" });
    expect(row(db, id)).toMatchObject({ delivered_by: "redelivery", delivery_attempts: 1, next_attempt_at: null });

    for (const later of [REDELIVERY_AFTER_MS + 60_000, GIVE_UP_AFTER_MS * 2]) {
      await redeliverDue(deps(db, site.fetchFn, at(later)));
    }
    expect(site.calls).toHaveLength(1);
  });

  it("two concurrent passes over the same lead → one call", async () => {
    const db = openDb(":memory:");
    ingest(db);
    const site = fakeSite([200]);
    const now = at(REDELIVERY_AFTER_MS);
    const [a, b] = await Promise.all([redeliverDue(deps(db, site.fetchFn, now)), redeliverDue(deps(db, site.fetchFn, now))]);
    expect(site.calls).toHaveLength(1);
    expect(a.delivered + b.delivered).toBe(1);
  });

  it("the site's own mark arriving first means the ledger never re-sends", async () => {
    const db = openDb(":memory:");
    const id = ingest(db);
    expect(markDelivered(db, id, "site", at(5_000))).toBe("marked");
    const site = fakeSite();
    await redeliverDue(deps(db, site.fetchFn, at(REDELIVERY_AFTER_MS * 10)));
    expect(site.calls).toHaveLength(0);
  });

  it("still down → backoff 1 min, then the next success delivers once", async () => {
    const db = openDb(":memory:");
    const id = ingest(db);
    const site = fakeSite([502, "throw", 200]);
    const t0 = REDELIVERY_AFTER_MS;

    const { out, lines } = await captureLog(() => redeliverDue(deps(db, site.fetchFn, at(t0))));
    expect(out.failed).toBe(1);
    expect(row(db, id)).toMatchObject({ delivered_at: null, delivery_attempts: 1, next_attempt_at: at(t0 + BACKOFF_MS[0]).toISOString() });
    expect(lines.join("\n")).not.toContain("+40 712");

    await redeliverDue(deps(db, site.fetchFn, at(t0 + BACKOFF_MS[0] - 1)));
    expect(site.calls).toHaveLength(1);
    await redeliverDue(deps(db, site.fetchFn, at(t0 + BACKOFF_MS[0])));
    expect(row(db, id)).toMatchObject({ delivery_attempts: 2, next_attempt_at: at(t0 + BACKOFF_MS[0] + BACKOFF_MS[1]).toISOString() });
    await redeliverDue(deps(db, site.fetchFn, at(t0 + BACKOFF_MS[0] + BACKOFF_MS[1])));
    expect(site.calls).toHaveLength(3);
    expect(row(db, id)).toMatchObject({ delivered_by: "redelivery", delivery_attempts: 3 });
  });

  it("after 24 h the ledger gives up and tells the ops chat the id only", async () => {
    const db = openDb(":memory:");
    const id = ingest(db);
    db.prepare("UPDATE leads SET next_attempt_at = ? WHERE lead_id = ?").run(at(GIVE_UP_AFTER_MS).toISOString(), id);
    const alerts: string[] = [];
    const site = fakeSite([500]);
    const pass = await redeliverDue(
      deps(db, site.fetchFn, at(GIVE_UP_AFTER_MS), { alert: async (t: string) => alerts.push(t) }),
    );
    expect(pass.gaveUp).toBe(1);
    expect(row(db, id).delivery_gave_up_at).not.toBeNull();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain(id);
    expect(alerts[0]).not.toMatch(/Ioana|\+40/);

    await redeliverDue(deps(db, site.fetchFn, at(GIVE_UP_AFTER_MS * 3)));
    expect(site.calls).toHaveLength(1);
  });

  it("off when the site URL is off or the secret is missing", async () => {
    const db = openDb(":memory:");
    ingest(db);
    const site = fakeSite();
    await redeliverDue(deps(db, site.fetchFn, at(REDELIVERY_AFTER_MS), { siteUrl: undefined }));
    await redeliverDue(deps(db, site.fetchFn, at(REDELIVERY_AFTER_MS), { secret: undefined }));
    expect(site.calls).toHaveLength(0);

    const app = testApp({ env: { SHUR_SITE_URL: "off" }, fetchFn: site.fetchFn });
    expect(app.modes.redelivery).toBe("off");
    expect(await redeliver(app, () => at(REDELIVERY_AFTER_MS))).toEqual({ due: 0, delivered: 0, failed: 0, gaveUp: 0 });
  });
});

describe("POST /v1/leads/<id>/delivered", () => {
  let server: Server | undefined;
  afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

  async function start() {
    const app = testApp();
    server = await listen(app, 0);
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}`;
    const post = (path: string, body: unknown, headers?: Record<string, string>) => {
      const raw = JSON.stringify(body);
      return fetch(base + path, { method: "POST", body: raw, headers: headers ?? signedHeaders(raw) });
    };
    return { app, post };
  }

  it("marks once, then reports «already»; unknown → 404; id mismatch → 400; unsigned → 401", async () => {
    const { app, post } = await start();
    const body = leadBody({ delivery: "pending" });
    const id = body.lead_id as string;
    expect((await post("/v1/leads", body)).status).toBe(200);

    const first = await post(`/v1/leads/${id}/delivered`, { lead_id: id });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, lead_id: id, already: false });
    expect(row(app.db, id).delivered_by).toBe("site");

    expect(await (await post(`/v1/leads/${id}/delivered`, { lead_id: id })).json()).toMatchObject({ already: true });

    const other = "00000000-0000-4000-8000-000000000000";
    expect((await post(`/v1/leads/${other}/delivered`, { lead_id: other })).status).toBe(404);
    expect((await post(`/v1/leads/${id}/delivered`, { lead_id: other })).status).toBe(400);
    expect((await post(`/v1/leads/${id}/delivered`, { lead_id: id }, { "content-type": "application/json" })).status).toBe(401);
  });
});

describe("migration and delete", () => {
  it("rows from before v1.1 are backfilled as delivered and never re-sent", async () => {
    const dir = join(tmpDir(), "data");
    const db = openDb(dir);
    const id = ingest(db);
    db.close();

    // Roll the file back to the v1 shape: no delivery columns.
    const raw = new DatabaseSync(join(dir, "ledger.sqlite"));
    raw.exec("DROP INDEX IF EXISTS leads_undelivered");
    for (const c of ["delivered_at", "delivered_by", "delivery_attempts", "next_attempt_at", "delivery_gave_up_at"]) {
      raw.exec(`ALTER TABLE leads DROP COLUMN ${c}`);
    }
    raw.close();

    const again = openDb(dir);
    expect(row(again, id)).toMatchObject({ delivered_by: "v1", next_attempt_at: null });
    const site = fakeSite();
    await redeliverDue(deps(again, site.fetchFn, at(GIVE_UP_AFTER_MS)));
    expect(site.calls).toHaveLength(0);
    again.close();
  });

  it("deleteLead removes one lead with its events and nothing else", () => {
    const db = openDb(":memory:");
    const keep = ingest(db);
    const drop = ingest(db);
    expect(deleteLead(db, drop)).toBe(1);
    expect(deleteLead(db, drop)).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM lead_events WHERE lead_id = ?").get(drop)).toEqual({ n: 0 });
    expect(db.prepare("SELECT lead_id FROM leads").all()).toEqual([{ lead_id: keep }]);
  });
});
