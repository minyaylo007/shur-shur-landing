import { createSign, generateKeyPairSync } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Client cabinets (/client/<id>) and the monobank subscription — MONEY and
 * RIGHTS only (owner's rule 13.10.2026):
 *  - a webhook counts only with monobank's signature; a forged or unsigned
 *    one changes nothing; a rotated key is picked up;
 *  - the same webhook twice is applied once;
 *  - results are closed without a paid subscription and after the grace days;
 *  - one client can neither read nor write another client's cabinet;
 *  - a bot writes only into its own client's cabinet, with that client's key;
 *    a name, a username or a telegram id is refused, not stored;
 *  - the bot's rows (personal data) reach no log line and no URL;
 *  - without a token nothing is created at monobank; a test client can never
 *    spend through the live token.
 * monobank itself is mocked: no request leaves the machine.
 */

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`);
});
const cookieJar = new Map<string, string>();
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined) }),
}));

const { useMemoryStore } = await import("../src/lib/cabinet/store");
const { signLedgerBody } = await import("../src/lib/ledger");
const clients = await import("../src/lib/client/clients");
const { resultsKey, readResults, saveResults } = await import("../src/lib/client/results");
const { attemptsKey, readAttempts } = await import("../src/lib/client/attempts");
const mono = await import("../src/lib/billing/mono");
const { POST: WEBHOOK } = await import("../src/app/api/billing/mono/route");
const { POST: UPLOAD } = await import("../src/app/api/client/upload/route");
const { POST: INGEST } = await import("../src/app/api/client/ingest/route");
const { POST: SUBSCRIBE } = await import("../src/app/api/client/subscribe/route");
const { POST: CANCEL } = await import("../src/app/api/client/cancel/route");
const { POST: LOGIN } = await import("../src/app/api/client/login/route");
const { POST: CLIENT_KEY } = await import("../src/app/api/cabinet/client-key/route");
const { default: ClientPage } = await import("../src/app/client/[id]/page");

const HMAC = "cabinet-test-secret";
const PASSWORD = "correct horse battery";
const DAY = 24 * 60 * 60 * 1000;
/* What must never leak: a respondent's name, phone and e-mail. */
const PD = ["Петренко", "+380501112233", "olena@example.com"];
const CSV = `Дата,Ім'я,Телефон,Пошта\n2026-11-17 10:00,Олена Петренко,+380501112233,olena@example.com\n2026-11-18 09:30,Іван,+380670000000,ivan@example.org\n`;

const pair = () => generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pem = (key: ReturnType<typeof pair>) => key.publicKey.export({ type: "spki", format: "pem" }).toString();
const sign = (key: ReturnType<typeof pair>, body: string) => createSign("SHA256").update(body).sign(key.privateKey).toString("base64");

/* ---- the mocked monobank ---- */
let bankKey = pair();
let remote: { status: string; nextChargeDate?: string; payments: { status: string; chargedAt: string; amount: number; ccy: number }[] };
let calls: { method: string; path: string; token: string | null; body: Record<string, unknown> | null }[];

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  if (url.origin !== "https://api.monobank.ua") throw new Error(`unexpected request to ${url.origin}`);
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
  calls.push({ method: init?.method ?? "GET", path: url.pathname, token: new Headers(init?.headers).get("x-token"), body });
  const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
  switch (url.pathname) {
    case "/api/merchant/pubkey":
      return json({ key: Buffer.from(pem(bankKey)).toString("base64") });
    case "/api/merchant/subscription/create":
      return json({ subscriptionId: "s2_test", pageUrl: "https://pay.mbnk.biz/s2_test" });
    case "/api/merchant/subscription/status":
      return json({ subscriptionId: "s2_test", status: remote.status, amount: 1500, ccy: 978, interval: "1m", nextChargeDate: remote.nextChargeDate });
    case "/api/merchant/subscription/payments":
      return json({ payments: remote.payments, pagination: { totalItems: remote.payments.length, itemsPerPage: 50, currentPage: 1, totalPages: 1 } });
    case "/api/merchant/subscription/edit":
    case "/api/merchant/subscription/remove":
      return new Response("", { status: 200 });
    default:
      return new Response(JSON.stringify({ errCode: "404", errText: "not found" }), { status: 404 });
  }
});
const called = (path: string) => calls.filter((c) => c.path.endsWith(path));

/* ---- helpers ---- */
let store: ReturnType<typeof useMemoryStore>;
let ip = 0;
let logged: string[];

async function newClient(name: string, test = false) {
  const { client, token } = await clients.createClient(name, test);
  const done = await clients.completeClientSetup(client.id, token, PASSWORD, PASSWORD);
  if (!done.ok) throw new Error("setup failed");
  return { id: client.id, session: done.session, cookie: `${clients.CLIENT_COOKIE}=${done.session}` };
}

const record = async (id: string) => (await clients.readClient(id))!.client;

async function subscribed(id: string, paidDaysAgo: number | null, status: "active" | "cancelled" | "pending" = "active") {
  await clients.updateClient(id, (c) => {
    c.billing = {
      ...clients.EMPTY_BILLING,
      seen: [],
      subscriptionId: "s2_test",
      createdAt: Date.now() - 40 * DAY,
      status,
      lastPaidAt: paidDaysAgo === null ? null : Date.now() - paidDaysAgo * DAY,
      syncedAt: Date.now(),
    };
  });
}

function post(path: string, cookie?: string, fields: Record<string, string | File> = {}): Request {
  ip += 1;
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.set(name, value);
  return new Request(`https://shur-shur.com${path}`, {
    method: "POST",
    headers: { "x-forwarded-for": `10.88.${Math.floor(ip / 250)}.${ip % 250}`, ...(cookie ? { cookie } : {}) },
    body,
  });
}

function webhook(id: string, body: string, signature: string | null): Request {
  return new Request(`https://shur-shur.com/api/billing/mono?c=${id}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(signature ? { "x-sign": signature } : {}) },
    body,
  });
}

/** The key the owner's cabinet issues for the client's bot. */
async function botKey(id: string): Promise<string> {
  const issued = await clients.issueIngestKey(id);
  if (typeof issued === "string") throw new Error(issued);
  return issued.secret;
}

function ingest(id: string, secret: string, payload: unknown, ageSeconds = 0): Request {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000) - ageSeconds);
  return new Request("https://shur-shur.com/api/client/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", "x-shur-client": id, "x-shur-timestamp": ts, "x-shur-signature": signLedgerBody(secret, ts, body) },
    body,
  });
}

const attempt = (n: number, more: Record<string, unknown> = {}) => ({
  attempt_id: `a-${n}`,
  test: "Ваш бізнес готовий до зростання?",
  score: 5 + (n % 3),
  max_score: 12,
  range_label: n % 3 === 0 ? "5–8: є з чого почати" : "9–12: готові",
  finished_at: `2026-11-${17 + (n % 2)}T10:0${n % 10}:00+02:00`,
  answers: [
    { q: "Чи є у вас план продажів?", a: n % 2 ? "Так" : "Ні", points: n % 2 ? 2 : 0 },
    { q: "Хто веде фінанси?", a: "Я сам", points: 1 },
  ],
  participant: `p${String(n % 4).padStart(15, "0")}`,
  ...more,
});

/** The page as the browser holding `session` would get it: html, or the redirect target. */
async function page(id: string, session?: string): Promise<{ html: string; redirect: string | null }> {
  cookieJar.clear();
  if (session) cookieJar.set(clients.CLIENT_COOKIE, session);
  try {
    const element = await ClientPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });
    return { html: renderToStaticMarkup(element), redirect: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.startsWith("REDIRECT ")) throw error;
    return { html: "", redirect: message.slice(9) };
  }
}

const table = { columns: ["Дата", "Ім'я"], rows: [["2026-11-17", "Олена Петренко"]] };
const paidNow = () => [{ status: "success", chargedAt: new Date(Date.now() - 60_000).toISOString(), amount: 1500, ccy: 978 }];

beforeEach(() => {
  store = useMemoryStore();
  process.env.CABINET_HMAC_SECRET = HMAC;
  process.env.MONO_TOKEN = "live-token";
  process.env.MONO_TEST_TOKEN = "test-token";
  delete process.env.MONO_PRICE_UAH;
  bankKey = pair();
  remote = { status: "active", payments: [] };
  calls = [];
  logged = [];
  mono.forgetWebhookKeys();
  fetchMock.mockClear();
  redirectMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    });
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("webhook signature", () => {
  it("a webhook signed by monobank is applied: the state is read back from monobank", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, null, "pending");
    remote = { status: "active", nextChargeDate: new Date(Date.now() + 30 * DAY).toISOString(), payments: paidNow() };
    const body = JSON.stringify({ subscriptionId: "s2_test", status: "success" });

    const response = await WEBHOOK(webhook(a.id, body, sign(bankKey, body)));

    expect(response.status).toBe(200);
    const { billing } = await record(a.id);
    expect(billing.status).toBe("active");
    expect(billing.lastPaidAt).toBeGreaterThan(Date.now() - 5 * 60_000);
    expect(billing.seen).toHaveLength(1);
  });

  it("a webhook body cannot set the state by itself — only what monobank's API answers counts", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, null, "pending");
    // Signed correctly, claims success — but monobank knows of no payment.
    const body = JSON.stringify({ subscriptionId: "s2_test", status: "success", amount: 1500 });
    expect((await WEBHOOK(webhook(a.id, body, sign(bankKey, body)))).status).toBe(200);
    const fresh = await record(a.id);
    expect(fresh.billing.lastPaidAt).toBeNull();
    expect(mono.accessOf(fresh).open).toBe(false);
  });

  it("a forged, unsigned or altered webhook is refused with 401 and changes nothing", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, null, "pending");
    remote = { status: "active", payments: paidNow() };
    const before = store.get(clients.clientKey(a.id))!.text;
    const body = JSON.stringify({ subscriptionId: "s2_test", status: "success" });

    const forged = await WEBHOOK(webhook(a.id, body, sign(pair(), body)));
    const unsigned = await WEBHOOK(webhook(a.id, body, null));
    const altered = await WEBHOOK(webhook(a.id, body.replace("success", "SUCCESS"), sign(bankKey, body)));
    const garbage = await WEBHOOK(webhook(a.id, body, "not-a-signature"));

    expect([forged.status, unsigned.status, altered.status, garbage.status]).toEqual([401, 401, 401, 401]);
    expect(store.get(clients.clientKey(a.id))!.text).toBe(before);
    expect(called("/subscription/status")).toHaveLength(0);
    expect(mono.accessOf(await record(a.id)).open).toBe(false);
  });

  it("the public key is cached; a rotated key is fetched again, forged floods do not hammer monobank", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, null, "pending");
    const one = JSON.stringify({ subscriptionId: "s2_test", n: 1 });
    await WEBHOOK(webhook(a.id, one, sign(bankKey, one)));
    const two = JSON.stringify({ subscriptionId: "s2_test", n: 2 });
    await WEBHOOK(webhook(a.id, two, sign(bankKey, two)));
    expect(called("/pubkey")).toHaveLength(1);

    // Forged webhooks right after: the cached key says no, no new key request.
    for (let i = 0; i < 5; i++) {
      const junk = JSON.stringify({ subscriptionId: "s2_test", junk: i });
      expect((await WEBHOOK(webhook(a.id, junk, sign(pair(), junk)))).status).toBe(401);
    }
    expect(called("/pubkey")).toHaveLength(1);

    // monobank rotates its key.
    bankKey = pair();
    vi.setSystemTime(Date.now() + 60_000);
    const three = JSON.stringify({ subscriptionId: "s2_test", n: 3 });
    expect((await WEBHOOK(webhook(a.id, three, sign(bankKey, three)))).status).toBe(200);
    expect(called("/pubkey")).toHaveLength(2);
  });
});

describe("webhook repeat", () => {
  it("the same webhook delivered again answers 200 and is not applied twice", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, null, "pending");
    remote = { status: "active", payments: paidNow() };
    const body = JSON.stringify({ subscriptionId: "s2_test", status: "success" });
    const signature = sign(bankKey, body);

    expect((await WEBHOOK(webhook(a.id, body, signature))).status).toBe(200);
    const after = store.get(clients.clientKey(a.id))!;
    const syncs = called("/subscription/status").length;

    // monobank retries; meanwhile its API would say something else — a repeat must not re-read it.
    remote = { status: "cancelled", payments: [] };
    const again = await WEBHOOK(webhook(a.id, body, signature));

    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ ok: true, repeat: true });
    expect(called("/subscription/status")).toHaveLength(syncs);
    expect(store.get(clients.clientKey(a.id))).toEqual(after);
  });

  it("a webhook about another subscription is ignored", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, null, "pending");
    const body = JSON.stringify({ subscriptionId: "s2_somebody_else", status: "success" });
    const response = await WEBHOOK(webhook(a.id, body, sign(bankKey, body)));
    expect(await response.json()).toMatchObject({ ok: true, ignored: true });
    expect(called("/subscription/status")).toHaveLength(0);
  });
});

describe("results are closed without a paid subscription", () => {
  it("no payment → the table is not rendered; a payment opens it", async () => {
    const a = await newClient("Кав'ярня");
    await saveResults(a.id, table, "upload");

    const closed = await page(a.id, a.session);
    expect(closed.html).toContain("Результати закрито");
    expect(closed.html).not.toContain("Петренко");
    expect(closed.html).toContain('action="/api/client/subscribe"');

    await subscribed(a.id, 2);
    const open = await page(a.id, a.session);
    expect(open.html).toContain("Олена Петренко");
    expect(open.html).toContain("Підписка активна");
  });

  it("a failed charge: three days of grace after the paid month, then closed", async () => {
    const a = await newClient("Кав'ярня");
    await saveResults(a.id, table, "upload");
    const client = await record(a.id);
    const paidAt = Date.UTC(2026, 9, 10, 12); // 10 Oct → paid until 10 Nov
    client.billing = { ...clients.EMPTY_BILLING, subscriptionId: "s2_test", status: "active", lastPaidAt: paidAt };
    const at = (day: number, hour = 12) => mono.accessOf(client, Date.UTC(2026, 10, day, hour));

    expect(at(9)).toMatchObject({ open: true, state: "paid" });
    expect(at(11)).toMatchObject({ open: true, state: "grace" });
    expect(at(13, 11)).toMatchObject({ open: true, state: "grace" });
    expect(at(13, 13)).toMatchObject({ open: false, state: "expired" });

    // Cancelled: the paid month and not a day more.
    client.billing.status = "cancelled";
    expect(at(9).open).toBe(true);
    expect(at(11).open).toBe(false);

    // And on the page itself.
    await subscribed(a.id, 40);
    const html = (await page(a.id, a.session)).html;
    expect(html).toContain("Результати закрито");
    expect(html).not.toContain("Петренко");
  });

  it("a month is a calendar month, the 31st does not skip one", () => {
    expect(new Date(mono.addMonth(Date.UTC(2026, 0, 31, 9))).toISOString()).toBe("2026-02-28T09:00:00.000Z");
    expect(new Date(mono.addMonth(Date.UTC(2026, 11, 15))).toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });
});

describe("one client cannot reach another", () => {
  it("another client's session, a forged one or none opens no page and reads nothing", async () => {
    const a = await newClient("Кав'ярня");
    const b = await newClient("Салон");
    await subscribed(b.id, 1);
    await saveResults(b.id, table, "upload");

    for (const session of [a.session, undefined, a.session.replace(a.id, b.id), `${b.id}.9999999999.AAAA`]) {
      const got = await page(b.id, session);
      expect(got.redirect).toBe(`/client/${b.id}/login`);
      expect(got.html).toBe("");
    }
    expect((await page(b.id, b.session)).html).toContain("Олена Петренко");
  });

  it("an upload goes to the session's client even when the form names another", async () => {
    const a = await newClient("Кав'ярня");
    const b = await newClient("Салон");
    await saveResults(b.id, table, "upload");
    const before = store.get(resultsKey(b.id))!.text;

    const response = await UPLOAD(post("/api/client/upload", a.cookie, { id: b.id, file: new File(["x,y\n1,2\n"], "r.csv") }));

    expect(response.headers.get("location")).toBe(`https://shur-shur.com/client/${a.id}?u=ok`);
    expect(store.get(resultsKey(b.id))!.text).toBe(before);
    expect((await readResults(a.id))!.rows).toEqual([["1", "2"]]);
  });

  it("no session → upload, subscribe and cancel do nothing", async () => {
    const b = await newClient("Салон");
    await subscribed(b.id, 1);
    for (const [route, path] of [[UPLOAD, "upload"], [SUBSCRIBE, "subscribe"], [CANCEL, "cancel"]] as const) {
      const response = await route(post(`/api/client/${path}`, undefined, { id: b.id, file: new File(["x\n1\n"], "r.csv") }));
      expect(response.headers.get("location")).toBe("https://shur-shur.com/");
    }
    expect(store.has(resultsKey(b.id))).toBe(false);
    expect(calls).toHaveLength(0);
    expect((await record(b.id)).billing.status).toBe("active");
  });

  it("a password opens only its own cabinet", async () => {
    const a = await newClient("Кав'ярня");
    const b = await newClient("Салон");
    const other = await clients.createClient("Третій", false);
    await clients.completeClientSetup(other.client.id, other.token, "another password 1", "another password 1");

    const wrong = await LOGIN(post("/api/client/login", undefined, { id: other.client.id, password: PASSWORD }));
    expect(wrong.headers.get("location")).toContain("?e=bad");
    expect(wrong.headers.get("set-cookie")).toBeNull();

    const right = await LOGIN(post("/api/client/login", undefined, { id: b.id, password: PASSWORD }));
    const session = /shur_client=([^;]+)/.exec(right.headers.get("set-cookie") ?? "")![1];
    expect(await clients.signedInClient(session, b.id)).not.toBeNull();
    expect(await clients.signedInClient(session, a.id)).toBeNull();
  });

  it("a bot writes with its own client's key only — never into another cabinet", async () => {
    const a = await newClient("Кав'ярня");
    const b = await newClient("Салон");
    const keyA = await botKey(a.id);
    const keyB = await botKey(b.id);

    // A's key against B's cabinet, the site-wide secret, no key issued, an unknown client, a stale timestamp.
    const c = await newClient("Без ключа");
    const refused = [
      await INGEST(ingest(b.id, keyA, attempt(1))),
      await INGEST(ingest(b.id, HMAC, attempt(1))),
      await INGEST(ingest(c.id, keyA, attempt(1))),
      await INGEST(ingest("aaaaaaaaaaaa", keyA, attempt(1))),
      await INGEST(ingest(a.id, keyA, attempt(1), 600)),
    ];
    expect(refused.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
    for (const id of [a.id, b.id, c.id]) expect(store.has(attemptsKey(id))).toBe(false);

    expect((await INGEST(ingest(a.id, keyA, attempt(1)))).status).toBe(200);
    expect((await readAttempts(a.id))!.attempts).toHaveLength(1);
    expect(store.has(attemptsKey(b.id))).toBe(false);
    expect((await INGEST(ingest(b.id, keyB, attempt(2)))).status).toBe(200);

    // A new key replaces the old one at once.
    const fresh = await botKey(a.id);
    expect((await INGEST(ingest(a.id, keyA, attempt(3)))).status).toBe(401);
    expect((await INGEST(ingest(a.id, fresh, attempt(3)))).status).toBe(200);
  });

  it("the key without a browser: only a call signed by ace-main gets one, and nothing of it is logged", async () => {
    const call = (payload: unknown, secret = HMAC) => {
      const body = JSON.stringify(payload);
      const ts = String(Math.floor(Date.now() / 1000));
      return CLIENT_KEY(
        new Request("https://shur-shur.com/api/cabinet/client-key", {
          method: "POST",
          headers: { "x-shur-timestamp": ts, "x-shur-signature": signLedgerBody(secret, ts, body) },
          body,
        }),
      );
    };
    expect((await call({ action: "key", name: "Марина" }, "not-the-secret")).status).toBe(401);
    expect(await clients.listClients()).toHaveLength(0);

    const made = await (await call({ action: "key", name: "Марина" })).json();
    expect(made).toMatchObject({ ok: true, created: true, name: "Марина" });
    expect((await INGEST(ingest(made.client_id, made.secret, attempt(1)))).status).toBe(200);
    // The setup token it returned sets the client's password, once.
    expect((await clients.completeClientSetup(made.client_id, made.setup_token, PASSWORD, PASSWORD)).ok).toBe(true);

    // The same name again: the same client, a new key, no second setup link.
    const again = await (await call({ action: "key", name: "Марина" })).json();
    expect(again).toMatchObject({ client_id: made.client_id, created: false });
    expect(again.setup_token).toBeUndefined();
    expect((await INGEST(ingest(made.client_id, made.secret, attempt(2)))).status).toBe(401);
    expect((await INGEST(ingest(made.client_id, again.secret, attempt(2)))).status).toBe(200);
    for (const secret of [made.secret, again.secret, made.setup_token]) expect(logged.join("\n")).not.toContain(secret);

    // Delete: refused while the subscription charges, then the data goes with the client.
    await subscribed(made.client_id, 1);
    expect((await call({ action: "delete", client_id: made.client_id })).status).toBe(409);
    await subscribed(made.client_id, 1, "cancelled");
    expect((await call({ action: "delete", client_id: made.client_id })).status).toBe(200);
    expect([...store.keys()].filter((k) => k.includes(made.client_id))).toEqual([]);
  });

  it("the bot's key is not readable from the store", async () => {
    const a = await newClient("Кав'ярня");
    const key = await botKey(a.id);
    const everything = [...store.keys()].map((k) => store.get(k)!.text).join("\n");
    expect(everything).not.toContain(key);
    // And it does not open without the environment secret.
    process.env.CABINET_HMAC_SECRET = "another";
    expect(clients.ingestSecret(await record(a.id))).toBeNull();
    expect((await INGEST(ingest(a.id, key, attempt(1)))).status).toBe(401);
  });

  it("a repeated attempt is stored once; a batch is taken whole", async () => {
    const a = await newClient("Кав'ярня");
    const key = await botKey(a.id);
    const batch = { attempts: Array.from({ length: 500 }, (_, n) => attempt(n)) };

    expect(await (await INGEST(ingest(a.id, key, batch))).json()).toMatchObject({ ok: true, stored: 500, duplicates: 0 });
    const after = store.get(attemptsKey(a.id))!.text;
    expect(await (await INGEST(ingest(a.id, key, batch))).json()).toMatchObject({ ok: true, stored: 0, duplicates: 500 });
    expect(await (await INGEST(ingest(a.id, key, attempt(7)))).json()).toMatchObject({ stored: 0, duplicates: 1 });
    expect(store.get(attemptsKey(a.id))!.text).toBe(after);

    expect((await INGEST(ingest(a.id, key, { attempts: Array.from({ length: 501 }, (_, n) => attempt(n + 1000)) }))).status).toBe(400);
    expect((await readAttempts(a.id))!.attempts).toHaveLength(500);
  });

  it("a name, a username or a telegram id is refused — nothing of the request is stored", async () => {
    const a = await newClient("Кав'ярня");
    const key = await botKey(a.id);
    const personal: Record<string, unknown>[] = [
      { name: "Олена Петренко" },
      { username: "olena_p" },
      { tg_id: 100000001 },
      { telegram_id: 100000001 },
      { participant: "@olena_p" },
      { participant: "Олена Петренко" },
      { answers: [{ q: "Питання", a: "Так", points: 1, username: "olena_p" }] },
    ];
    for (const more of personal) {
      const response = await INGEST(ingest(a.id, key, attempt(1, more)));
      expect(response.status).toBe(400);
      expect(await response.text()).not.toMatch(/Петренко|olena_p|100000001/);
    }
    // One bad attempt refuses the whole batch.
    expect((await INGEST(ingest(a.id, key, { attempts: [attempt(1), attempt(2, { name: "Олена" })] }))).status).toBe(400);
    expect(store.has(attemptsKey(a.id))).toBe(false);
  });

  it("an uploaded sheet with the bot's columns drops the person columns", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, 1);
    const sheet = `finished_at,telegram id,username,имя,test,score,max_score,range_label,Питання 1\n2026-11-18 14:05:12,100000001,olena_p,Олена Петренко,Тест,7,12,5–8,Б\n`;
    const response = await UPLOAD(post("/api/client/upload", a.cookie, { file: new File([sheet], "answers.csv") }));
    expect(response.headers.get("location")).toContain("?u=ok");
    const text = store.get(attemptsKey(a.id))!.text;
    expect(text).not.toMatch(/Петренко|olena_p|100000001/);
    const [one] = (await readAttempts(a.id))!.attempts;
    expect(one).toMatchObject({ test: "Тест", score: 7, max: 12, range: "5–8", answers: [{ q: "Питання 1", a: "Б" }] });
    // The same file again adds nothing.
    await UPLOAD(post("/api/client/upload", a.cookie, { file: new File([sheet], "answers.csv") }));
    expect((await readAttempts(a.id))!.attempts).toHaveLength(1);
  });
});

describe("personal data stays in the cabinet", () => {
  it("rows from an upload, a push or a refused push reach no log line, URL or error answer", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, 1);
    const answers: string[] = [];
    const keep = async (response: Response) => {
      answers.push(response.headers.get("location") ?? "", await response.clone().text());
      return response;
    };

    const key = await botKey(a.id);
    await keep(await UPLOAD(post("/api/client/upload", a.cookie, { file: new File([CSV], "Олена Петренко +380501112233.csv") })));
    // An answer is free text: a person may type anything into it.
    await keep(await INGEST(ingest(a.id, key, attempt(1, { answers: [{ q: "Ваш контакт?", a: "Петренко +380501112233 olena@example.com", points: 0 }] }))));
    // Refused pushes: an unknown field, a key that is itself the data, a cell too long, a wrong shape, a bad signature.
    await keep(await INGEST(ingest(a.id, key, attempt(2, { name: "Петренко", phone: "+380501112233" }))));
    await keep(await INGEST(ingest(a.id, key, attempt(3, { "olena@example.com": 1 }))));
    await keep(await INGEST(ingest(a.id, key, attempt(4, { test: `Петренко olena@example.com ${"x".repeat(600)}` }))));
    await keep(await INGEST(ingest(a.id, key, { attempts: [{ ...attempt(5), answers: "Петренко +380501112233" }] })));
    await keep(await INGEST(ingest(a.id, "wrong-key", attempt(6, { name: "Петренко" }))));
    await keep(await UPLOAD(post("/api/client/upload", a.cookie, { file: new File(["PK\u0003\u0004 Петренко olena@example.com"], "broken.xlsx") })));
    const body = JSON.stringify({ subscriptionId: "s2_test", payer: "Петренко", phone: "+380501112233" });
    await keep(await WEBHOOK(webhook(a.id, body, sign(bankKey, body))));
    await keep(await WEBHOOK(webhook(a.id, body, "bad")));

    // The data did arrive — the silence is not an empty test.
    expect((await readResults(a.id))!.rows).toHaveLength(2);
    expect((await readAttempts(a.id))!.attempts).toHaveLength(1);
    const html = (await page(a.id, a.session)).html;
    expect(html).toContain("olena@example.com");
    expect(html).toContain("Ваш контакт?");

    expect(logged.length).toBeGreaterThan(4);
    const outside = [...logged, ...answers, ...redirectMock.mock.calls.map(([url]) => url)].join("\n");
    for (const secret of PD) expect(outside).not.toContain(secret);
    // Nor the client's own secrets.
    for (const secret of [PASSWORD, a.session, key, "live-token", "test-token"]) expect(outside).not.toContain(secret);
  });

  it("the page splits an uploaded table by day and counts it", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, 1);
    await UPLOAD(post("/api/client/upload", a.cookie, { file: new File([CSV], "r.csv") }));
    const html = (await page(a.id, a.session)).html;
    expect(html).toContain("За днями");
    expect(html).toContain("17.11.2026");
    expect(html).toContain("18.11.2026");
  });

  it("the bot's attempts become statistics; they are closed without a paid subscription too", async () => {
    const a = await newClient("Кав'ярня");
    const key = await botKey(a.id);
    await INGEST(ingest(a.id, key, { attempts: [0, 1, 2, 3, 4, 5].map((n) => attempt(n)) }));

    const closed = (await page(a.id, a.session)).html;
    expect(closed).toContain("Результати закрито");
    expect(closed).not.toContain("Ваш бізнес готовий до зростання?");

    await subscribed(a.id, 1);
    const html = (await page(a.id, a.session)).html;
    expect(html).toContain("Ваш бізнес готовий до зростання?");
    expect(html).toMatch(/Проходжень: <strong[^>]*>6<\/strong>/);
    expect(html).toContain("унікальних учасників: 4");
    expect(html).toContain("5–8: є з чого почати");
    expect(html).toContain("Чи є у вас план продажів?");
    expect(html).toContain("17.11.2026");
  });
});

describe("money", () => {
  it("without a token: no button, «Оплата скоро», and nothing is created at monobank", async () => {
    delete process.env.MONO_TOKEN;
    const a = await newClient("Кав'ярня");
    await saveResults(a.id, table, "upload");

    const html = (await page(a.id, a.session)).html;
    expect(html).toContain("Оплата скоро");
    expect(html).not.toContain("/api/client/subscribe");
    expect(html).not.toContain("Оформити підписку");

    const response = await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    expect(response.headers.get("location")).toBe(`https://shur-shur.com/client/${a.id}?b=soon`);
    expect(calls).toHaveLength(0);
    expect((await record(a.id)).billing.status).toBe("none");
  });

  it("the subscription is 15 € monthly; a second click reuses the page instead of a second subscription", async () => {
    const a = await newClient("Кав'ярня");
    const first = await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    expect(first.status).toBe(303);
    expect(first.headers.get("location")).toBe("https://pay.mbnk.biz/s2_test");
    const [create] = called("/subscription/create");
    expect(create.token).toBe("live-token");
    expect(create.body).toMatchObject({
      amount: 1500,
      ccy: 978,
      interval: "1m",
      redirectUrl: expect.stringContaining(`/client/${a.id}?paid=1`),
      webHookUrls: { chargeUrl: expect.stringContaining(`/api/billing/mono?c=${a.id}`), statusUrl: expect.stringContaining(`/api/billing/mono?c=${a.id}`) },
    });

    const second = await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    expect(second.headers.get("location")).toBe("https://pay.mbnk.biz/s2_test");
    expect(called("/subscription/create")).toHaveLength(1);

    // Paying already: no new subscription either.
    await subscribed(a.id, 1);
    await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    expect(called("/subscription/create")).toHaveLength(1);
  });

  it("MONO_PRICE_UAH switches the charge to hryvnia and the label says both", async () => {
    process.env.MONO_PRICE_UAH = "730";
    const a = await newClient("Кав'ярня");
    expect((await page(a.id, a.session)).html).toContain("15 € (≈ 730 грн)");
    await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    expect(called("/subscription/create")[0].body).toMatchObject({ amount: 73000, ccy: 980 });
  });

  it("a test client never touches the live token — and has no billing without the test one", async () => {
    const t = await newClient("Проба", true);
    await SUBSCRIBE(post("/api/client/subscribe", t.cookie));
    expect(calls.map((c) => c.token)).toEqual(["test-token"]);

    delete process.env.MONO_TEST_TOKEN;
    calls = [];
    const u = await newClient("Проба 2", true);
    await SUBSCRIBE(post("/api/client/subscribe", u.cookie));
    expect(calls).toHaveLength(0);
  });

  it("cancel stops future charges at monobank and keeps the paid month open", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, 5);
    remote = { status: "cancelled", payments: [{ status: "success", chargedAt: new Date(Date.now() - 5 * DAY).toISOString(), amount: 1500, ccy: 978 }] };

    const response = await CANCEL(post("/api/client/cancel", a.cookie));

    expect(response.headers.get("location")).toContain("?b=cancelled");
    expect(called("/subscription/edit")[0].body).toEqual({ subscriptionId: "s2_test", action: "cancel" });
    expect(called("/subscription/remove")).toHaveLength(0);
    const fresh = await record(a.id);
    expect(fresh.billing.status).toBe("cancelled");
    expect(mono.accessOf(fresh)).toMatchObject({ open: true, state: "paid" });
  });

  it("a cancel that monobank refused is not shown as done", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, 5);
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ errCode: "500", errText: "boom" }), { status: 500 }));
    const response = await CANCEL(post("/api/client/cancel", a.cookie));
    expect(response.headers.get("location")).toContain("?b=cancel_failed");
    expect((await record(a.id)).billing.status).toBe("active");
  });
});
