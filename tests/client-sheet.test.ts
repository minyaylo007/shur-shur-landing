import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * A client's bot that writes into a public Google Sheet (Marina's, 26.11.2026)
 * — PERSONAL DATA and the cabinet staying up:
 *  - a row becomes an attempt with no name, no username, no telegram id —
 *    not in the store, not on the page, not in the .csv, not in a log line;
 *  - the same row read twice is stored once; a row gone from the sheet stays;
 *  - the sheet down (error, timeout, no longer public) → the page renders
 *    what is stored with a quiet line, never an error page.
 * Google is mocked: no request leaves the machine.
 */

const cookieJar = new Map<string, string>();
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined) }),
}));

const { useMemoryStore } = await import("../src/lib/cabinet/store");
const { signLedgerBody } = await import("../src/lib/ledger");
const clients = await import("../src/lib/client/clients");
const { attemptsKey, readAttempts } = await import("../src/lib/client/attempts");
const sheet = await import("../src/lib/client/sheet");
const { GET: EXPORT } = await import("../src/app/api/client/export/route");
const { POST: CLIENT_KEY } = await import("../src/app/api/cabinet/client-key/route");
const { default: ClientPage } = await import("../src/app/client/[id]/page");

const HMAC = "cabinet-test-secret";
const PASSWORD = "correct horse battery";
const SHEET = { id: "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789", name: "Відповіді" };
/* What must never leak: the respondents' telegram ids, usernames and names. */
const PD = ["508812345", "714400099", "olena_petrenko", "ivan_k", "Олена Петренко", "Іван Коваль"];

const q = (cells: string[]) => cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(",");
const HEADER = q(["час (Київ)", "telegram id", "username", "ім'я", "тест", "бали", "максимум", "результат (діапазон)", "відповідь 1", "відповідь 2"]);
const ROW1 = q(["2026-11-12 20:18:38", "508812345", "olena_petrenko", "Олена Петренко", "Ви більше заробляєте чи просто багато працюєте?", "6", "12", "6–9", "В. Практично не змінився", "Б. Приблизно розумію"]);
const ROW2 = q(["2026-11-13 16:40:10", "714400099", "ivan_k", "Іван Коваль", "Ваш бізнес готовий до зростання?", "6", "12", "6–9", "А. Ми спокійно впораємось", "Б. Є кілька сильних ідей"]);
const ROW3 = q(["2026-07-25 06:55:21", "508812345", "olena_petrenko", "Олена Петренко", "Ваш бізнес готовий до зростання?", "5", "12", "0–5", "Г. Навіть не знаю", ""]);
const csv = (...rows: string[]) => [HEADER, ...rows].join("\n") + "\n";

let answer: () => Promise<Response>;
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = new URL(String(input));
  if (url.origin !== "https://docs.google.com") throw new Error(`unexpected request to ${url.origin}`);
  return answer();
});

let store: ReturnType<typeof useMemoryStore>;
let logged: string[];

async function marina() {
  const { client, token } = await clients.createClient("Марина", false);
  const done = await clients.completeClientSetup(client.id, token, PASSWORD, PASSWORD);
  if (!done.ok) throw new Error("setup failed");
  await clients.setClientSheet(client.id, SHEET);
  return { id: client.id, session: done.session, cookie: `${clients.CLIENT_COOKIE}=${done.session}` };
}

async function page(id: string, session: string): Promise<string> {
  cookieJar.clear();
  cookieJar.set(clients.CLIENT_COOKIE, session);
  return renderToStaticMarkup(await ClientPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }));
}

const download = (id: string, cookie: string) => EXPORT(new Request(`https://shur-shur.com/api/client/export?id=${id}`, { headers: { cookie } }));

function signedRequest(payload: unknown): Request {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  return new Request("https://shur-shur.com/api/cabinet/client-key", { method: "POST", headers: { "x-shur-timestamp": ts, "x-shur-signature": signLedgerBody(HMAC, ts, body) }, body });
}

const noPD = (text: string) => {
  for (const value of PD) expect(text).not.toContain(value);
};

beforeEach(() => {
  store = useMemoryStore();
  process.env.CABINET_HMAC_SECRET = HMAC;
  sheet.forgetSheetReads();
  logged = [];
  answer = async () => new Response(csv(ROW1, ROW2, ROW3), { status: 200, headers: { "content-type": "text/csv" } });
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    });
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a sheet row becomes an attempt without the person", () => {
  it("test, score, range, Kyiv time with its offset, «Питання N» answers; no name, username or telegram id", async () => {
    const { parseCsv } = await import("../src/lib/client/results");
    const attempts = sheet.attemptsFromSheet(parseCsv(csv(ROW1, ROW3), 100))!;
    expect(attempts).toHaveLength(2);
    const [winter, summer] = attempts;
    expect(winter).toMatchObject({ test: "Ви більше заробляєте чи просто багато працюєте?", score: 6, max: 12, range: "6–9" });
    expect(winter.at).toBe(Date.parse("2026-11-12T20:18:38+02:00"));
    expect(summer.at).toBe(Date.parse("2026-07-25T06:55:21+03:00"));
    expect(winter.answers).toEqual([
      { q: "Питання 1", a: "В. Практично не змінився", points: null },
      { q: "Питання 2", a: "Б. Приблизно розумію", points: null },
    ]);
    expect(summer.answers).toHaveLength(1); // an empty cell is no answer
    // One person, two attempts: the same opaque participant, two different attempt ids.
    expect(winter.participant).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(winter.participant).toBe(summer.participant);
    expect(winter.id).not.toBe(summer.id);
    noPD(JSON.stringify(attempts));
  });

  it("the hash is keyed by the server secret: no secret, nothing is read", async () => {
    const { parseCsv } = await import("../src/lib/client/results");
    delete process.env.CABINET_HMAC_SECRET;
    expect(sheet.attemptsFromSheet(parseCsv(csv(ROW1), 100))).toBeNull();
  });

  it("kyivIso keeps the wall clock and adds the offset", () => {
    expect(sheet.kyivIso("2026-11-12 20:18:38")).toBe("2026-11-12T20:18:38+02:00");
    expect(sheet.kyivIso("2026-07-25 06:55:21")).toBe("2026-07-25T06:55:21+03:00");
    expect(sheet.kyivIso("12.11.2026")).toBeNull();
  });
});

describe("the cabinet reads the sheet", () => {
  it("page and .csv: three attempts, two tests, no personal data anywhere — store, page, file, logs", async () => {
    const m = await marina();
    const html = await page(m.id, m.session);
    expect(html).toContain("Результати бота");
    expect(html).toContain("Ваш бізнес готовий до зростання?");
    expect(html).toContain("Ви більше заробляєте чи просто багато працюєте?");
    expect(html).not.toContain("тимчасово недоступна");
    noPD(html);

    expect((await readAttempts(m.id))!.attempts).toHaveLength(3);
    noPD(store.get(attemptsKey(m.id))?.text ?? "");
    noPD(store.get(clients.clientKey(m.id))?.text ?? "");

    const response = await download(m.id, m.cookie);
    expect(response.status).toBe(200);
    const file = await response.text();
    expect(file.trim().split("\r\n")).toHaveLength(4); // header + 3 attempts
    expect(file).toContain("Питання 1");
    noPD(file);
    noPD(logged.join("\n"));
  });

  it("read again: nothing doubles; a row deleted from the sheet stays on the site; reads are cached", async () => {
    const m = await marina();
    await page(m.id, m.session);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await page(m.id, m.session);
    expect(fetchMock).toHaveBeenCalledTimes(1); // the 5-minute cache

    answer = async () => new Response(csv(ROW2), { status: 200 });
    const read = await sheet.syncSheet(m.id, SHEET, { force: true });
    expect(read).toMatchObject({ outcome: "ok", stored: 0 });
    expect((await readAttempts(m.id))!.attempts).toHaveLength(3);
  });

  for (const [why, fail] of [
    ["HTTP 500", async () => new Response("oops", { status: 500 })],
    ["no longer public (a login page)", async () => new Response("<!DOCTYPE html><html>Sign in</html>", { status: 200 })],
    ["timeout", async () => { throw Object.assign(new Error("timed out"), { name: "TimeoutError" }); }],
    ["not the bot's columns", async () => new Response("a,b\n1,2\n", { status: 200 })],
  ] as const) {
    it(`the sheet down (${why}) → the page renders the stored attempts with a quiet line`, async () => {
      const m = await marina();
      await page(m.id, m.session); // three stored
      sheet.forgetSheetReads();
      answer = fail;
      const html = await page(m.id, m.session);
      expect(html).toContain("Таблиця тимчасово недоступна");
      expect(html).toContain("Ваш бізнес готовий до зростання?");
      expect((await download(m.id, m.cookie)).status).toBe(200);
      noPD(logged.join("\n"));
    });
  }

  it("the sheet down on the first visit → an empty cabinet with the line, not an error page", async () => {
    const m = await marina();
    answer = async () => new Response("oops", { status: 503 });
    const html = await page(m.id, m.session);
    expect(html).toContain("Таблиця тимчасово недоступна");
  });
});

describe("the owner points a cabinet at a sheet (ops/cabinet/client-key.mjs --sheet-file)", () => {
  it("signed only; reads at once and answers counts; the list says a sheet is set", async () => {
    const { client } = await clients.createClient("Марина", false);
    const unsigned = await CLIENT_KEY(new Request("https://shur-shur.com/api/cabinet/client-key", { method: "POST", body: JSON.stringify({ action: "sheet", client_id: client.id, sheet: SHEET }) }));
    expect(unsigned.status).toBe(401);
    expect((await clients.readClient(client.id))!.client.sheet).toBeNull();

    const set = await CLIENT_KEY(signedRequest({ action: "sheet", client_id: client.id, sheet: SHEET }));
    expect(await set.json()).toEqual({ ok: true, sheet: "ok", rows: 3, stored: 3 });
    const list = await (await CLIENT_KEY(signedRequest({ action: "list" }))).json();
    expect(list.clients[0]).toMatchObject({ id: client.id, sheet: true });
    noPD(logged.join("\n"));

    const off = await CLIENT_KEY(signedRequest({ action: "sheet", client_id: client.id, sheet: null }));
    expect(off.status).toBe(200);
    expect((await clients.readClient(client.id))!.client.sheet).toBeNull();
    expect((await readAttempts(client.id))!.attempts).toHaveLength(3);
  });
});
