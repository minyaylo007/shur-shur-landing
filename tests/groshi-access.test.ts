import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * «Гроші» in the cabinet (/cabinet/groshi) — RIGHTS only (owner's rule
 * 13.10.2026): without Sasha's session neither the page nor its API shows or
 * changes anything; the seed endpoint takes only a signed body; the bank is
 * not asked without its key.
 */

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`);
});
const cookieJar = new Map<string, string>();
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined) }),
}));

const { useMemoryStore, AUTH_KEY } = await import("../src/lib/cabinet/store");
const auth = await import("../src/lib/cabinet/auth");
const { signLedgerBody } = await import("../src/lib/ledger");
const { BOOK_KEY } = await import("../src/lib/money/store");
const { POST: GROSHI } = await import("../src/app/api/cabinet/groshi/route");
const { POST: SEED } = await import("../src/app/api/cabinet/groshi-seed/route");
const { default: CabinetMoney } = await import("../src/app/cabinet/groshi/page");

const SECRET = "groshi-test-secret";
const SESSION_KEY = randomBytes(32).toString("hex");
const BOOK = { version: 1, projects: [{ id: "p1", name: "Таємний проект", amount: 10_000_00, currency: "UAH" }], plan: [], rules: {}, payers: {}, entries: [] };
let store: ReturnType<typeof useMemoryStore>;

function api(body: unknown, cookie?: string): Request {
  return new Request("https://shur-shur.com/api/cabinet/groshi", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

function signedSeed(payload: unknown, secret = SECRET): Request {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  return new Request("https://shur-shur.com/api/cabinet/groshi-seed", {
    method: "POST",
    headers: { "content-type": "application/json", "x-shur-timestamp": ts, "x-shur-signature": signLedgerBody(secret, ts, body) },
    body,
  });
}

const addCash = { type: "entry.add", entry: { date: "2026-11-20", amount: 5_000_00, currency: "UAH", projects: ["p1"], cash: true } };

beforeEach(() => {
  process.env.CABINET_HMAC_SECRET = SECRET;
  delete process.env.MONO_PERSONAL_TOKEN;
  store = useMemoryStore();
  store.set(AUTH_KEY, { text: JSON.stringify({ password: { salt: "", hash: "" }, sessionKey: SESSION_KEY, setup: null, failures: { since: 0, count: 0 } }), etag: "a" });
  store.set(BOOK_KEY, { text: JSON.stringify(BOOK), etag: "b" });
  cookieJar.clear();
  redirectMock.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.CABINET_HMAC_SECRET;
});

describe("/cabinet/groshi: closed without a session", () => {
  it("no cookie, a forged one or a stale one → the login page, nothing rendered", async () => {
    await expect(CabinetMoney()).rejects.toThrow("REDIRECT /cabinet/login");
    cookieJar.set(auth.SESSION_COOKIE, `${Math.floor(Date.now() / 1000) + 999}.forged`);
    await expect(CabinetMoney()).rejects.toThrow("REDIRECT /cabinet/login");
    cookieJar.set(auth.SESSION_COOKIE, auth.makeSession(SESSION_KEY, Date.now() - (auth.SESSION_TTL_SECONDS + 10) * 1000));
    await expect(CabinetMoney()).rejects.toThrow("REDIRECT /cabinet/login");
  });

  it("with her session the page renders (and asks no bank without a key)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    cookieJar.set(auth.SESSION_COOKIE, auth.makeSession(SESSION_KEY));
    await expect(CabinetMoney()).resolves.toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("/api/cabinet/groshi: closed without a session", () => {
  it("no cookie or a forged one → 401, the book is not touched and not shown", async () => {
    for (const cookie of [undefined, `${auth.SESSION_COOKIE}=${Math.floor(Date.now() / 1000) + 999}.forged`]) {
      const res = await GROSHI(api(addCash, cookie));
      expect(res.status).toBe(401);
      expect(await res.text()).not.toContain("Таємний");
    }
    expect(JSON.parse(store.get(BOOK_KEY)!.text)).toEqual(BOOK);
  });

  it("with her session the action is saved; a form post (no JSON) is refused", async () => {
    const cookie = `${auth.SESSION_COOKIE}=${auth.makeSession(SESSION_KEY)}`;
    const ok = await GROSHI(api(addCash, cookie));
    expect(ok.status).toBe(200);
    expect(JSON.parse(store.get(BOOK_KEY)!.text).entries).toHaveLength(1);

    const asForm = new Request("https://shur-shur.com/api/cabinet/groshi", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie },
      body: "type=entry.remove&id=x",
    });
    expect((await GROSHI(asForm)).status).toBe(400);
  });

  it("an unknown project id is refused, not stored", async () => {
    const cookie = `${auth.SESSION_COOKIE}=${auth.makeSession(SESSION_KEY)}`;
    const res = await GROSHI(api({ ...addCash, entry: { ...addCash.entry, projects: ["nope"] } }, cookie));
    expect(res.status).toBe(400);
    expect(JSON.parse(store.get(BOOK_KEY)!.text).entries).toHaveLength(0);
  });
});

describe("/api/cabinet/groshi-seed: signed only", () => {
  const seed = { projects: [{ name: "Новий", amount: 1_000_00, currency: "USD" }, { name: "таємний проект", amount: 12_000_00, currency: "UAH" }] };

  it("unsigned or signed with another key → 401, nothing stored", async () => {
    const plain = new Request("https://shur-shur.com/api/cabinet/groshi-seed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(seed) });
    expect((await SEED(plain)).status).toBe(401);
    expect((await SEED(signedSeed(seed, "another-secret"))).status).toBe(401);
    expect(JSON.parse(store.get(BOOK_KEY)!.text)).toEqual(BOOK);
  });

  it("signed → projects upserted by name, the answer carries counts only", async () => {
    const res = await SEED(signedSeed(seed));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: true, added: 1, updated: 1, total: 2 });
    expect(text).not.toContain("Новий");
    const book = JSON.parse(store.get(BOOK_KEY)!.text);
    expect(book.projects.find((p: { id: string }) => p.id === "p1").amount).toBe(12_000_00);
  });
});
