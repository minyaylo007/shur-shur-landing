import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The owner's stats cabinet (/cabinet) — the RIGHTS side only (owner's rule
 * 13.10.2026: new tests only for lead, rights, deploy):
 *  - no session cookie → the page and its data stay closed;
 *  - ingest and setup-link refuse anything not signed with CABINET_HMAC_SECRET (401);
 *  - a snapshot carrying a field with personal data, or a contact-looking
 *    string, is refused whole and never stored;
 *  - the setup link works once: the second use, a stale or a foreign token fail.
 */

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`);
});
const cookieJar = new Map<string, string>();
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined) }),
}));

const { useMemoryStore, SNAPSHOT_KEY, AUTH_KEY } = await import("../src/lib/cabinet/store");
const auth = await import("../src/lib/cabinet/auth");
const { signLedgerBody } = await import("../src/lib/ledger");
const { POST: INGEST } = await import("../src/app/api/cabinet/ingest/route");
const { POST: SETUP_LINK } = await import("../src/app/api/cabinet/setup-link/route");
const { POST: SETUP } = await import("../src/app/api/cabinet/setup/route");
const { POST: LOGIN } = await import("../src/app/api/cabinet/login/route");
const { default: CabinetPage } = await import("../src/app/cabinet/page");

const SECRET = "cabinet-test-secret";
let store: ReturnType<typeof useMemoryStore>;
let ip = 0;

function signed(path: string, payload: unknown, secret = SECRET): Request {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  return new Request(`https://shur-shur.com${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shur-timestamp": ts,
      "x-shur-signature": signLedgerBody(secret, ts, body),
    },
    body,
  });
}

function form(path: string, fields: Record<string, string>): Request {
  ip += 1;
  return new Request(`https://shur-shur.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": `10.77.0.${ip}` },
    body: new URLSearchParams(fields).toString(),
  });
}

const snapshot = (over: Record<string, unknown> = {}) => ({
  version: 1,
  generated_at: "2026-10-25T07:30:00Z",
  test_data: false,
  currency: "EUR",
  ads: {
    connected: true,
    days: [{ date: "2026-10-24", campaign: "Suceava · Reels", spend: 12.5, impressions: 3000, clicks: 40, ctr: 0.0133, cpc: 0.31, leads: 2 }],
  },
  site: { days: [{ date: "2026-10-24", visits: null, form_reached: null, leads: 3 }] },
  insights: { date: "2026-10-25", markdown: "Всё ровно." },
  ...over,
});

async function issueLink(token: string, expiresAt = Date.now() + 3600_000) {
  const res = await SETUP_LINK(signed("/api/cabinet/setup-link", { token_hash: auth.hashSetupToken(token), expires_at: expiresAt }));
  expect(res.status).toBe(200);
}

beforeEach(() => {
  process.env.CABINET_HMAC_SECRET = SECRET;
  store = useMemoryStore();
  cookieJar.clear();
  redirectMock.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CABINET_HMAC_SECRET;
});

describe("cabinet: closed without a session", () => {
  it("no cookie → redirect to login, no data rendered", async () => {
    store.set(SNAPSHOT_KEY, { text: JSON.stringify(snapshot()), etag: "x" });
    await expect(CabinetPage()).rejects.toThrow("REDIRECT /cabinet/login");
  });

  it("a forged or stale cookie → redirect to login", async () => {
    const token = "t".repeat(43);
    await issueLink(token);
    const res = await SETUP(form("/api/cabinet/setup", { t: token, password: "long-enough-pass", repeat: "long-enough-pass" }));
    expect(res.status).toBe(303);
    const real = res.headers.get("set-cookie")!;
    const value = /shur_cabinet=([^;]+)/.exec(real)![1];

    cookieJar.set(auth.SESSION_COOKIE, `${value.split(".")[0]}.forged`);
    await expect(CabinetPage()).rejects.toThrow("REDIRECT /cabinet/login");

    const { state } = await auth.readAuth();
    const old = auth.makeSession(state.sessionKey!, Date.now() - (auth.SESSION_TTL_SECONDS + 10) * 1000);
    cookieJar.set(auth.SESSION_COOKIE, old);
    await expect(CabinetPage()).rejects.toThrow("REDIRECT /cabinet/login");

    cookieJar.set(auth.SESSION_COOKIE, value);
    await expect(CabinetPage()).resolves.toBeTruthy();
  });

  it("session cookie is httpOnly, Secure, SameSite=Strict", async () => {
    const token = "u".repeat(43);
    await issueLink(token);
    const res = await SETUP(form("/api/cabinet/setup", { t: token, password: "long-enough-pass", repeat: "long-enough-pass" }));
    const cookie = res.headers.get("set-cookie")!.toLowerCase();
    expect(cookie).toContain("httponly");
    expect(cookie).toContain("secure");
    expect(cookie).toContain("samesite=strict");
  });
});

describe("cabinet: signed intake only", () => {
  it("ingest without signature → 401, nothing stored", async () => {
    const res = await INGEST(
      new Request("https://shur-shur.com/api/cabinet/ingest", { method: "POST", body: JSON.stringify(snapshot()) }),
    );
    expect(res.status).toBe(401);
    expect(store.has(SNAPSHOT_KEY)).toBe(false);
  });

  it("ingest signed with another secret (e.g. the lead ledger's) → 401", async () => {
    const res = await INGEST(signed("/api/cabinet/ingest", snapshot(), "ledger-secret"));
    expect(res.status).toBe(401);
    expect(store.has(SNAPSHOT_KEY)).toBe(false);
  });

  it("ingest with no CABINET_HMAC_SECRET configured → 503, never open", async () => {
    delete process.env.CABINET_HMAC_SECRET;
    const res = await INGEST(signed("/api/cabinet/ingest", snapshot()));
    expect(res.status).toBe(503);
    expect(store.has(SNAPSHOT_KEY)).toBe(false);
  });

  it("setup-link without signature → 401, no link registered", async () => {
    const res = await SETUP_LINK(
      new Request("https://shur-shur.com/api/cabinet/setup-link", {
        method: "POST",
        body: JSON.stringify({ token_hash: "a".repeat(64), expires_at: Date.now() + 1000 }),
      }),
    );
    expect(res.status).toBe(401);
    expect(store.has(AUTH_KEY)).toBe(false);
  });

  it("a valid signed snapshot is stored", async () => {
    const res = await INGEST(signed("/api/cabinet/ingest", snapshot()));
    expect(res.status).toBe(200);
    expect(JSON.parse(store.get(SNAPSHOT_KEY)!.text).ads.days).toHaveLength(1);
  });
});

describe("cabinet: no personal data in the snapshot", () => {
  const leaks: [string, Record<string, unknown>][] = [
    ["a name field on a site row", { site: { days: [{ date: "2026-10-24", visits: 1, form_reached: 1, leads: 1, name: "Olena" }] } }],
    ["a contact field at the top", { contact: "+380501112233" }],
    ["a leads list", { leads: [{ lead_id: "x" }] }],
    ["an e-mail in a campaign name", { ads: { connected: true, days: [{ ...snapshot().ads.days[0], campaign: "olena@example.com" }] } }],
    ["a phone in the conclusions", { insights: { date: "2026-10-25", markdown: "перезвонить +40 744 123 456" } }],
  ];
  it.each(leaks)("%s → 400, previous snapshot kept", async (_, over) => {
    store.set(SNAPSHOT_KEY, { text: "PREVIOUS", etag: "p" });
    const res = await INGEST(signed("/api/cabinet/ingest", snapshot(over)));
    expect(res.status).toBe(400);
    expect(store.get(SNAPSHOT_KEY)!.text).toBe("PREVIOUS");
  });

  it("the schema itself names no personal field", async () => {
    const { snapshotSchema, adsDaySchema, siteDaySchema } = await import("../src/lib/cabinet/snapshot");
    const keys = [
      ...Object.keys(snapshotSchema.shape),
      ...Object.keys(adsDaySchema.shape),
      ...Object.keys(siteDaySchema.shape),
    ].join(" ");
    expect(keys).not.toMatch(/\b(name|contact|phone|email|ig_handle|lead_id|message|ip)\b/i);
  });
});

describe("cabinet: the setup link is single-use", () => {
  const PASS = "correct horse battery";

  it("works once; the second use is refused and the password stays", async () => {
    const token = randomBytes(32).toString("base64url");
    await issueLink(token);

    const first = await SETUP(form("/api/cabinet/setup", { t: token, password: PASS, repeat: PASS }));
    expect(first.headers.get("location")).toMatch(/\/cabinet$/);
    expect(first.headers.get("set-cookie")).toMatch(/shur_cabinet=/);

    const second = await SETUP(form("/api/cabinet/setup", { t: token, password: "attacker-password", repeat: "attacker-password" }));
    expect(second.headers.get("location")).toContain("e=bad_link");
    expect(second.headers.get("set-cookie")).toBeNull();
    expect(await auth.setupLinkValid(token)).toBe(false);

    expect((await LOGIN(form("/api/cabinet/login", { password: "attacker-password" }))).headers.get("location")).toContain("e=bad");
    expect((await LOGIN(form("/api/cabinet/login", { password: PASS }))).headers.get("location")).toMatch(/\/cabinet$/);
  });

  it("two racing uses of one link: exactly one wins", async () => {
    const token = randomBytes(32).toString("base64url");
    await issueLink(token);
    const results = await Promise.all([
      SETUP(form("/api/cabinet/setup", { t: token, password: "first-password-1", repeat: "first-password-1" })),
      SETUP(form("/api/cabinet/setup", { t: token, password: "second-password-2", repeat: "second-password-2" })),
    ]);
    expect(results.filter((r) => r.headers.get("set-cookie")?.includes("shur_cabinet=")).length).toBe(1);
  });

  it("an expired link or a wrong token is refused", async () => {
    const token = randomBytes(32).toString("base64url");
    await issueLink(token, Date.now() - 1000);
    const stale = await SETUP(form("/api/cabinet/setup", { t: token, password: PASS, repeat: PASS }));
    expect(stale.headers.get("location")).toContain("e=bad_link");

    await issueLink(token);
    const wrong = await SETUP(form("/api/cabinet/setup", { t: token + "x", password: PASS, repeat: PASS }));
    expect(wrong.headers.get("location")).toContain("e=bad_link");
  });

  it("the store holds only a hash: no password, no token", async () => {
    const token = randomBytes(32).toString("base64url");
    await issueLink(token);
    await SETUP(form("/api/cabinet/setup", { t: token, password: PASS, repeat: PASS }));
    const text = store.get(AUTH_KEY)!.text;
    expect(text).not.toContain(PASS);
    expect(text).not.toContain(token);
  });

  it("a weak password keeps the link usable", async () => {
    const token = randomBytes(32).toString("base64url");
    await issueLink(token);
    const weak = await SETUP(form("/api/cabinet/setup", { t: token, password: "short", repeat: "short" }));
    expect(weak.headers.get("location")).toContain("e=weak_password");
    expect(await auth.setupLinkValid(token)).toBe(true);
  });
});

describe("cabinet: login attempts are limited", () => {
  it("a 6th try from one IP within 10 min is refused before the password is checked", async () => {
    const token = randomBytes(32).toString("base64url");
    await issueLink(token);
    await SETUP(form("/api/cabinet/setup", { t: token, password: "correct-password", repeat: "correct-password" }));
    const fixed = (pw: string) =>
      new Request("https://shur-shur.com/api/cabinet/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": "10.99.9.9" },
        body: new URLSearchParams({ password: pw }).toString(),
      });
    for (let i = 0; i < 5; i++) await LOGIN(fixed("wrong-password"));
    const sixth = await LOGIN(fixed("correct-password"));
    expect(sixth.headers.get("location")).toContain("e=limit");
    expect(sixth.headers.get("set-cookie")).toBeNull();
  });

  it("the global count stops checking after the limit, across IPs", async () => {
    const token = randomBytes(32).toString("base64url");
    await issueLink(token);
    await SETUP(form("/api/cabinet/setup", { t: token, password: "correct-password", repeat: "correct-password" }));
    const { state } = await auth.readAuth();
    state.failures = { since: Date.now(), count: auth.GLOBAL_FAILURE_LIMIT };
    store.set(AUTH_KEY, { text: JSON.stringify(state), etag: "z" });
    const res = await LOGIN(form("/api/cabinet/login", { password: "correct-password" }));
    expect(res.headers.get("location")).toContain("e=limit");
  });
});
