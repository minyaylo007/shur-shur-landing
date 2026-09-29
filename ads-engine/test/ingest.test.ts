import { describe, it, expect, afterEach } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { statSync } from "node:fs";
import { join } from "node:path";
import { listen } from "../src/server.ts";
import { verify, sign } from "../src/hmac.ts";
import { deriveMarket, parseLead } from "../src/leads.ts";
import { testApp, leadBody, signedHeaders, captureLog, SECRET, CHAT } from "./helpers.ts";

/* Приём лидов по договору v1: подпись и окно времени, идемпотентность,
   дубли и спам, и главное — имя и контакт не попадают ни в журнал,
   ни в служебный чат. */

let server: Server | undefined;
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

async function start(env: Record<string, string> = {}) {
  const app = testApp({ env });
  server = await listen(app, 0);
  const { address, port } = server.address() as AddressInfo;
  expect(address).toBe("127.0.0.1");
  const url = `http://127.0.0.1:${port}/v1/leads`;
  const post = (body: unknown, headers?: Record<string, string>) => {
    const raw = JSON.stringify(body);
    return fetch(url, { method: "POST", body: raw, headers: headers ?? signedHeaders(raw) });
  };
  return { app, url, post, port };
}

type Result = { ok: boolean; lead_id: string; market: string; status: string; duplicate: boolean; spam: boolean };
async function json(r: Promise<Response>): Promise<Result> {
  return (await (await r).json()) as Result;
}

describe("HMAC", () => {
  const raw = Buffer.from('{"a":1}');
  const now = 1_790_000_000;
  it("accepts the contract signature and rejects a tampered body", () => {
    const sig = sign(SECRET, String(now), raw);
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(verify(SECRET, String(now), sig, raw, now)).toEqual({ ok: true });
    expect(verify(SECRET, String(now), sig, Buffer.from('{"a":2}'), now)).toEqual({ ok: false, error: "bad_signature" });
    expect(verify("other", String(now), sig, raw, now)).toEqual({ ok: false, error: "bad_signature" });
  });
  it("enforces the ±300 s window", () => {
    const ts = String(now - 301);
    expect(verify(SECRET, ts, sign(SECRET, ts, raw), raw, now)).toEqual({ ok: false, error: "stale_timestamp" });
    const ok = String(now + 299);
    expect(verify(SECRET, ok, sign(SECRET, ok, raw), raw, now)).toEqual({ ok: true });
    expect(verify(SECRET, undefined, sign(SECRET, ok, raw), raw, now).ok).toBe(false);
  });
});

describe("POST /v1/leads", () => {
  it("accepts a signed lead, 401 on a bad or stale signature", async () => {
    const { post } = await start();
    const body = leadBody();
    const ok = await post(body);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, lead_id: body.lead_id, market: "suceava", status: "new", duplicate: false, spam: false });

    const raw = JSON.stringify(leadBody());
    const bad = await post(JSON.parse(raw), { ...signedHeaders(raw), "x-shur-signature": "sha256=" + "0".repeat(64) });
    expect(bad.status).toBe(401);
    expect(await bad.json()).toEqual({ ok: false, error: "bad_signature" });

    const stale = await post(JSON.parse(raw), signedHeaders(raw, Math.floor(Date.now() / 1000) - 400));
    expect(stale.status).toBe(401);
    expect(await stale.json()).toEqual({ ok: false, error: "stale_timestamp" });
  });

  it("is idempotent on lead_id: a replay returns the very same result and stores one row", async () => {
    const { post, app } = await start();
    const body = leadBody();
    const first = await json(post(body));
    const again = await post({ ...body, message: "changed on retry" });
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual(first);
    expect((app.db.prepare("SELECT COUNT(*) AS n FROM leads").get() as { n: number }).n).toBe(1);
  });

  it("marks the same normalised contact within 30 days as a duplicate", async () => {
    const { post } = await start();
    await post(leadBody({ contact: "+40 712 345 678", created_at: "2026-09-01T10:00:00Z" }));
    const dup = await json(post(leadBody({ contact: "0712-345-678", created_at: "2026-09-20T10:00:00Z" })));
    expect(dup.duplicate).toBe(true);
    const later = await json(post(leadBody({ contact: "+40712345678", created_at: "2026-11-15T10:00:00Z" })));
    expect(later.duplicate).toBe(false);
    const email1 = await json(post(leadBody({ contact: "Ana@Example.com" })));
    const email2 = await json(post(leadBody({ contact: " ana@example.COM " })));
    expect(email1.duplicate).toBe(false);
    expect(email2.duplicate).toBe(true);
  });

  it("flags spam but still stores it", async () => {
    const { post, app } = await start();
    const spam = await json(post(leadBody({ message: "http://a.x http://b.x www.c.x" })));
    expect(spam).toMatchObject({ spam: true, status: "lost" });
    const noContact = await json(post(leadBody({ contact: null })));
    expect(noContact.spam).toBe(true);
    const row = app.db.prepare("SELECT lost_reason FROM leads WHERE lead_id = ?").get(spam.lead_id) as { lost_reason: string };
    expect(row.lost_reason).toBe("spam");
  });

  it("rejects malformed input with the field name, never the value", async () => {
    const { post } = await start();
    for (const [over, field] of [
      [{ lead_id: "not-a-uuid" }, "lead_id"],
      [{ kind: "vip" }, "kind"],
      [{ consent: {} }, "consent"],
      [{ attribution: { utm_source: "x".repeat(301) } }, "attribution.utm_source"],
      [{ name: "y".repeat(101) }, "name"],
      [{ created_at: "yesterday" }, "created_at"],
    ] as const) {
      const r = await post(leadBody(over as Record<string, unknown>));
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ ok: false, error: "invalid_input", field });
    }
  });

  it("answers 503 not_configured without a secret and 413 on a huge body", async () => {
    const { post } = await start({ LEDGER_HMAC_SECRET: "" });
    const r = await post(leadBody());
    expect(r.status).toBe(503);
    server!.close();
    const s2 = await start();
    const huge = leadBody({ message: "z".repeat(40_000) });
    expect((await s2.post(huge)).status).toBe(413);
  });

  it("never writes name or contact to the log or to the ops chat", async () => {
    const { post, app } = await start();
    const body = leadBody({ name: "Zofia Uniquename", contact: "zofia.unique@example.org", message: "Secret plan", ig_handle: "zofia_ig" });
    const { lines } = await captureLog(async () => {
      await post(body);
      await post(body);
      await post({ ...body, lead_id: "bad" });
      await new Promise((r) => setTimeout(r, 30)); // the ops-chat notification is sent after the answer
    });
    const logged = lines.join("\n");
    expect(logged).toContain("lead.accepted");
    const tg = JSON.stringify(app.tg.calls);
    expect(app.tg.sent()[0].chat_id).toBe(CHAT);
    for (const secret of ["Zofia", "Uniquename", "zofia.unique", "example.org", "Secret plan", "zofia_ig"]) {
      expect(logged).not.toContain(secret);
      expect(tg).not.toContain(secret);
    }
  });

  it("keeps the data directory 700 and the database 600", async () => {
    const { app } = await start();
    expect(statSync(app.config.dataDir).mode & 0o777).toBe(0o700);
    expect(statSync(join(app.config.dataDir, "ledger.sqlite")).mode & 0o777).toBe(0o600);
  });

  it("GET /healthz reports modes, never secrets", async () => {
    const { port } = await start();
    const r = await fetch(`http://127.0.0.1:${port}/healthz`);
    const text = await r.text();
    expect(r.status).toBe(200);
    expect(JSON.parse(text).modes).toMatchObject({ telegram: "dry", meta: "fixtures", capi: "off", writes: "simulator" });
    expect(text).not.toContain(SECRET);
  });
});

describe("market", () => {
  it("follows the contract order: landing path, then utm_campaign prefix, then other", () => {
    expect(deriveMarket("/ro/suceava/foto", "ta_x")).toBe("suceava");
    expect(deriveMarket("/he/tel-aviv", undefined)).toBe("tel_aviv");
    expect(deriveMarket("/uk", "sv_spring")).toBe("suceava");
    expect(deriveMarket("/en", "TA_brand")).toBe("tel_aviv");
    expect(deriveMarket("/uk", "brand")).toBe("other");
  });
  it("derives the market when the site sent none", () => {
    const p = parseLead(leadBody({ market: undefined, attribution: { landing_path: "/he/tel-aviv" } }));
    expect(p.ok && p.lead.market).toBe("tel_aviv");
  });
});
