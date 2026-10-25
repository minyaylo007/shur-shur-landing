import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseLead, ingestLead } from "../src/leads.ts";
import { buildSnapshot, pushSnapshot, SNAPSHOT_FILE } from "../src/cabinet.ts";
import { verify } from "../src/hmac.ts";
import { testApp, leadBody, seedCampaign, NOW } from "./helpers.ts";

/* The owner's cabinet snapshot, engine side — rights only: counters, no
   personal data; fixtures flagged as test data; the push is signed with the
   cabinet key. The site's half (refuses unknown fields) is in
   tests/cabinet-access.test.ts. */

const CAB = "cabinet-secret-not-real";

function seeded() {
  const app = testApp({ env: { CABINET_HMAC_SECRET: CAB } });
  seedCampaign(app.db, { id: "c1", name: "sv_prospecting_ro", market: "suceava", daily: 30, spendPerDay: 20, days: 3, today: "2026-09-29" });
  for (const over of [
    { name: "Ioana Testescu", contact: "+40 712 345 678", created_at: "2026-09-28T10:00:00Z" },
    { name: "Mihai Probescu", contact: "mihai.probe@example.org", created_at: "2026-09-28T11:00:00Z" },
  ]) {
    const p = parseLead(leadBody(over));
    if (!p.ok) throw new Error(p.field);
    ingestLead(app.db, p.lead);
  }
  return app;
}

describe("cabinet snapshot", () => {
  it("carries counters only — no name, contact, message or lead id", () => {
    const app = seeded();
    const snap = buildSnapshot(app.db, { metaMode: "live", now: NOW });
    const text = JSON.stringify(snap);
    expect(text).not.toMatch(/Ioana|Testescu|Mihai|Probescu|712 345|example\.org|Vrem o sesiune/);
    expect(text).not.toMatch(/"(name|contact|message|ig_handle|lead_id|phone|email)"/);
    expect(snap.site.days).toEqual([{ date: "2026-09-28", visits: null, form_reached: null, leads: 2 }]);
    const day = snap.ads.days.find((d) => d.date === "2026-09-28")!;
    expect(day).toMatchObject({ campaign: "sv_prospecting_ro", spend: 20, leads: 2 });
    expect(snap.test_data).toBe(false);
  });

  it("fixtures are flagged test_data", () => {
    const app = seeded();
    expect(buildSnapshot(app.db, { metaMode: "fixtures", now: NOW }).test_data).toBe(true);
  });

  it("push is signed with the cabinet key and leaves a 600 copy", async () => {
    const app = seeded();
    const snap = buildSnapshot(app.db, { metaMode: "fixtures", now: NOW });
    const seen: { url: string; headers: Record<string, string>; body: string }[] = [];
    const out = await pushSnapshot(snap, {
      siteUrl: "https://site.test",
      secret: CAB,
      dataDir: app.config.dataDir,
      fetchFn: async (url, init) => {
        seen.push({ url, headers: init!.headers as Record<string, string>, body: String(init!.body) });
        return new Response("{}", { status: 200 });
      },
    });
    expect(out).toBe("sent");
    expect(seen[0].url).toBe("https://site.test/api/cabinet/ingest");
    const h = seen[0].headers;
    expect(verify(CAB, h["X-Shur-Timestamp"], h["X-Shur-Signature"], Buffer.from(seen[0].body)).ok).toBe(true);
    const file = join(app.config.dataDir, SNAPSHOT_FILE);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(file, "utf8")).test_data).toBe(true);
  });

  it("no cabinet key → nothing is sent", async () => {
    const app = seeded();
    let called = false;
    const out = await pushSnapshot(buildSnapshot(app.db, { metaMode: "live", now: NOW }), {
      siteUrl: "https://site.test",
      secret: undefined,
      dataDir: app.config.dataDir,
      fetchFn: async () => {
        called = true;
        return new Response("{}");
      },
    });
    expect(out).toBe("skipped");
    expect(called).toBe(false);
  });
});
