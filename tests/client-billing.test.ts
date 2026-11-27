import { createSign, generateKeyPairSync } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Client cabinets (/client/<id>) and the monobank subscription — MONEY and
 * RIGHTS only (owner's rule 13.10.2026):
 *  - a webhook counts only with monobank's signature; a forged or unsigned
 *    one changes nothing; a rotated key is picked up;
 *  - the same webhook twice is applied once;
 *  - results are ALWAYS shown, paid or not (owner, 25.11.2026); the .csv
 *    download answers only the cabinet's own client or the back office, and
 *    carries nothing of the client (no phone);
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

const { useMemoryStore, AUTH_KEY } = await import("../src/lib/cabinet/store");
const auth = await import("../src/lib/cabinet/auth");
const { signLedgerBody } = await import("../src/lib/ledger");
const clients = await import("../src/lib/client/clients");
const { resultsKey, readResults, saveResults } = await import("../src/lib/client/results");
const { attemptsKey, readAttempts } = await import("../src/lib/client/attempts");
const mono = await import("../src/lib/billing/mono");
const { sealCard, chargeBlock, saveMonoToken } = await import("../src/lib/billing/settings");
const { GET: CHARGE_RUN } = await import("../src/app/api/billing/charge/route");
const { POST: WEBHOOK } = await import("../src/app/api/billing/mono/route");
const { storeUpload } = await import("../src/lib/client/http");
const { GET: EXPORT } = await import("../src/app/api/client/export/route");
const { POST: INGEST } = await import("../src/app/api/client/ingest/route");
const { POST: SUBSCRIBE } = await import("../src/app/api/client/subscribe/route");
const { POST: CANCEL } = await import("../src/app/api/client/cancel/route");
const { POST: LOGIN } = await import("../src/app/api/client/login/route");
const { POST: CLIENT_KEY } = await import("../src/app/api/cabinet/client-key/route");
const { POST: BILLING_TEST } = await import("../src/app/api/cabinet/billing-test/route");
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

/* ---- the mocked monobank: invoices with card saving, and charges by the saved card ---- */
let bankKey = pair();
const CARD = "CARD-TOKEN-VALUE";
type Invoice = { status: string; modified: number; card: string | null };
let invoices: Map<string, Invoice>;
let n = 0;
/** What wallet/payment answers next: a status, or an error of monobank. */
let wallet: { status: "success" | "processing" | "failure"; tds?: boolean } | { error: number; errText: string };
let calls: { method: string; path: string; token: string | null; body: Record<string, unknown> | null }[];
/** What invoice/fiscal-checks answers per invoice; unset → no checks (no PRRO link). */
let fiscal: Map<string, Record<string, unknown>[] | "down">;

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  if (url.origin !== "https://api.monobank.ua") throw new Error(`unexpected request to ${url.origin}`);
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
  calls.push({ method: init?.method ?? "GET", path: url.pathname, token: new Headers(init?.headers).get("x-token"), body });
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
  switch (url.pathname) {
    case "/api/merchant/pubkey":
      return json({ key: Buffer.from(pem(bankKey)).toString("base64") });
    case "/api/merchant/invoice/create": {
      const id = `inv_${++n}`;
      invoices.set(id, { status: "created", modified: Date.now(), card: null });
      return json({ invoiceId: id, pageUrl: `https://pay.mbnk.biz/${id}` });
    }
    case "/api/merchant/invoice/status": {
      const id = url.searchParams.get("invoiceId") ?? "";
      const inv = invoices.get(id);
      if (!inv) return json({ errCode: "NOT_FOUND", errText: "invoice not found" }, 404);
      return json({
        invoiceId: id,
        status: inv.status,
        amount: 1500,
        ccy: 978,
        createdDate: new Date(inv.modified).toISOString(),
        modifiedDate: new Date(inv.modified).toISOString(),
        ...(inv.card ? { walletData: { cardToken: inv.card, walletId: "w", status: "created" } } : {}),
      });
    }
    case "/api/merchant/invoice/remove": {
      const inv = invoices.get(String(body?.invoiceId));
      if (!inv || inv.status === "success") return json({ errCode: "BAD_REQUEST", errText: "invoice already paid" }, 400);
      inv.status = "expired";
      return json({});
    }
    case "/api/merchant/wallet/payment": {
      if ("error" in wallet) return json({ errCode: "1001", errText: wallet.errText }, wallet.error);
      const id = `ch_${++n}`;
      invoices.set(id, { status: wallet.status, modified: Date.now(), card: null });
      return json({ invoiceId: id, status: wallet.status, amount: 1500, ccy: 978, ...(wallet.tds ? { tdsUrl: "https://3ds.example/x" } : {}) });
    }
    case "/api/merchant/invoice/fiscal-checks": {
      // No PRRO link: monobank answers an empty list.
      const checks = fiscal.get(url.searchParams.get("invoiceId") ?? "");
      if (checks === "down") return json({ errCode: "INTERNAL_ERROR", errText: "internal server error" }, 500);
      return json({ checks: checks ?? [] });
    }
    default:
      return json({ errCode: "404", errText: "not found" }, 404);
  }
});
const called = (path: string) => calls.filter((c) => c.path.endsWith(path));
/** The client paid invoice `id` on monobank's page; the card is saved. */
const pay = (id: string, at = Date.now() - 60_000) => invoices.set(id, { status: "success", modified: at, card: CARD });

/* ---- helpers ---- */
let store: ReturnType<typeof useMemoryStore>;
let ip = 0;
let logged: string[];

/** A client past its free week (the money tests ask for payment); `free` keeps the week. */
async function newClient(name: string, test = false, free = false) {
  const { client, token } = await clients.createClient(name, test);
  const done = await clients.completeClientSetup(client.id, token, PASSWORD, PASSWORD);
  if (!done.ok) throw new Error("setup failed");
  if (!free) await clients.updateClient(client.id, (c) => void (c.freeUntil = Date.now() - 1));
  return { id: client.id, session: done.session, cookie: `${clients.CLIENT_COOKIE}=${done.session}` };
}

const record = async (id: string) => (await clients.readClient(id))!.client;

/** A client in a given state; the first invoice is `inv_first` (paid when paidDaysAgo is set), the card saved unless said otherwise. */
async function subscribed(id: string, paidDaysAgo: number | null, status: "active" | "cancelled" | "pending" = "active", card = paidDaysAgo !== null) {
  const lastPaidAt = paidDaysAgo === null ? null : Date.now() - paidDaysAgo * DAY;
  invoices.set("inv_first", lastPaidAt ? { status: "success", modified: lastPaidAt, card: CARD } : { status: "created", modified: Date.now(), card: null });
  await clients.updateClient(id, (c) => {
    c.billing = {
      ...clients.EMPTY_BILLING,
      seen: [],
      invoiceId: "inv_first",
      pageUrl: status === "pending" ? "https://pay.mbnk.biz/inv_first" : null,
      createdAt: Date.now() - 40 * DAY,
      status,
      lastPaidAt,
      card: card ? sealCard(CARD) : null,
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

/** A call to the site signed by ace-main (CABINET_HMAC_SECRET). */
function signedRequest(path: string, payload: unknown): Request {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  return new Request(`https://shur-shur.com${path}`, { method: "POST", headers: { "x-shur-timestamp": ts, "x-shur-signature": signLedgerBody(HMAC, ts, body) }, body });
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

function download(id: string, cookie?: string): Promise<Response> {
  return EXPORT(new Request(`https://shur-shur.com/api/client/export?id=${id}`, { headers: cookie ? { cookie } : {} }));
}
const file = (text: string, name = "r.csv") => new File([text], name);

const table = { columns: ["Дата", "Ім'я"], rows: [["2026-11-17", "Олена Петренко"]] };

beforeEach(() => {
  store = useMemoryStore();
  process.env.CABINET_HMAC_SECRET = HMAC;
  process.env.MONO_TOKEN = "live-token";
  process.env.MONO_TEST_TOKEN = "test-token";
  delete process.env.MONO_PRICE_UAH;
  process.env.CRON_SECRET = "cron-secret";
  bankKey = pair();
  invoices = new Map();
  fiscal = new Map();
  n = 0;
  wallet = { status: "success" };
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
    pay("inv_first");
    const body = JSON.stringify({ invoiceId: "inv_first", status: "success" });

    const response = await WEBHOOK(webhook(a.id, body, sign(bankKey, body)));

    expect(response.status).toBe(200);
    const { billing } = await record(a.id);
    expect(billing.status).toBe("active");
    expect(billing.lastPaidAt).toBeGreaterThan(Date.now() - 5 * 60_000);
    expect(billing.seen).toHaveLength(1);
    // The card came back with the payment: kept, sealed — never as it came.
    expect(billing.card).not.toBeNull();
    expect([...store.values()].map((s) => s.text).join("\n")).not.toContain(CARD);
  });

  it("a webhook body cannot set the state by itself — only what monobank's API answers counts", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, null, "pending");
    // Signed correctly, claims success — but monobank knows of no payment.
    const body = JSON.stringify({ invoiceId: "inv_first", status: "success", amount: 1500 });
    expect((await WEBHOOK(webhook(a.id, body, sign(bankKey, body)))).status).toBe(200);
    const fresh = await record(a.id);
    expect(fresh.billing.lastPaidAt).toBeNull();
    expect((await mono.accessOf(fresh)).open).toBe(false);
  });

  it("a forged, unsigned or altered webhook is refused with 401 and changes nothing", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, null, "pending");
    pay("inv_first");
    const before = store.get(clients.clientKey(a.id))!.text;
    const body = JSON.stringify({ invoiceId: "inv_first", status: "success" });

    const forged = await WEBHOOK(webhook(a.id, body, sign(pair(), body)));
    const unsigned = await WEBHOOK(webhook(a.id, body, null));
    const altered = await WEBHOOK(webhook(a.id, body.replace("success", "SUCCESS"), sign(bankKey, body)));
    const garbage = await WEBHOOK(webhook(a.id, body, "not-a-signature"));

    expect([forged.status, unsigned.status, altered.status, garbage.status]).toEqual([401, 401, 401, 401]);
    expect(store.get(clients.clientKey(a.id))!.text).toBe(before);
    expect(called("/invoice/status")).toHaveLength(0);
    expect((await mono.accessOf(await record(a.id))).open).toBe(false);
  });

  it("the public key is cached; a rotated key is fetched again, forged floods do not hammer monobank", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, null, "pending");
    const one = JSON.stringify({ invoiceId: "inv_first", n: 1 });
    await WEBHOOK(webhook(a.id, one, sign(bankKey, one)));
    const two = JSON.stringify({ invoiceId: "inv_first", n: 2 });
    await WEBHOOK(webhook(a.id, two, sign(bankKey, two)));
    expect(called("/pubkey")).toHaveLength(1);

    // Forged webhooks right after: the cached key says no, no new key request.
    for (let i = 0; i < 5; i++) {
      const junk = JSON.stringify({ invoiceId: "inv_first", junk: i });
      expect((await WEBHOOK(webhook(a.id, junk, sign(pair(), junk)))).status).toBe(401);
    }
    expect(called("/pubkey")).toHaveLength(1);

    // monobank rotates its key.
    bankKey = pair();
    vi.setSystemTime(Date.now() + 60_000);
    const three = JSON.stringify({ invoiceId: "inv_first", n: 3 });
    expect((await WEBHOOK(webhook(a.id, three, sign(bankKey, three)))).status).toBe(200);
    expect(called("/pubkey")).toHaveLength(2);
  });
});

describe("webhook repeat", () => {
  it("the same webhook delivered again answers 200 and is not applied twice", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, null, "pending");
    pay("inv_first");
    const body = JSON.stringify({ invoiceId: "inv_first", status: "success" });
    const signature = sign(bankKey, body);

    expect((await WEBHOOK(webhook(a.id, body, signature))).status).toBe(200);
    const after = store.get(clients.clientKey(a.id))!;
    const syncs = called("/invoice/status").length;

    // monobank retries; meanwhile its API would say something else — a repeat must not re-read it.
    invoices.set("inv_first", { status: "reversed", modified: Date.now(), card: null });
    const again = await WEBHOOK(webhook(a.id, body, signature));

    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ ok: true, repeat: true });
    expect(called("/invoice/status")).toHaveLength(syncs);
    expect(store.get(clients.clientKey(a.id))).toEqual(after);
  });

  it("a webhook about another invoice is ignored", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, null, "pending");
    const body = JSON.stringify({ subscriptionId: "inv_somebody_else", status: "success" });
    const response = await WEBHOOK(webhook(a.id, body, sign(bankKey, body)));
    expect(await response.json()).toMatchObject({ ok: true, ignored: true });
    expect(called("/invoice/status")).toHaveLength(0);
  });
});

describe("results are always open — paid or not", () => {
  it("no payment → the table is shown, with the subscribe button and the download", async () => {
    const a = await newClient("Кав'ярня");
    await saveResults(a.id, table, "upload");

    const unpaid = await page(a.id, a.session);
    expect(unpaid.html).toContain("Олена Петренко");
    expect(unpaid.html).not.toContain("закрито");
    expect(unpaid.html).toContain('action="/api/client/subscribe"');
    expect(unpaid.html).toContain(`href="/api/client/export?id=${a.id}"`);
    expect(unpaid.html).not.toContain("/api/client/upload");

    await subscribed(a.id, 2);
    const open = await page(a.id, a.session);
    expect(open.html).toContain("Олена Петренко");
    expect(open.html).toContain("Підписка активна");
  });

  it("a failed charge: three days of grace after the paid month, then expired — the results stay shown", async () => {
    const a = await newClient("Кав'ярня");
    await saveResults(a.id, table, "upload");
    const client = await record(a.id);
    const paidAt = Date.UTC(2026, 9, 10, 12); // 10 Oct → paid until 10 Nov
    client.billing = { ...clients.EMPTY_BILLING, invoiceId: "inv_first", status: "active", lastPaidAt: paidAt };
    const at = (day: number, hour = 12) => mono.accessOf(client, Date.UTC(2026, 10, day, hour));

    expect(await at(9)).toMatchObject({ open: true, state: "paid" });
    expect(await at(11)).toMatchObject({ open: true, state: "grace" });
    expect(await at(13, 11)).toMatchObject({ open: true, state: "grace" });
    expect(await at(13, 13)).toMatchObject({ open: false, state: "expired" });

    // Cancelled: the paid month and not a day more.
    client.billing.status = "cancelled";
    expect((await at(9)).open).toBe(true);
    expect((await at(11)).open).toBe(false);

    // And on the page itself: expired billing, results still there.
    await subscribed(a.id, 40);
    const html = (await page(a.id, a.session)).html;
    expect(html).toContain("Олена Петренко");
    expect(html).not.toContain("закрито");
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
      expect(got.redirect).toBe("/login");
      expect(got.html).toBe("");
    }
    expect((await page(b.id, b.session)).html).toContain("Олена Петренко");
  });

  it("the .csv download: own cabinet or the back office only; no session, another's or a forged one → 401", async () => {
    const a = await newClient("Кав'ярня");
    const b = await newClient("Салон");
    await saveResults(b.id, table, "upload");

    for (const cookie of [undefined, a.cookie, `${clients.CLIENT_COOKIE}=${a.session.replace(a.id, b.id)}`, `${clients.CLIENT_COOKIE}=${b.id}.9999999999.AAAA`, `${auth.SESSION_COOKIE}=${Math.floor(Date.now() / 1000) + 999}.forged`]) {
      const refused = await download(b.id, cookie);
      expect(refused.status).toBe(401);
      expect(await refused.text()).toBe("");
    }
    expect((await download("not-an-id", a.cookie)).status).toBe(401);

    const own = await download(b.id, b.cookie);
    expect(own.status).toBe(200);
    expect(own.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(own.headers.get("content-disposition")).toBe(`attachment; filename="shur-results-${b.id}.csv"`);
    const bytes = new Uint8Array(await own.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toContain("Олена Петренко");

    const sessionKey = "ab".repeat(32);
    store.set(AUTH_KEY, { text: JSON.stringify({ password: { salt: "", hash: "" }, sessionKey, setup: null, failures: { since: 0, count: 0 } }), etag: "a" });
    expect((await download(b.id, `${auth.SESSION_COOKIE}=${auth.makeSession(sessionKey)}`)).status).toBe(200);
  });

  it("the .csv of an unpaid client: every attempt with its answers, and not the client's phone", async () => {
    const made = await clients.createClient("Марина", false);
    const done = await clients.completeClientSetup(made.client.id, made.token, PASSWORD, PASSWORD, Date.now(), "+380 (67) 123-45-67");
    if (!done.ok) throw new Error("setup failed");
    const id = made.client.id;
    await subscribed(id, null);
    const key = await botKey(id);
    await INGEST(ingest(id, key, { attempts: [0, 1, 2].map((n) => attempt(n)) }));
    expect((await mono.accessOf(await record(id))).open).toBe(false);

    const response = await download(id, `${clients.CLIENT_COOKIE}=${done.session}`);
    expect(response.status).toBe(200);
    const text = (await response.text()).replace(/^\uFEFF/, "");
    const lines = text.trim().split("\r\n");
    expect(lines[0]).toBe("Дата (Київ),Тест,Бал,Макс. бал,Діапазон,Чи є у вас план продажів?,Хто веде фінанси?");
    expect(lines).toHaveLength(4);
    expect(text).toContain("5–8: є з чого почати");
    expect(text).toContain("Я сам");
    expect(text).not.toMatch(/380671234567|67.?123.?45.?67|Марина/);
  });

  it("no session → subscribe and cancel do nothing", async () => {
    const b = await newClient("Салон");
    await subscribed(b.id, 1);
    for (const [route, path] of [[SUBSCRIBE, "subscribe"], [CANCEL, "cancel"]] as const) {
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

  it("the phone is the login: set once with the password, unique, any spelling of it signs in", async () => {
    const made = await clients.createClient("Марина", false);
    expect((await clients.completeClientSetup(made.client.id, made.token, PASSWORD, PASSWORD, Date.now(), "12")).ok).toBe(false);
    const done = await clients.completeClientSetup(made.client.id, made.token, PASSWORD, PASSWORD, Date.now(), "+380 (67) 123-45-67");
    expect(done.ok).toBe(true);
    expect((await record(made.client.id)).phone).toBe("380671234567");

    const twin = await clients.createClient("Інша", false);
    expect(await clients.completeClientSetup(twin.client.id, twin.token, PASSWORD, PASSWORD, Date.now(), "067 123 45 67")).toEqual({ ok: false, error: "phone_taken" });

    const right = await LOGIN(post("/api/client/login", undefined, { phone: "0671234567", password: PASSWORD }));
    expect(right.headers.get("location")).toMatch(new RegExp(`/client/${made.client.id}$`));
    const session = /shur_client=([^;]+)/.exec(right.headers.get("set-cookie") ?? "")![1];
    expect(await clients.signedInClient(session, made.client.id)).not.toBeNull();

    for (const form of [{ phone: "0671234567", password: "wrong password 1" }, { phone: "0999999999", password: PASSWORD }]) {
      const refused = await LOGIN(post("/api/client/login", undefined, form));
      expect(refused.headers.get("location")).toMatch(/\/login\?e=bad$/);
      expect(refused.headers.get("set-cookie")).toBeNull();
    }
    expect(logged.join("\n")).not.toMatch(/67.?123|0999/);
  });

  it("the simple login: set by the signed call, any case signs in, a wrong one does not, the old link and sessions end", async () => {
    const a = await newClient("Марина");
    const link = await clients.reissueSetup(a.id);
    const set = (payload: Record<string, unknown>) => CLIENT_KEY(signedRequest("/api/cabinet/client-key", payload));

    expect((await set({ action: "password", client_id: a.id, login: "marina", password: "1234" })).status).toBe(400);
    expect((await set({ action: "password", client_id: a.id, login: "ма", password: "12345" })).status).toBe(400);
    expect((await set({ action: "password", client_id: a.id, login: "marina", password: "12345" })).status).toBe(200);
    const b = await newClient("Інший");
    expect((await set({ action: "password", client_id: b.id, login: "MARINA", password: "12345" })).status).toBe(409);

    // A new password: the earlier session and the unused link stop working.
    expect(await clients.signedInClient(a.session, a.id)).toBeNull();
    expect(await clients.clientSetupValid(a.id, link!)).toBe(false);

    for (const login of ["marina", "Marina", " MARINA "]) {
      const right = await LOGIN(post("/api/client/login", undefined, { login, password: "12345" }));
      expect(right.headers.get("location")).toMatch(new RegExp(`/client/${a.id}$`));
      const session = /shur_client=([^;]+)/.exec(right.headers.get("set-cookie") ?? "")![1];
      expect(await clients.signedInClient(session, a.id)).not.toBeNull();
    }
    for (const form of [{ login: "marina", password: "12346" }, { login: "marinka", password: "12345" }, { login: "marina", password: "" }]) {
      const refused = await LOGIN(post("/api/client/login", undefined, form));
      expect(refused.headers.get("location")).toMatch(/\/login\?e=bad$/);
      expect(refused.headers.get("set-cookie")).toBeNull();
    }
    expect(logged.join("\n")).not.toMatch(/12345|12346|marina/i);
    expect(JSON.stringify(store.get(clients.clientKey(a.id)))).not.toContain("12345");
  });

  it("the back office sees any client's page read-only; a forged back-office cookie sees nothing", async () => {
    const a = await newClient("Кав'ярня");
    const sessionKey = "ab".repeat(32);
    store.set(AUTH_KEY, { text: JSON.stringify({ password: { salt: "", hash: "" }, sessionKey, setup: null, failures: { since: 0, count: 0 } }), etag: "a" });

    cookieJar.clear();
    cookieJar.set(auth.SESSION_COOKIE, `${Math.floor(Date.now() / 1000) + 999}.forged`);
    await expect(ClientPage({ params: Promise.resolve({ id: a.id }), searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT /login");

    cookieJar.set(auth.SESSION_COOKIE, auth.makeSession(sessionKey));
    const html = renderToStaticMarkup(await ClientPage({ params: Promise.resolve({ id: a.id }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("Перегляд адміністратора");
    expect(html).toContain("Кав&#x27;ярня");
    expect(html).toMatch(/<fieldset disabled=""/);
    expect(html).not.toContain("/api/client/logout");
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

  it("a sheet the back office uploads with the bot's columns drops the person columns", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, 1);
    const sheet = `finished_at,telegram id,username,имя,test,score,max_score,range_label,Питання 1\n2026-11-18 14:05:12,100000001,olena_p,Олена Петренко,Тест,7,12,5–8,Б\n`;
    expect(await storeUpload(a.id, file(sheet, "answers.csv"), "admin")).toBe("ok");
    const text = store.get(attemptsKey(a.id))!.text;
    expect(text).not.toMatch(/Петренко|olena_p|100000001/);
    const [one] = (await readAttempts(a.id))!.attempts;
    expect(one).toMatchObject({ test: "Тест", score: 7, max: 12, range: "5–8", answers: [{ q: "Питання 1", a: "Б" }] });
    // The same file again adds nothing.
    await storeUpload(a.id, file(sheet, "answers.csv"), "admin");
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
    answers.push(await storeUpload(a.id, file(CSV, "Олена Петренко +380501112233.csv"), "admin"));
    // An answer is free text: a person may type anything into it.
    await keep(await INGEST(ingest(a.id, key, attempt(1, { answers: [{ q: "Ваш контакт?", a: "Петренко +380501112233 olena@example.com", points: 0 }] }))));
    // Refused pushes: an unknown field, a key that is itself the data, a cell too long, a wrong shape, a bad signature.
    await keep(await INGEST(ingest(a.id, key, attempt(2, { name: "Петренко", phone: "+380501112233" }))));
    await keep(await INGEST(ingest(a.id, key, attempt(3, { "olena@example.com": 1 }))));
    await keep(await INGEST(ingest(a.id, key, attempt(4, { test: `Петренко olena@example.com ${"x".repeat(600)}` }))));
    await keep(await INGEST(ingest(a.id, key, { attempts: [{ ...attempt(5), answers: "Петренко +380501112233" }] })));
    await keep(await INGEST(ingest(a.id, "wrong-key", attempt(6, { name: "Петренко" }))));
    answers.push(await storeUpload(a.id, file("PK\u0003\u0004 Петренко olena@example.com", "broken.xlsx"), "admin"));
    const body = JSON.stringify({ invoiceId: "inv_first", payer: "Петренко", phone: "+380501112233" });
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
    await storeUpload(a.id, file(CSV), "admin");
    const html = (await page(a.id, a.session)).html;
    expect(html).toContain("За днями");
    expect(html).toContain("17.11.2026");
    expect(html).toContain("18.11.2026");
  });

  it("the bot's attempts become statistics — shown without a paid subscription too", async () => {
    const a = await newClient("Кав'ярня");
    const key = await botKey(a.id);
    await INGEST(ingest(a.id, key, { attempts: [0, 1, 2, 3, 4, 5].map((n) => attempt(n)) }));
    await subscribed(a.id, null);

    const html = (await page(a.id, a.session)).html;
    expect(html).toContain("Ваш бізнес готовий до зростання?");
    expect(html).toMatch(/Проходжень: <strong[^>]*>6<\/strong>/);
    expect(html).toContain("унікальних учасників: 4");
    expect(html).toContain("5–8: є з чого почати");
    expect(html).toContain("Чи є у вас план продажів?");
    expect(html).toContain("17.11.2026");
  });
});

describe("the free week", () => {
  it("before freeUntil: «Оплата з <дд.мм>» and the «Оплатити» button, results and .csv shown; after it, unpaid, still shown", async () => {
    const a = await newClient("Кав'ярня", false, true);
    await saveResults(a.id, table, "upload");
    const until = Date.UTC(2026, 10, 26, 22); // 27.11.2026 00:00 Kyiv
    await clients.updateClient(a.id, (c) => void (c.freeUntil = until));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(until - 10 * 60 * 60 * 1000);

    const free = (await page(a.id, a.session)).html;
    expect(free).toContain("Оплата з 27.11 — 15 € на місяць");
    expect(free).toContain('action="/api/client/subscribe"');
    expect(free).toMatch(/<button[^>]*>Оплатити<\/button>/);
    expect(free).toContain("Олена Петренко");
    expect(free).toContain(`href="/api/client/export?id=${a.id}"`);
    expect((await download(a.id, a.cookie)).status).toBe(200);

    // Payment off on the site: the line stays, no button that would lead nowhere.
    delete process.env.MONO_TOKEN;
    const off = (await page(a.id, a.session)).html;
    expect(off).toContain("Оплата з 27.11 — 15 € на місяць");
    expect(off).not.toContain("/api/client/subscribe");
    process.env.MONO_TOKEN = "live-token";

    // The date passed, nothing paid: nothing is closed.
    vi.setSystemTime(until + DAY);
    const after = (await page(a.id, a.session)).html;
    expect(after).toContain('action="/api/client/subscribe"');
    expect(after).not.toContain("Оплата з 27.11");
    expect(after).toContain("Олена Петренко");
    expect(after).toContain(`href="/api/client/export?id=${a.id}"`);
    expect((await download(a.id, a.cookie)).status).toBe(200);
  });

  it("paid ahead during the free days: the paid month starts at freeUntil, the next charge a month after it", async () => {
    const a = await newClient("Кав'ярня", false, true);
    const until = Date.UTC(2026, 10, 26, 22); // 27.11.2026 00:00 Kyiv
    await clients.updateClient(a.id, (c) => void (c.freeUntil = until));
    vi.useFakeTimers({ toFake: ["Date"] });
    const paidAt = until - 10 * 60 * 60 * 1000;
    vi.setSystemTime(paidAt);

    const response = await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    expect(response.headers.get("location")).toBe("https://pay.mbnk.biz/inv_1");
    expect(called("/invoice/create")[0].body).toMatchObject({ amount: 1500, ccy: 978 });
    // The page opened, not paid yet: still «Оплата з» and «Оплатити», which takes her back to the same page.
    const waiting = (await page(a.id, a.session)).html;
    expect(waiting).toContain("Оплата з 27.11 — 15 € на місяць");
    expect(waiting).toMatch(/<button[^>]*>Оплатити<\/button>/);
    expect((await SUBSCRIBE(post("/api/client/subscribe", a.cookie))).headers.get("location")).toBe("https://pay.mbnk.biz/inv_1");
    expect(called("/invoice/create")).toHaveLength(1);
    pay("inv_1", paidAt + 60_000);
    vi.setSystemTime(paidAt + 2 * 60_000);
    const html = (await page(a.id, a.session)).html;

    const { billing } = await record(a.id);
    expect(billing).toMatchObject({ status: "active", lastPaidAt: until, nextChargeAt: mono.addMonth(until) });
    expect(mono.addMonth(until)).toBe(Date.UTC(2026, 11, 26, 22)); // 27.12 00:00 Kyiv
    expect(html).toContain("Підписка активна");
    expect(html).toContain("27.12.2026");

    // No charge before the paid month ends; the first one asks for the month from 27.12.
    expect(await mono.runCharges(Date.UTC(2026, 11, 20))).toMatchObject({ not_due: 1 });
    expect(called("/wallet/payment")).toHaveLength(0);
  });

  it("paid after freeUntil: the month starts at the payment, as before", async () => {
    const a = await newClient("Кав'ярня");
    await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    const at = Date.now() + 1000;
    pay("inv_1", at);
    await page(a.id, a.session);
    expect((await record(a.id)).billing.lastPaidAt).toBe(at);
  });

  it("the free days are set by the signed call only", async () => {
    const a = await newClient("Кав'ярня", false, true);
    const until = Date.UTC(2026, 10, 26, 22);
    const ok = await CLIENT_KEY(signedRequest("/api/cabinet/client-key", { action: "free_until", client_id: a.id, free_until: until }));
    expect(ok.status).toBe(200);
    expect((await record(a.id)).freeUntil).toBe(until);
    const forged = await CLIENT_KEY(new Request("https://shur-shur.com/api/cabinet/client-key", { method: "POST", body: JSON.stringify({ action: "free_until", client_id: a.id, free_until: 1 }) }));
    expect(forged.status).toBeGreaterThanOrEqual(400);
    expect((await record(a.id)).freeUntil).toBe(until);
  });

  it("a new client is free for 7 days; a record from before the field is free until 03.12.2026", async () => {
    const now = Date.UTC(2026, 11, 10, 12);
    const { client } = await clients.createClient("Новий", false, now);
    expect(client.freeUntil).toBe(now + 7 * DAY);
    const old = { ...client } as Partial<typeof client>;
    delete old.freeUntil;
    store.set(clients.clientKey(client.id), { text: JSON.stringify(old), etag: "x" });
    expect((await record(client.id)).freeUntil).toBe(clients.FREE_UNTIL_EXISTING);
    expect(new Date(clients.FREE_UNTIL_EXISTING - 1).toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv" })).toBe("03.12.2026");
  });
});

describe("money", () => {
  const HOUR = 60 * 60 * 1000;
  /** A moment one hour after the client's paid month ran out. */
  const dueOf = async (id: string) => mono.addMonth((await record(id)).billing.lastPaidAt!) + HOUR;
  const cron = (auth: string | null = "Bearer cron-secret") => CHARGE_RUN(new Request("https://shur-shur.com/api/billing/charge", { headers: auth ? { authorization: auth } : {} }));

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
    expect(await mono.runCharges()).toMatchObject({ no_token: 1 });
    expect(calls).toHaveLength(0);
    expect((await record(a.id)).billing.status).toBe("none");
  });

  it("«Оформити підписку» is one invoice for 15 € that saves the card; a second click reuses the page", async () => {
    const a = await newClient("Кав'ярня");
    const first = await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    expect(first.status).toBe(303);
    expect(first.headers.get("location")).toBe("https://pay.mbnk.biz/inv_1");
    const [create] = called("/invoice/create");
    expect(create.token).toBe("live-token");
    expect(create.body).toMatchObject({
      amount: 1500,
      ccy: 978,
      saveCardData: { saveCard: true, walletId: a.id },
      redirectUrl: expect.stringContaining(`/client/${a.id}?paid=1`),
      webHookUrl: expect.stringContaining(`/api/billing/mono?c=${a.id}`),
    });

    const second = await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    expect(second.headers.get("location")).toBe("https://pay.mbnk.biz/inv_1");
    expect(called("/invoice/create")).toHaveLength(1);

    // Paid: the page opens, the card is kept, and a click creates nothing more.
    pay("inv_1");
    await page(a.id, a.session);
    expect((await record(a.id)).billing).toMatchObject({ status: "active", card: expect.any(String) });
    await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    expect(called("/invoice/create")).toHaveLength(1);
  });

  it("MONO_PRICE_UAH switches the charge to hryvnia and the label says both", async () => {
    process.env.MONO_PRICE_UAH = "730";
    const a = await newClient("Кав'ярня");
    expect((await page(a.id, a.session)).html).toContain("15 € (≈ 730 грн)");
    await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    expect(called("/invoice/create")[0].body).toMatchObject({ amount: 73000, ccy: 980 });
  });

  it("a test client never touches the live token — and has no billing without the test one", async () => {
    const t = await newClient("Проба", true);
    await SUBSCRIBE(post("/api/client/subscribe", t.cookie));
    pay("inv_1");
    await page(t.id, t.session);
    await mono.runCharges(await dueOf(t.id));
    expect(called("/wallet/payment")).toHaveLength(1);
    expect(new Set(calls.map((c) => c.token))).toEqual(new Set(["test-token"]));

    delete process.env.MONO_TEST_TOKEN;
    calls = [];
    const u = await newClient("Проба 2", true);
    await SUBSCRIBE(post("/api/client/subscribe", u.cookie));
    expect(calls).toHaveLength(0);
  });

  it("the month's charge: 15 € by the saved card, ONE per period — a second run, a parallel run or a retry ask nothing", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, 20);
    const due = await dueOf(a.id);
    const period = due - HOUR;

    // Not yet due: nothing.
    expect(await mono.runCharges(due - 2 * HOUR)).toMatchObject({ not_due: 1 });
    expect(called("/wallet/payment")).toHaveLength(0);

    // Due: two runs at once, then the same day again.
    wallet = { status: "processing" };
    const [one, two] = await Promise.all([mono.chargeClient(await record(a.id), due), mono.chargeClient(await record(a.id), due)]);
    expect([one, two].sort()).toEqual(["already", "processing"]);
    await mono.runCharges(due + HOUR);
    expect(called("/wallet/payment")).toHaveLength(1);
    expect(called("/wallet/payment")[0].body).toMatchObject({ cardToken: CARD, amount: 1500, ccy: 978, initiationKind: "merchant" });

    // monobank finishes it; the webhook reads it back, the month moves on.
    const chargeId = (await record(a.id)).billing.charge!.invoiceId!;
    invoices.set(chargeId, { status: "success", modified: due, card: null });
    const body = JSON.stringify({ invoiceId: chargeId, status: "success" });
    expect((await WEBHOOK(webhook(a.id, body, sign(bankKey, body)))).status).toBe(200);
    const paid = await record(a.id);
    expect(paid.billing.lastPaidAt).toBe(period);
    expect(paid.billing.charge).toMatchObject({ period, status: "success" });
    expect(await mono.accessOf(paid, due + DAY)).toMatchObject({ open: true, state: "paid" });

    // Later in the same days: still one charge. The next one only a month on.
    await mono.runCharges(due + 2 * DAY);
    expect(called("/wallet/payment")).toHaveLength(1);
    wallet = { status: "success" };
    await mono.runCharges(mono.addMonth(period) + HOUR);
    expect(called("/wallet/payment")).toHaveLength(2);
    expect((await record(a.id)).billing.lastPaidAt).toBe(mono.addMonth(period));
  });

  it("the daily run answers only Vercel's cron: without the secret nothing is charged", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, 40);
    expect((await cron(null)).status).toBe(401);
    expect((await cron("Bearer wrong")).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await cron()).status).toBe(503);
    expect(calls).toHaveLength(0);
    process.env.CRON_SECRET = "cron-secret";
    expect((await cron()).status).toBe(200);
  });

  it("a paid client is not closed and not charged before the month ends", async () => {
    const a = await newClient("Кав'ярня");
    await saveResults(a.id, table, "upload");
    await subscribed(a.id, 5);
    await mono.runCharges();
    expect(called("/wallet/payment")).toHaveLength(0);
    expect(await mono.accessOf(await record(a.id))).toMatchObject({ open: true, state: "paid" });
    expect((await page(a.id, a.session)).html).toContain("Олена Петренко");
  });

  it("a refused charge → three days of grace → closed; no second try in the same period", async () => {
    const a = await newClient("Кав'ярня");
    await saveResults(a.id, table, "upload");
    await subscribed(a.id, 32);
    const due = await dueOf(a.id);
    wallet = { status: "failure" };

    expect(await mono.runCharges(due)).toMatchObject({ failure: 1 });
    const failed = await record(a.id);
    expect(failed.billing.charge).toMatchObject({ status: "failure" });
    expect(failed.billing.lastFailedAt).not.toBeNull();
    expect(await mono.accessOf(failed, due + DAY)).toMatchObject({ open: true, state: "grace" });

    await mono.runCharges(due + DAY);
    await mono.runCharges(due + 2 * DAY);
    expect(called("/wallet/payment")).toHaveLength(1);
    expect(await mono.accessOf(failed, due + 3 * DAY)).toMatchObject({ open: false, state: "expired" });

    // Today is inside her grace: her page says so and offers to pay by card.
    const html = (await page(a.id, a.session)).html;
    expect(html).toContain("Списання не пройшло");
    expect(html).toContain('action="/api/client/subscribe"');
  });

  it("a charge that asks for 3-D Secure, a refused call or no answer counts as not paid and is not retried", async () => {
    for (const [answer, note] of [
      [{ status: "processing", tds: true }, "3ds"],
      [{ error: 400, errText: "card expired" }, "refused 1001"],
      [{ error: 500, errText: "internal" }, "no_answer"],
    ] as const) {
      const a = await newClient(`Кав'ярня ${note}`);
      await subscribed(a.id, 20);
      const due = await dueOf(a.id);
      wallet = answer;
      calls = [];
      await mono.chargeClient(await record(a.id), due);
      await mono.chargeClient(await record(a.id), due + DAY);
      expect(called("/wallet/payment")).toHaveLength(1);
      const { billing } = await record(a.id);
      expect(billing.charge?.note).toBe(note);
      expect(billing.lastPaidAt).toBeLessThan(due);
    }
  });

  it("monobank refuses charges by card (h2h): the run stops, one log line, the cabinet is marked; a new token lifts it", async () => {
    const a = await newClient("Кав'ярня");
    const b = await newClient("Салон");
    await subscribed(a.id, 20);
    await subscribed(b.id, 20);
    const due = await dueOf(a.id);
    wallet = { error: 400, errText: "h2h not allowed" };

    expect(await mono.runCharges(due)).toMatchObject({ h2h: 1 });
    expect(called("/wallet/payment")).toHaveLength(1);
    expect(logged.filter((line) => line.includes("h2h"))).toHaveLength(1);
    expect(await chargeBlock()).toMatchObject({ code: "h2h" });

    // The next days: nobody is asked again.
    await mono.runCharges(due + DAY);
    expect(called("/wallet/payment")).toHaveLength(1);

    // monobank switched it on, Sasha saves the token again: charges go.
    await saveMonoToken("live-token-2", null);
    expect(await chargeBlock()).toBeNull();
    wallet = { status: "success" };
    await mono.runCharges(due + DAY);
    expect(called("/wallet/payment").length).toBeGreaterThan(1);
  });

  it("cancel stops the charges, asks monobank nothing, and keeps the paid month open", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, 5);
    const due = await dueOf(a.id);

    const response = await CANCEL(post("/api/client/cancel", a.cookie));

    expect(response.headers.get("location")).toContain("?b=cancelled");
    expect(calls).toHaveLength(0);
    const fresh = await record(a.id);
    expect(fresh.billing.status).toBe("cancelled");
    expect(await mono.accessOf(fresh)).toMatchObject({ open: true, state: "paid" });

    await mono.runCharges(due);
    await mono.runCharges(due + DAY);
    expect(called("/wallet/payment")).toHaveLength(0);
    expect(await mono.accessOf(fresh, due)).toMatchObject({ open: false, state: "expired" });

    // Changed her mind inside the paid month: resumes without paying now; charged at the month's end.
    await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    expect(calls).toHaveLength(0);
    expect((await record(a.id)).billing.status).toBe("active");
    await mono.runCharges(due);
    expect(called("/wallet/payment")).toHaveLength(1);
  });

  it("cancel before the first payment invalidates the page at monobank", async () => {
    const a = await newClient("Кав'ярня");
    await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    await CANCEL(post("/api/client/cancel", a.cookie));
    expect(called("/invoice/remove")[0].body).toEqual({ invoiceId: "inv_1" });
    expect((await record(a.id)).billing).toMatchObject({ status: "none", pageUrl: null });
  });

  it("an invoice paid after all — the cancel takes the payment in instead of losing it", async () => {
    const a = await newClient("Кав'ярня");
    await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    pay("inv_1");
    await CANCEL(post("/api/client/cancel", a.cookie));
    const fresh = await record(a.id);
    expect(fresh.billing.status).toBe("cancelled");
    expect(await mono.accessOf(fresh)).toMatchObject({ open: true, state: "paid" });
  });

  it("neither token nor the card token reaches a log line, a page or an answer", async () => {
    const a = await newClient("Кав'ярня");
    const t = await newClient("Проба", true);
    const answers: string[] = [];
    const keep = async (response: Response) => {
      answers.push(response.headers.get("location") ?? "", await response.clone().text());
    };
    await keep(await SUBSCRIBE(post("/api/client/subscribe", a.cookie)));
    pay("inv_1");
    const body = JSON.stringify({ invoiceId: "inv_1", status: "success", walletData: { cardToken: CARD } });
    await keep(await WEBHOOK(webhook(a.id, body, sign(bankKey, body))));
    answers.push((await page(a.id, a.session)).html);
    await subscribed(t.id, 20);
    for (const w of [{ status: "success" }, { error: 400, errText: "h2h not allowed" }, { error: 500, errText: CARD }] as const) {
      wallet = w;
      await clients.updateClient(a.id, (c) => {
        c.billing.charge = null;
        c.billing.lastPaidAt = Date.now() - 40 * DAY;
      });
      await mono.chargeClient(await record(a.id), (await dueOf(a.id)) - 1);
      await keep(await cron());
    }
    expect(called("/wallet/payment").length).toBeGreaterThan(0);
    const outside = [...logged, ...answers].join("\n");
    for (const secret of [CARD, "live-token", "test-token", "cron-secret"]) expect(outside).not.toContain(secret);
  });
});

describe("the fiscal receipt (Checkbox through monobank)", () => {
  const HOUR = 60 * 60 * 1000;
  const TAX = "https://cabinet.tax.gov.ua/cashregs/check?id=abc";
  const check = (status: string, more: Record<string, unknown> = {}) => ({ id: "c1", status, type: "sale", fiscalizationSource: "checkbox", ...more });
  const basket = (amount: number) => ({ basketOrder: [{ name: "Підписка SHUR-SHUR, 1 місяць", qty: 1, sum: amount, code: "shur-sub-1m" }] });

  it("both payments carry the basket: one line, qty 1, sum = amount, the same code", async () => {
    const a = await newClient("Кав'ярня");
    await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    const [create] = called("/invoice/create");
    expect(create.body).toMatchObject({ amount: 1500, merchantPaymInfo: { reference: expect.any(String), ...basket(1500) } });
    expect((create.body!.merchantPaymInfo as { basketOrder: unknown[] }).basketOrder).toHaveLength(1);

    pay("inv_1", Date.now() - 40 * DAY);
    await page(a.id, a.session);
    await mono.runCharges(mono.addMonth((await record(a.id)).billing.lastPaidAt!) + HOUR);
    const [charge] = called("/wallet/payment");
    expect(charge.body).toMatchObject({ amount: 1500, merchantPaymInfo: basket(1500) });

    process.env.MONO_PRICE_UAH = "730";
    const b = await newClient("Пекарня");
    await SUBSCRIBE(post("/api/client/subscribe", b.cookie));
    expect(called("/invoice/create")[1].body).toMatchObject({ amount: 73000, merchantPaymInfo: basket(73000) });
  });

  it("a done check → «Чек» with the tax link in the cabinet, for the first payment and for the month's charge", async () => {
    const a = await newClient("Кав'ярня");
    await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    pay("inv_1", Date.now() - 40 * DAY);
    fiscal.set("inv_1", [check("done", { taxUrl: TAX })]);
    const html = (await page(a.id, a.session)).html;
    expect(called("/invoice/fiscal-checks")).toHaveLength(1);
    expect(html).toContain(`href="${TAX.replace(/&/g, "&amp;")}"`);
    expect(html).toContain(">Чек</a>");
    expect((await record(a.id)).billing.receipts).toEqual([expect.objectContaining({ invoiceId: "inv_1", status: "done", taxUrl: TAX })]);

    // The daily charge: monobank answers success at once, the check is read right after.
    fiscal.set("ch_2", [check("done", { taxUrl: `${TAX}2` })]);
    expect(await mono.runCharges(mono.addMonth((await record(a.id)).billing.lastPaidAt!) + HOUR)).toMatchObject({ success: 1 });
    expect((await record(a.id)).billing.receipts.map((r) => r.taxUrl)).toEqual([TAX, `${TAX}2`]);
    // A done check is not asked again.
    const asked = called("/invoice/fiscal-checks").length;
    await page(a.id, a.session);
    expect(called("/invoice/fiscal-checks")).toHaveLength(asked);
  });

  it("no PRRO link (no checks), monobank down, or a check on its way: the payment goes as before, no «Чек»; it comes on a later visit", async () => {
    const a = await newClient("Кав'ярня");
    await SUBSCRIBE(post("/api/client/subscribe", a.cookie));
    pay("inv_1");
    const html = (await page(a.id, a.session)).html;
    expect((await record(a.id)).billing).toMatchObject({ status: "active", receipts: [expect.objectContaining({ status: "none", taxUrl: null })] });
    expect(html).toContain("Підписка активна");
    expect(html).not.toContain(">Чек</a>");

    // fiscal-checks fails: still paid, nothing thrown, no warning about the payment.
    const b = await newClient("Пекарня");
    await SUBSCRIBE(post("/api/client/subscribe", b.cookie));
    pay("inv_2");
    fiscal.set("inv_2", "down");
    expect((await page(b.id, b.session)).html).toContain("Підписка активна");
    expect((await record(b.id)).billing.status).toBe("active");

    // On its way → looked at again by the cabinet an hour later, then shown.
    fiscal.set("inv_2", [check("process")]);
    const later = Date.now() + 2 * HOUR;
    await mono.refreshReceipt(await record(b.id), later);
    expect((await record(b.id)).billing.receipts.at(-1)).toMatchObject({ status: "process", taxUrl: null });
    expect(await mono.refreshReceipt(await record(b.id), later + 60_000)).toBeNull(); // not hourly yet
    fiscal.set("inv_2", [check("done", { taxUrl: TAX })]);
    await mono.refreshReceipt(await record(b.id), later + 2 * HOUR);
    expect((await record(b.id)).billing.receipts.at(-1)).toMatchObject({ status: "done", taxUrl: TAX });
  });

  it("a failed check is one log line with no client data — not a failed payment", async () => {
    const a = await newClient("Кав'ярня");
    await subscribed(a.id, 20);
    const due = mono.addMonth((await record(a.id)).billing.lastPaidAt!) + HOUR;
    fiscal.set("ch_1", [check("failed", { statusDescription: "Петренко: помилка" })]);
    expect(await mono.runCharges(due)).toMatchObject({ success: 1 });
    expect((await record(a.id)).billing.charge).toMatchObject({ status: "success" });
    const lines = logged.filter((l) => l.includes("fiscal"));
    expect(lines).toEqual(["[billing] fiscal check failed: source=checkbox, test=false"]);
    expect(logged.join("\n")).not.toContain("Петренко");
    expect((await page(a.id, a.session)).html).not.toContain(">Чек</a>");
  });

  it("readChecks: a return check or a non-https link is never shown", () => {
    expect(mono.readChecks({ checks: [check("done", { type: "return", taxUrl: TAX })] })).toMatchObject({ status: "none", taxUrl: null });
    expect(mono.readChecks({ checks: [check("done", { taxUrl: "javascript:alert(1)" })] })).toMatchObject({ status: "done", taxUrl: null });
    expect(mono.readChecks(null)).toMatchObject({ status: "none" });
  });
});

describe("the test pass (ops/billing/test-cycle.mjs)", () => {
  const call = (payload: unknown, secret = HMAC) => {
    const body = JSON.stringify(payload);
    const ts = String(Math.floor(Date.now() / 1000));
    return new Request("https://shur-shur.com/api/cabinet/billing-test", {
      method: "POST",
      headers: { "content-type": "application/json", "x-shur-timestamp": ts, "x-shur-signature": signLedgerBody(secret, ts, body) },
      body,
    });
  };

  it("only a signed call, only a test client, only the test token — the live one is never used", async () => {
    const demo = await newClient("Демо", true);
    const real = await newClient("Кав'ярня");

    expect((await BILLING_TEST(call({ action: "start", client_id: demo.id }, "wrong"))).status).toBe(401);
    expect(await (await BILLING_TEST(call({ action: "start", client_id: real.id }))).json()).toMatchObject({ ok: false, error: "not_a_test_client" });
    expect(await (await BILLING_TEST(call({ action: "charge", client_id: real.id }))).json()).toMatchObject({ ok: false, error: "not_a_test_client" });
    expect(calls).toHaveLength(0);

    delete process.env.MONO_TEST_TOKEN;
    expect(await (await BILLING_TEST(call({ action: "start", client_id: demo.id }))).json()).toMatchObject({ ok: false, error: "no_test_token" });
    expect(calls).toHaveLength(0);

    process.env.MONO_TEST_TOKEN = "test-token";
    const started = await (await BILLING_TEST(call({ action: "start", client_id: demo.id }))).json();
    expect(started).toMatchObject({ ok: true, page_url: "https://pay.mbnk.biz/inv_1", ccy: 978, amount: 1500 });

    pay("inv_1");
    const checked = await BILLING_TEST(call({ action: "check", client_id: demo.id }));
    const text = await checked.text();
    const answer = JSON.parse(text);
    expect(answer.keys).toMatchObject({ status: "string", walletData: { cardToken: "string" } });
    expect(answer.read).toMatchObject({ state: "success", card_token_read: true });
    expect(answer.stored).toMatchObject({ status: "active", card_saved: true });
    expect(answer.access).toMatchObject({ open: true, state: "paid" });

    const charged = await BILLING_TEST(call({ action: "charge", client_id: demo.id }));
    const chargedText = await charged.text();
    expect(JSON.parse(chargedText)).toMatchObject({ ok: true, outcome: "success" });

    for (const t of [text, chargedText, logged.join("\n")]) expect(t).not.toContain(CARD);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c.token).toBe("test-token");
  });

  it("the live probe: an invoice as the button builds it, then removed — no client is touched", async () => {
    const a = await newClient("Кав'ярня");
    const before = store.get(clients.clientKey(a.id))!.text;
    const probe = await (await BILLING_TEST(call({ action: "probe" }))).json();
    expect(probe).toMatchObject({ ok: true, page_url: "https://pay.mbnk.biz/inv_1", invoice_id: "inv_1", ccy: 978, amount: 1500 });
    expect(called("/invoice/create")[0]).toMatchObject({ token: "live-token", body: { saveCardData: { saveCard: true } } });
    expect(await (await BILLING_TEST(call({ action: "probe_remove", invoice_id: "inv_1" }))).json()).toMatchObject({ ok: true, removed: true });
    expect(invoices.get("inv_1")!.status).toBe("expired");
    expect(store.get(clients.clientKey(a.id))!.text).toBe(before);
  });

  it("the owner's card check: 1 cent opens 7 days on the live token, then the daily run charges 15 € by that card", async () => {
    const trial = await (await BILLING_TEST(call({ action: "card_trial" }))).json();
    expect(trial).toMatchObject({ ok: true, client_id: expect.any(String), setup_url: expect.stringMatching(/\/c\/[a-z0-9]+\/[A-Za-z0-9_-]{22}$/) });
    const id = trial.client_id as string;
    const token = trial.setup_url.split("/").pop()!;
    const done = await clients.completeClientSetup(id, token, PASSWORD, PASSWORD);
    if (!done.ok) throw new Error("setup failed");
    const cookie = `${clients.CLIENT_COOKIE}=${done.session}`;

    await SUBSCRIBE(post("/api/client/subscribe", cookie));
    expect(called("/invoice/create")[0]).toMatchObject({ token: "live-token", body: { amount: 1, ccy: 978, saveCardData: { saveCard: true } } });

    const at = Date.now() - 60_000;
    pay("inv_1", at);
    await page(id, done.session);
    const fresh = await record(id);
    expect(fresh.billing).toMatchObject({ status: "active", first: null, card: expect.any(String) });
    const until = mono.addMonth(fresh.billing.lastPaidAt!);
    expect(Math.abs(until - (at + 7 * DAY))).toBeLessThan(DAY);
    expect(await mono.accessOf(fresh)).toMatchObject({ open: true, state: "paid" });

    await mono.runCharges(at + 6 * DAY);
    expect(called("/wallet/payment")).toHaveLength(0);
    await mono.runCharges(until + 60 * 60 * 1000);
    expect(called("/wallet/payment")[0].body).toMatchObject({ cardToken: CARD, amount: 1500, ccy: 978 });
  });
});
