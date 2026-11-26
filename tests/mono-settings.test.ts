import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Sasha's monobank token, pasted in her cabinet — MONEY and RIGHTS only:
 *  - a token monobank refuses is not stored and switches nothing on;
 *  - an accepted token is stored sealed: not in the store in clear, not in a
 *    response, a redirect, the cabinet HTML or a log line (last 4 only);
 *  - without her session the API stores nothing and the block is not shown;
 *  - env MONO_TOKEN wins over the stored one;
 *  - «Вимкнути оплату» erases it; the offer shows her details or the placeholder.
 * monobank is mocked: no request leaves the machine.
 */

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`);
});
const cookieJar = new Map<string, string>();
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url), notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined) }),
}));

const { useMemoryStore } = await import("../src/lib/cabinet/store");
const auth = await import("../src/lib/cabinet/auth");
const { MONO_KEY } = await import("../src/lib/billing/settings");
const { monoToken } = await import("../src/lib/billing/mono");
const { POST: MONO } = await import("../src/app/api/cabinet/mono/route");
const { default: CabinetPageComponent } = await import("../src/app/cabinet/page");
const { default: OfertaPage } = await import("../src/app/[locale]/oferta/page");

const SECRET = "cabinet-test-secret";
const GOOD = "uGoodLiveToken_0123456789abcdefWXYZ";
const BAD = "uRefusedToken_0123456789abcdefQRST";
let store: ReturnType<typeof useMemoryStore>;
let logged: string[] = [];
let bankCalls: { url: string; token: string | null }[] = [];

const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  const token = new Headers(init?.headers).get("x-token");
  bankCalls.push({ url, token });
  if (!url.endsWith("/api/merchant/details")) return new Response("{}", { status: 404 });
  if (token === GOOD) return Response.json({ merchantId: "m1", merchantName: "ФОП Тест", edrpou: "1234567890" });
  return Response.json({ errCode: "FORBIDDEN", errText: "forbidden" }, { status: 403 });
});

let session = "";

function form(fields: Record<string, string>, cookie = session): Request {
  return new Request("https://shur-shur.com/api/cabinet/mono", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...(cookie ? { cookie: `${auth.SESSION_COOKIE}=${cookie}` } : {}) },
    body: new URLSearchParams(fields).toString(),
  });
}

const cabinetHtml = async (b?: string) => renderToStaticMarkup(await CabinetPageComponent({ searchParams: Promise.resolve(b ? { b } : {}) }));
const oferta = async () => renderToStaticMarkup(await OfertaPage({ params: Promise.resolve({ locale: "uk" }) }));
const everything = () => [...logged, ...[...store.values()].map((v) => v.text)].join("\n");

beforeEach(async () => {
  store = useMemoryStore();
  process.env.CABINET_HMAC_SECRET = SECRET;
  delete process.env.MONO_TOKEN;
  delete process.env.MONO_TEST_TOKEN;
  logged = [];
  bankCalls = [];
  cookieJar.clear();
  redirectMock.mockClear();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  for (const level of ["log", "info", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(" ")));
  }
  // A real session, made the way the setup link makes it.
  const token = "t".repeat(43);
  await auth.issueSetup(auth.hashSetupToken(token), Date.now() + 3600_000);
  const done = await auth.completeSetup(token, "long-enough-pass", "long-enough-pass");
  if (!done.ok) throw new Error("setup failed");
  session = done.session;
  cookieJar.set(auth.SESSION_COOKIE, session);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.CABINET_HMAC_SECRET;
  delete process.env.MONO_TOKEN;
});

describe("monobank token in the cabinet", () => {
  it("without her session: the API stores nothing, the cabinet redirects to login", async () => {
    const res = await MONO(form({ action: "save", token: GOOD }, ""));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/login");
    const forged = await MONO(form({ action: "save", token: GOOD }, `${session.split(".")[0]}.forged`));
    expect(forged.headers.get("location")).toContain("/login");
    expect(store.has(MONO_KEY)).toBe(false);
    expect(bankCalls).toHaveLength(0);

    cookieJar.clear();
    await expect(cabinetHtml()).rejects.toThrow("REDIRECT /login");
  });

  it("a token monobank refuses is not stored and billing stays off", async () => {
    const res = await MONO(form({ action: "save", token: BAD }));
    expect(res.headers.get("location")).toContain("b=refused");
    expect(bankCalls).toEqual([{ url: "https://api.monobank.ua/api/merchant/details", token: BAD }]);
    expect(store.has(MONO_KEY)).toBe(false);
    expect(await monoToken(false)).toBeNull();
    const html = await cabinetHtml("refused");
    expect(html).toContain("monobank не принял этот токен");
    expect(html).not.toContain("Оплата включена");
    expect(everything()).not.toContain(BAD);
  });

  it("an accepted token switches billing on and never shows up in clear", async () => {
    const res = await MONO(form({ action: "save", token: GOOD }));
    expect(res.headers.get("location")).toMatch(/\/cabinet\?b=saved#mono$/);
    expect(await res.text()).not.toContain(GOOD);
    expect(store.has(MONO_KEY)).toBe(true);
    expect(await monoToken(false)).toBe(GOOD);
    // A test client never reaches the live token.
    expect(await monoToken(true)).toBeNull();

    const html = await cabinetHtml("saved");
    expect(html).toContain("Оплата включена");
    expect(html).toContain("ФОП Тест");
    expect(html).toContain("…WXYZ");
    expect(html).not.toContain(GOOD);
    expect(html).toContain("Вимкнути оплату");
    expect(everything()).not.toContain(GOOD);
    expect(everything()).not.toContain(GOOD.slice(0, 20));
  });

  it("env MONO_TOKEN wins over the stored token", async () => {
    await MONO(form({ action: "save", token: GOOD }));
    process.env.MONO_TOKEN = "env-live-token";
    expect(await monoToken(false)).toBe("env-live-token");
  });

  it("«Вимкнути оплату» erases the stored token: billing off", async () => {
    await MONO(form({ action: "save", token: GOOD }));
    const res = await MONO(form({ action: "off" }));
    expect(res.headers.get("location")).toContain("b=off");
    expect(store.has(MONO_KEY)).toBe(false);
    expect(await monoToken(false)).toBeNull();
  });

  it("a changed site secret does not open the stored token: billing off, not an error", async () => {
    await MONO(form({ action: "save", token: GOOD }));
    process.env.CABINET_HMAC_SECRET = "another-secret";
    expect(await monoToken(false)).toBeNull();
  });
});

describe("offer details", () => {
  it("empty → the placeholder; saved → her details on /uk/oferta", async () => {
    expect(await oferta()).toContain("[реквізити ФОП]");
    const res = await MONO(form({ action: "offer", name: "ФОП Іваненко Олександра", code: "1234567890", contact: "м. Київ, test@example.com" }));
    expect(res.headers.get("location")).toContain("b=offer_saved");
    const html = await oferta();
    expect(html).not.toContain("[реквізити ФОП]");
    expect(html).toContain("ФОП Іваненко Олександра, РНОКПП 1234567890");
    expect(html).toContain("м. Київ, test@example.com");
  });

  it("without her session the details are not changed", async () => {
    const res = await MONO(form({ action: "offer", name: "Хтось", code: "", contact: "" }, ""));
    expect(res.headers.get("location")).toContain("/login");
    expect(await oferta()).toContain("[реквізити ФОП]");
  });
});
