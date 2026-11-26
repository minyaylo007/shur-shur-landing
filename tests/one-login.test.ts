import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The one login (/login, owner 26.11.2026) — RIGHTS only:
 *  - «admin» + the cabinet password → /cabinet with the cabinet session, and
 *    nothing of a client;
 *  - a client's login → that client's own cabinet, never another's, never /cabinet;
 *  - a wrong password or an unknown login → refused, no cookie;
 *  - a client can never take the login «admin»;
 *  - the cabinet password set from ace-main: only a signed call, old sessions end;
 *  - neither password nor login reaches a log line.
 */

const { useMemoryStore } = await import("../src/lib/cabinet/store");
const auth = await import("../src/lib/cabinet/auth");
const clients = await import("../src/lib/client/clients");
const { signLedgerBody } = await import("../src/lib/ledger");
const { POST: LOGIN } = await import("../src/app/api/login/route");
const { POST: SET_PASSWORD } = await import("../src/app/api/cabinet/password/route");

const HMAC = "cabinet-test-secret";
let ip = 0;
let logged: string[];

function form(fields: Record<string, string>): Request {
  ip += 1;
  return new Request("https://shur-shur.com/api/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": `10.88.0.${ip}` },
    body: new URLSearchParams(fields).toString(),
  });
}

function signed(payload: unknown, secret = HMAC): Request {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  return new Request("https://shur-shur.com/api/cabinet/password", {
    method: "POST",
    headers: { "content-type": "application/json", "x-shur-timestamp": ts, "x-shur-signature": signLedgerBody(secret, ts, body) },
    body,
  });
}

const cookie = (res: Response, name: string) => new RegExp(`${name}=([^;]+)`).exec(res.headers.get("set-cookie") ?? "")?.[1];

async function client(name: string, login: string) {
  const { client } = await clients.createClient(name, false);
  expect(await clients.setLoginPassword(client.id, login, "12345")).toEqual({ ok: true });
  return client.id;
}

beforeEach(() => {
  useMemoryStore();
  process.env.CABINET_HMAC_SECRET = HMAC;
  logged = [];
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    });
  }
});

afterEach(() => vi.restoreAllMocks());

describe("one login", () => {
  it("admin opens the cabinet, a client its own cabinet, a wrong one nothing", async () => {
    expect((await SET_PASSWORD(signed({ password: "12345" }, "forged-secret"))).status).toBe(401);
    expect((await SET_PASSWORD(signed({ password: "1234" }))).status).toBe(400);
    expect((await SET_PASSWORD(signed({ password: "12345" }))).status).toBe(200);
    const marina = await client("Марина", "marina");
    const other = await client("Інший", "other");

    for (const login of ["admin", "Admin", " ADMIN "]) {
      const res = await LOGIN(form({ login, password: "12345" }));
      expect(res.headers.get("location")).toMatch(/\/cabinet$/);
      expect(await auth.isSignedIn(cookie(res, auth.SESSION_COOKIE))).toBe(true);
      expect(cookie(res, clients.CLIENT_COOKIE)).toBeUndefined();
    }

    const res = await LOGIN(form({ login: "Marina", password: "12345" }));
    expect(res.headers.get("location")).toMatch(new RegExp(`/client/${marina}$`));
    const session = cookie(res, clients.CLIENT_COOKIE);
    expect(await clients.signedInClient(session, marina)).not.toBeNull();
    expect(await clients.signedInClient(session, other)).toBeNull();
    expect(await auth.isSignedIn(session)).toBe(false);
    expect(cookie(res, auth.SESSION_COOKIE)).toBeUndefined();

    for (const fields of [{ login: "admin", password: "12346" }, { login: "marina", password: "123456" }, { login: "nobody", password: "12345" }, { login: "admin", password: "" }]) {
      const refused = await LOGIN(form(fields));
      expect(refused.headers.get("location")).toMatch(/\/login\?e=bad$/);
      expect(refused.headers.get("set-cookie")).toBeNull();
    }
    expect(logged.join("\n")).not.toMatch(/1234|marina|admin|nobody/i);
  });

  it("a client can never be «admin»; a new cabinet password ends the old sessions", async () => {
    const { client: c } = await clients.createClient("Хитрий", false);
    expect(await clients.setLoginPassword(c.id, "Admin", "12345")).toEqual({ ok: false, error: "bad_login" });
    expect(await clients.findClientByLogin("admin")).toBeNull();

    await SET_PASSWORD(signed({ password: "12345" }));
    const before = cookie(await LOGIN(form({ login: "admin", password: "12345" })), auth.SESSION_COOKIE);
    expect(await auth.isSignedIn(before)).toBe(true);
    await SET_PASSWORD(signed({ password: "54321" }));
    expect(await auth.isSignedIn(before)).toBe(false);
    expect((await LOGIN(form({ login: "admin", password: "12345" }))).headers.get("location")).toMatch(/e=bad$/);
  });
});
