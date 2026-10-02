import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/lead/route";
import { POST as REDELIVER } from "../src/app/api/lead/redeliver/route";
import { signLedgerBody, verifyLedgerSignature } from "../src/lib/ledger";

/*
 * Contract v1.1 (03.10.2026), site side: the lead is not lost when Telegram
 * is down. The ledger takes it FIRST (`delivery: "pending"`), Telegram second;
 * Telegram ok → the site marks it delivered; Telegram down but the ledger has
 * it → the visitor still gets 200 and the ledger re-sends it later through
 * /api/lead/redeliver. Both down → 502, as before. No ledger configured →
 * exactly the v1 behaviour. The ledger's half (retry once, no duplicates)
 * is in ads-engine/test/delivery.test.ts.
 */

const LEDGER = "https://ledger.test.invalid";
const SECRET = "test-secret";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CONTACT = "+380501112233";

let ip = 0;
function leadRequest(): Request {
  ip += 1;
  return new Request("https://shur-shur.com/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `10.11.0.${ip}` },
    body: JSON.stringify({
      kind: "lead",
      name: "Olena Test",
      contact: CONTACT,
      message: "",
      elapsedMs: 5000,
      locale: "uk",
      consent: { ads: false },
    }),
  });
}

interface Call {
  url: string;
  init: RequestInit;
}

type Answer = number | "throw";

/** Each endpoint answers by script; every call is recorded in order. */
function installFetch(script: { telegram?: Answer; lead?: Answer; mark?: Answer[] }) {
  const calls: Call[] = [];
  const marks = [...(script.mark ?? [200])];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = String(input);
      calls.push({ url, init });
      let answer: Answer;
      if (url.startsWith("https://api.telegram.org/")) answer = script.telegram ?? 200;
      else if (url.endsWith("/delivered")) answer = marks.length > 1 ? marks.shift()! : marks[0];
      else answer = script.lead ?? 200;
      if (answer === "throw") throw new TypeError("fetch failed");
      const body = url.startsWith("https://api.telegram.org/") ? { ok: answer === 200 } : { ok: true };
      return new Response(JSON.stringify(body), { status: answer });
    }),
  );
  return calls;
}

const kindOf = (c: Call) =>
  c.url.startsWith("https://api.telegram.org/") ? "telegram" : c.url.endsWith("/delivered") ? "mark" : "ledger";

let logged: string[] = [];

beforeEach(() => {
  logged = [];
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    });
  }
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:test-token");
  vi.stubEnv("TELEGRAM_CHAT_ID", "-100200");
  vi.stubEnv("LEDGER_URL", LEDGER);
  vi.stubEnv("LEDGER_HMAC_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function submit() {
  const response = await POST(leadRequest());
  return { response, body: (await response.json()) as { ok: boolean; lead_id?: string; error?: string } };
}

describe("submit: the ledger first, Telegram second, then the mark", () => {
  it("all up: ledger (pending) → Telegram → signed «delivered» mark for the same lead_id", async () => {
    const calls = installFetch({});
    const { response, body } = await submit();

    expect(response.status).toBe(200);
    expect(body.lead_id).toMatch(UUID_V4);
    expect(calls.map(kindOf)).toEqual(["ledger", "telegram", "mark"]);

    const lead = JSON.parse(calls[0].init.body as string);
    expect(lead.delivery).toBe("pending");
    expect(lead.lead_id).toBe(body.lead_id);

    const mark = calls[2];
    expect(mark.url).toBe(`${LEDGER}/v1/leads/${body.lead_id}/delivered`);
    const headers = mark.init.headers as Record<string, string>;
    const raw = mark.init.body as string;
    expect(JSON.parse(raw)).toEqual({ lead_id: body.lead_id });
    const expected = createHmac("sha256", SECRET).update(`${headers["X-Shur-Timestamp"]}.${raw}`).digest("hex");
    expect(headers["X-Shur-Signature"]).toBe(`sha256=${expected}`);
  });

  it("Telegram down, ledger took it → 200 + lead_id, NO mark (the ledger will re-send)", async () => {
    const calls = installFetch({ telegram: 500 });
    const { response, body } = await submit();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true });
    expect(body.lead_id).toMatch(UUID_V4);
    expect(calls.map(kindOf)).toEqual(["ledger", "telegram"]);
    expect(logged.join("\n")).toContain(`redelivery pending (lead_id=${body.lead_id})`);
  });

  it("Telegram throws (network), ledger took it → 200", async () => {
    installFetch({ telegram: "throw" });
    expect((await submit()).response.status).toBe(200);
  });

  it("Telegram NOT CONFIGURED, ledger took it → 200, the log still names the missing variables", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const calls = installFetch({});
    const { response } = await submit();
    expect(response.status).toBe(200);
    expect(calls.map(kindOf)).toEqual(["ledger"]);
    expect(logged.join("\n")).toContain("NOT CONFIGURED");
  });

  it("both down → 502 delivery_failed (no one holds the lead)", async () => {
    const calls = installFetch({ telegram: 500, lead: "throw" });
    const { response, body } = await submit();
    expect(response.status).toBe(502);
    expect(body.error).toBe("delivery_failed");
    expect(calls.map(kindOf)).toEqual(["ledger", "telegram"]);
  });

  it("ledger refuses (500), Telegram ok → 200 and no mark for a lead the ledger does not have", async () => {
    const calls = installFetch({ lead: 500 });
    expect((await submit()).response.status).toBe(200);
    expect(calls.map(kindOf)).toEqual(["ledger", "telegram"]);
  });

  it("ledger NOT configured → v1 behaviour: Telegram ok 200, Telegram down 502, no ledger traffic", async () => {
    vi.stubEnv("LEDGER_URL", "");
    let calls = installFetch({});
    expect((await submit()).response.status).toBe(200);
    expect(calls.map(kindOf)).toEqual(["telegram"]);

    calls = installFetch({ telegram: 500 });
    expect((await submit()).response.status).toBe(502);
    expect(calls.map(kindOf)).toEqual(["telegram"]);
  });

  it("a failed mark is tried once more; failing twice still answers 200", async () => {
    let calls = installFetch({ mark: [500, 200] });
    expect((await submit()).response.status).toBe(200);
    expect(calls.map(kindOf)).toEqual(["ledger", "telegram", "mark", "mark"]);

    calls = installFetch({ mark: ["throw"] });
    expect((await submit()).response.status).toBe(200);
    expect(calls.map(kindOf)).toEqual(["ledger", "telegram", "mark", "mark"]);
  });

  it("no personal data in a URL or a log line on the Telegram-down path", async () => {
    const calls = installFetch({ telegram: 500 });
    await submit();
    for (const text of [...calls.map((c) => c.url), ...logged]) expect(text).not.toContain(CONTACT);
  });
});

describe("/api/lead/redeliver — the ledger's retry lands in the same chat", () => {
  const LEAD_ID = "0b6f7c1e-3a2d-4c5b-9e8f-1a2b3c4d5e6f";
  const lead = {
    lead_id: LEAD_ID,
    kind: "lead",
    locale: "ro",
    market: "suceava",
    name: "Ioana Test",
    contact: CONTACT,
    message: null,
    ig_handle: null,
    attribution: { utm_source: "facebook", utm_campaign: "sv_launch" },
  };

  function redeliverRequest(body: unknown, opts: { ts?: number; secret?: string; signature?: string } = {}) {
    const raw = JSON.stringify(body);
    const ts = String(opts.ts ?? Math.floor(Date.now() / 1000));
    return new Request("https://shur-shur.com/api/lead/redeliver", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-shur-timestamp": ts,
        "x-shur-signature": opts.signature ?? signLedgerBody(opts.secret ?? SECRET, ts, raw),
      },
      body: raw,
    });
  }

  it("signed lead → exactly one Telegram message, marked as a redelivery, 200", async () => {
    const calls = installFetch({});
    const response = await REDELIVER(redeliverRequest(lead));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, lead_id: LEAD_ID });

    expect(calls.map(kindOf)).toEqual(["telegram"]);
    const text = JSON.parse(calls[0].init.body as string).text as string;
    expect(text).toContain(CONTACT);
    expect(text).toContain("Доставлено повторно");
    expect(text).toContain("ринок: suceava");
    for (const line of logged) expect(line).not.toContain(CONTACT);
  });

  it.each([
    ["unsigned", { signature: "" }],
    ["wrong secret", { secret: "other" }],
    ["stale timestamp (> 300 s)", { ts: Math.floor(Date.now() / 1000) - 301 }],
  ])("%s → 401, nothing sent", async (_label, opts) => {
    const calls = installFetch({});
    const response = await REDELIVER(redeliverRequest(lead, opts));
    expect(response.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("Telegram still down → 502, so the ledger keeps the lead and tries later", async () => {
    installFetch({ telegram: 500 });
    expect((await REDELIVER(redeliverRequest(lead))).status).toBe(502);
  });

  it("garbage body → 400; no secret on the site → 503", async () => {
    installFetch({});
    expect((await REDELIVER(redeliverRequest({ lead_id: "nope" }))).status).toBe(400);
    vi.stubEnv("LEDGER_HMAC_SECRET", "");
    expect((await REDELIVER(redeliverRequest(lead))).status).toBe(503);
  });

  it("verifyLedgerSignature matches the ledger's scheme (fixed vector from openssl)", () => {
    const sig = "sha256=a7ab3ccbbbf6306ff2aab66592c76d7ca5f6e30f6d05d2ca864bbfcca493839a";
    expect(verifyLedgerSignature("test-secret", "1759140000", sig, '{"lead_id":"x"}', 1759140000)).toBe(true);
    expect(verifyLedgerSignature("test-secret", "1759140000", sig, '{"lead_id":"y"}', 1759140000)).toBe(false);
    expect(verifyLedgerSignature("test-secret", "1759140000", sig, '{"lead_id":"x"}', 1759140301)).toBe(false);
  });
});
