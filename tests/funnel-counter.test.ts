import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/funnel/route";
import { verifyLedgerSignature } from "../src/lib/ledger";

/*
 * Site funnel counter (B3.2, 04.11.2026), site side. It runs without cookie
 * consent, so the law part is the point: the ledger gets the event, locale,
 * market and (for a click) channel + placement — never an IP, a user agent,
 * a query, an id or any field the schema does not name. And a dead ledger
 * never shows: the route answers 204. The aggregation itself is in
 * ads-engine/test/funnel-counter.test.ts.
 */

const LEDGER = "https://ledger.test.invalid";
const SECRET = "test-secret";

let ip = 0;
function beacon(body: unknown): Request {
  ip += 1;
  return new Request("https://shur-shur.com/api/funnel", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      "x-forwarded-for": `10.12.0.${ip}`,
      "user-agent": "Mozilla/5.0 (Test) Secret/1.0",
      cookie: "_fbp=fb.1.123.456",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

let calls: { url: string; init: RequestInit }[] = [];
function installFetch(answer: number | "throw") {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      calls.push({ url: String(input), init });
      if (answer === "throw") throw new TypeError("fetch failed");
      return new Response("{}", { status: answer });
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("LEDGER_URL", LEDGER);
  vi.stubEnv("LEDGER_HMAC_SECRET", SECRET);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/api/funnel → ledger: no personal data", () => {
  it("forwards a click as event/locale/market/channel/placement only, signed, on /v1/leads", async () => {
    installFetch(200);
    const res = await POST(
      beacon({ event: "contact_click", locale: "ro", path: "/ro/suceava", channel: "whatsapp", placement: "hero" }),
    );
    expect(res.status).toBe(204);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${LEDGER}/v1/leads`);
    const raw = String(calls[0].init.body);
    expect(JSON.parse(raw)).toEqual({
      funnel: { event: "contact_click", locale: "ro", market: "suceava", channel: "whatsapp", placement: "hero" },
    });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(verifyLedgerSignature(SECRET, headers["X-Shur-Timestamp"], headers["X-Shur-Signature"], raw)).toBe(true);
    // Nothing from the request's identity rides along — not in the body, not in a header.
    const sent = raw + JSON.stringify(headers);
    for (const leak of ["10.12.0.", "Mozilla", "Secret/1.0", "_fbp", "fb.1.", "/ro/suceava"]) {
      expect(sent).not.toContain(leak);
    }
  });

  it("refuses, and forwards nothing for, extra fields, a query in the path and unknown events", async () => {
    installFetch(200);
    const refused = [
      { event: "visit", locale: "uk", path: "/uk", ip: "1.2.3.4" },
      { event: "visit", locale: "uk", path: "/uk", ua: "Mozilla/5.0" },
      { event: "visit", locale: "uk", path: "/uk", visitor_id: "abc" },
      { event: "visit", locale: "uk", path: "/uk?utm_source=fb&fbclid=XYZ" },
      { event: "visit", locale: "uk", path: "/uk#contact" },
      { event: "visit", locale: "uk", path: "https://evil.example/uk" },
      { event: "visit", locale: "uk", path: "/uk", channel: "whatsapp" },
      { event: "contact_click", locale: "uk", path: "/uk", channel: "whatsapp" },
      { event: "lead", locale: "uk", path: "/uk", name: "Olena", contact: "+380501112233" },
      { event: "visit", locale: "xx", path: "/uk" },
    ];
    for (const body of refused) expect((await POST(beacon(body))).status, JSON.stringify(body)).toBe(400);
    expect((await POST(beacon("not json"))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

describe("/api/funnel never breaks the page", () => {
  it.each([500, "throw"] as const)("ledger answers %s → still 204", async (answer) => {
    installFetch(answer);
    const res = await POST(beacon({ event: "visit", locale: "uk", path: "/uk" }));
    expect(res.status).toBe(204);
    expect(calls).toHaveLength(1);
  });

  it("no ledger configured → 204, nothing sent", async () => {
    installFetch(200);
    vi.stubEnv("LEDGER_URL", "");
    const res = await POST(beacon({ event: "form_reached", locale: "he", path: "/he/tel-aviv" }));
    expect(res.status).toBe(204);
    expect(calls).toHaveLength(0);
  });
});
