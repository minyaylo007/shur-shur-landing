import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/lead/route";
import {
  ATTRIBUTION_MAX,
  captureAttribution,
  fbcFromFbclid,
  marketOf,
  pickAttribution,
} from "../src/lib/attribution";
import { LEDGER_TIMEOUT_MS, signLedgerBody } from "../src/lib/ledger";
import { formatLeadMessage } from "../src/lib/telegram";
import { leadSchema } from "../src/lib/validation";
import {
  CONVERSION_EVENTS_ENABLED,
  DEFAULT_META_PIXEL_ID,
  META_PIXEL_SRC,
  configuredPixelId,
  normalizePixelId,
  revokeMetaPixel,
  sendToPixel,
  startMetaPixel,
  trackMetaPageView,
  type PixelDocument,
  type PixelWindow,
} from "../src/lib/meta-pixel";
import type { AnalyticsEvent } from "../src/lib/analytics";
import { readConsent } from "../src/lib/consent";
import { ConsentLayer } from "../src/components/consent/ConsentLayer";
import { getDictionary } from "../src/dictionaries";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/*
 * The «site → lead ledger» contract, v1 (29.09.2026), site side.
 *
 * Critical because every line here changes what happens to a lead: Telegram
 * must keep receiving it whatever the ledger does, the ledger must be able to
 * trust the signature, the market decides the budget, the pixel must stay
 * silent without consent, and a name or a phone number must never end up in
 * a URL or a log line.
 */

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const PII = { contact: "+380501112233", igHandle: "olena.private.test" };

let ip = 0;
function leadRequest(extra: Record<string, unknown> = {}): Request {
  ip += 1;
  return new Request("https://shur-shur.com/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `10.9.0.${ip}` },
    body: JSON.stringify({
      kind: "audit",
      igHandle: PII.igHandle,
      contact: PII.contact,
      elapsedMs: 5000,
      locale: "ro",
      attribution: {
        utm_source: "facebook",
        utm_campaign: "sv_launch",
        utm_content: "reel_1",
        fbclid: "IwAR-click-123",
        landing_path: "/ro",
      },
      consent: { ads: true },
      ...extra,
    }),
  });
}

interface Call {
  url: string;
  init: RequestInit;
}

/** Telegram answers ok; the ledger does whatever `ledger` says. */
function installFetch(ledger: (init: RequestInit) => Promise<Response>) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith("https://api.telegram.org/")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return ledger(init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

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
  vi.stubEnv("LEDGER_URL", "https://ledger.test.invalid");
  vi.stubEnv("LEDGER_HMAC_SECRET", "test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const telegramCalls = (calls: Call[]) => calls.filter((c) => c.url.includes("api.telegram.org"));
const ledgerCalls = (calls: Call[]) => calls.filter((c) => c.url.startsWith("https://ledger."));

describe("the lead reaches Telegram whatever the ledger does", () => {
  it("ledger NOT configured: Telegram gets it, answer 200 + lead_id, log names the variables only", async () => {
    vi.stubEnv("LEDGER_URL", "");
    vi.stubEnv("LEDGER_HMAC_SECRET", "");
    const calls = installFetch(async () => new Response("", { status: 200 }));

    const response = await POST(leadRequest());
    const body = (await response.json()) as { ok: boolean; lead_id: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.lead_id).toMatch(UUID_V4);
    expect(telegramCalls(calls)).toHaveLength(1);
    expect(ledgerCalls(calls)).toHaveLength(0);
    expect(logged.join("\n")).toContain("LEDGER_URL, LEDGER_HMAC_SECRET");
  });

  it("ledger unreachable: same 200", async () => {
    const calls = installFetch(async () => {
      throw new TypeError("fetch failed: getaddrinfo ENOTFOUND ledger.test.invalid");
    });
    const response = await POST(leadRequest());
    expect(response.status).toBe(200);
    expect(telegramCalls(calls)).toHaveLength(1);
    expect(ledgerCalls(calls)).toHaveLength(1);
  });

  it("ledger answers 500: same 200", async () => {
    installFetch(async () => new Response("boom", { status: 500 }));
    const response = await POST(leadRequest());
    expect(response.status).toBe(200);
    expect(((await response.json()) as { ok: boolean }).ok).toBe(true);
  });

  it("ledger hangs: cut at 2 s by the signal, still 200", async () => {
    // AbortSignal.timeout is not driven by fake timers, so the 2 s signal is
    // replaced with an already-fired one — and the requested value is kept.
    const requested: number[] = [];
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
      requested.push(ms);
      return ms === LEDGER_TIMEOUT_MS
        ? AbortSignal.abort(new DOMException("timed out", "TimeoutError"))
        : realTimeout(ms);
    });
    installFetch(
      (init) =>
        new Promise<Response>((_, reject) => {
          const signal = init.signal!;
          if (signal.aborted) reject(signal.reason);
          signal.addEventListener("abort", () => reject(signal.reason));
        }),
    );

    const response = await POST(leadRequest());
    expect(response.status).toBe(200);
    expect(LEDGER_TIMEOUT_MS).toBe(2000);
    expect(requested).toContain(2000);
    expect(logged.join("\n")).toContain("ledger unreachable: TimeoutError");
  });

  it("Telegram AND the ledger down is still a 502 — nobody holds the lead (v1.1: ledger tried first)", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        calls.push(String(input));
        return new Response("down", { status: 500 });
      }),
    );
    const response = await POST(leadRequest());
    expect(response.status).toBe(502);
    expect(calls[0]).toBe("https://ledger.test.invalid/v1/leads");
    expect(calls.some((url) => url.includes("/delivered"))).toBe(false);
  });
});

describe("ledger request — contract body and HMAC", () => {
  it("signature = sha256=HMAC(secret, timestamp + '.' + raw body) — fixed vector", () => {
    // Computed outside the code under test: openssl dgst -sha256 -hmac test-secret
    expect(signLedgerBody("test-secret", "1759140000", '{"lead_id":"x"}')).toBe(
      "sha256=a7ab3ccbbbf6306ff2aab66592c76d7ca5f6e30f6d05d2ca864bbfcca493839a",
    );
  });

  it("the request that goes out verifies against its own headers, and carries the contract fields", async () => {
    const calls = installFetch(async () => new Response("{}", { status: 200 }));
    const response = await POST(leadRequest());
    const { lead_id } = (await response.json()) as { lead_id: string };

    const [call] = ledgerCalls(calls);
    expect(call.url).toBe("https://ledger.test.invalid/v1/leads");
    const headers = call.init.headers as Record<string, string>;
    const timestamp = headers["X-Shur-Timestamp"];
    const raw = call.init.body as string;
    const expected = createHmac("sha256", "test-secret").update(`${timestamp}.${raw}`).digest("hex");
    expect(headers["X-Shur-Signature"]).toBe(`sha256=${expected}`);
    expect(Math.abs(Number(timestamp) - Date.now() / 1000)).toBeLessThan(300);

    const body = JSON.parse(raw);
    expect(body.lead_id).toBe(lead_id);
    expect(body.lead_id).toMatch(UUID_V4);
    expect(new Date(body.created_at).toISOString()).toBe(body.created_at);
    expect(body).toMatchObject({
      kind: "audit",
      locale: "ro",
      market: "suceava",
      contact: PII.contact,
      ig_handle: PII.igHandle,
      consent: { ads: true },
      attribution: { utm_source: "facebook", utm_campaign: "sv_launch", fbclid: "IwAR-click-123" },
    });
  });

  it("every accepted lead gets its own lead_id", async () => {
    installFetch(async () => new Response("{}", { status: 200 }));
    const a = (await (await POST(leadRequest())).json()) as { lead_id: string };
    const b = (await (await POST(leadRequest())).json()) as { lead_id: string };
    expect(a.lead_id).not.toBe(b.lead_id);
  });
});

describe("market — contract rule order", () => {
  it.each([
    [{ landing_path: "/ro/suceava" }, "suceava"],
    [{ landing_path: "/ro/suceava/promo" }, "suceava"],
    [{ landing_path: "/he/tel-aviv" }, "tel_aviv"],
    [{ utm_campaign: "sv_spring" }, "suceava"],
    [{ utm_campaign: "ta_spring" }, "tel_aviv"],
    // 1) the path wins over 2) the campaign
    [{ landing_path: "/he/tel-aviv", utm_campaign: "sv_spring" }, "tel_aviv"],
    [{ landing_path: "/ro", utm_campaign: "spring_sv_" }, "other"],
    [{ landing_path: "/uk" }, "other"],
    [{ landing_path: "/en" }, "other"],
    [{}, "other"],
  ] as const)("%o → %s", (attribution, market) => {
    expect(marketOf(attribution)).toBe(market);
  });

  it("no attribution at all → other", () => {
    expect(marketOf(undefined)).toBe("other");
  });
});

describe("attribution is a passenger, never a reason to refuse", () => {
  it("an over-long or garbled field is cut or dropped, the lead still validates", () => {
    const parsed = leadSchema.safeParse({
      kind: "audit",
      igHandle: "shur.shur",
      contact: "@someone",
      elapsedMs: 5000,
      attribution: { utm_source: "x".repeat(1000), utm_medium: 42, junk: "y" },
      consent: "yes please",
    });
    expect(parsed.success).toBe(true);
    const data = parsed.data!;
    expect(data.attribution?.utm_source).toHaveLength(ATTRIBUTION_MAX);
    expect(data.attribution?.utm_medium).toBeUndefined();
    expect(data.attribution).not.toHaveProperty("junk");
    expect(data.consent).toEqual({ ads: false });
  });

  it("no consent sent = consent.ads false", () => {
    const parsed = leadSchema.parse({ kind: "audit", igHandle: "shur.shur", contact: "@xyz", elapsedMs: 5000 });
    expect(parsed.consent).toEqual({ ads: false });
  });
});

describe("capture — first touch, path only, click ids only with consent", () => {
  const now = Date.UTC(2026, 8, 29, 10, 0, 0);

  it("reads utm_*, fbclid, gclid; builds fbc in Meta's format; keeps the PATH, not the query", () => {
    const record = captureAttribution(
      "https://shur-shur.com/ro/suceava?utm_source=fb&utm_campaign=sv_x&fbclid=ABC&gclid=G1&email=a%40b.c",
      "https://l.facebook.com/some/path?u=1",
      now,
    );
    expect(record).toMatchObject({
      utm_source: "fb",
      utm_campaign: "sv_x",
      fbclid: "ABC",
      gclid: "G1",
      fbc: `fb.1.${now}.ABC`,
      landing_path: "/ro/suceava",
      referrer_host: "l.facebook.com",
      first_seen_at: "2026-09-29T10:00:00.000Z",
    });
    expect(JSON.stringify(record)).not.toContain("a@b.c");
    expect(JSON.stringify(record)).not.toContain("email");
    expect(fbcFromFbclid("Z", 1)).toBe("fb.1.1.Z");
  });

  it("our own host is not a referrer", () => {
    const record = captureAttribution("https://shur-shur.com/uk", "https://shur-shur.com/en", now);
    expect(record.referrer_host).toBeUndefined();
  });

  it("without consent the ad identifiers stay on the device", () => {
    const stored = captureAttribution("https://shur-shur.com/ro?utm_campaign=sv_x&fbclid=ABC&gclid=G", "", now);
    const sent = pickAttribution(stored, false, "fb.1.1.999")!;
    expect(sent.utm_campaign).toBe("sv_x");
    for (const field of ["fbclid", "gclid", "fbc", "fbp"] as const) {
      expect(sent[field]).toBeUndefined();
    }
    const withConsent = pickAttribution(stored, true, "fb.1.1.999")!;
    expect(withConsent).toMatchObject({ fbclid: "ABC", gclid: "G", fbp: "fb.1.1.999" });
  });
});

describe("Telegram source line", () => {
  it("utm source/campaign/content and the market; click ids only as «є fbclid»", () => {
    const msg = formatLeadMessage({
      kind: "audit",
      igHandle: "shur.shur",
      locale: "ro",
      source: {
        market: "suceava",
        attribution: { utm_source: "facebook", utm_campaign: "sv_launch", utm_content: "reel_1", fbclid: "IwAR-secret-click" },
      },
    });
    expect(msg).toContain("source=facebook");
    expect(msg).toContain("campaign=sv_launch");
    expect(msg).toContain("content=reel_1");
    expect(msg).toContain("ринок: suceava");
    expect(msg).toContain("є fbclid");
    expect(msg).not.toContain("IwAR-secret-click");
  });

  it("organic lead: says so, market other", () => {
    const msg = formatLeadMessage({ kind: "audit", igHandle: "a.b", locale: "uk", source: { market: "other" } });
    expect(msg).toContain("прямий захід · ринок: other");
  });
});

describe("Meta Pixel — nothing without consent, one PageView per page", () => {
  function fakes() {
    const appended: { async: boolean; src: string }[] = [];
    const doc: PixelDocument = {
      createElement: () => ({ async: false, src: "" }),
      head: { appendChild: (node) => appended.push(node as { async: boolean; src: string }) },
    };
    const win: PixelWindow = {};
    return { appended, doc, win };
  }
  const calls = (win: PixelWindow, method: string) => win.fbq!.queue!.filter((call) => call[0] === method);
  const pageViews = (win: PixelWindow) => calls(win, "track").filter((call) => call[1] === "PageView");
  const start = (win: PixelWindow, doc: PixelDocument, path = "/uk") =>
    startMetaPixel({ pixelId: DEFAULT_META_PIXEL_ID, adsAllowed: true, win, doc, path });

  it.each([
    ["no consent", DEFAULT_META_PIXEL_ID, false],
    ["no pixel id", null, true],
    ["neither", null, false],
  ] as const)("%s → no script, no fbq, no sink", (_label, pixelId, adsAllowed) => {
    const { appended, doc, win } = fakes();
    expect(startMetaPixel({ pixelId, adsAllowed, win, doc, path: "/uk" })).toBe(false);
    expect(appended).toHaveLength(0);
    expect(win.fbq).toBeUndefined();
    expect(win.shurTrack).toBeUndefined();
    // A path change before consent does not conjure the pixel up either.
    expect(trackMetaPageView(win, "/en")).toBe(false);
    expect(win.fbq).toBeUndefined();
  });

  it("the env value is validated: only digits count as an id", () => {
    expect(normalizePixelId(undefined)).toBeNull();
    expect(normalizePixelId("")).toBeNull();
    expect(normalizePixelId("123'); alert(1);//")).toBeNull();
    expect(normalizePixelId(" 1234567890 ")).toBe("1234567890");
  });

  it("the owner's pixel is the default; NEXT_PUBLIC_META_PIXEL_ID overrides it", () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "");
    expect(configuredPixelId()).toBe("1133465872469034");
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "9876543210");
    expect(configuredPixelId()).toBe("9876543210");
    vi.unstubAllEnvs();
  });

  it("consent: one official script, exactly one init and one PageView", () => {
    const { appended, doc, win } = fakes();
    expect(start(win, doc)).toBe(true);
    expect(appended).toEqual([{ async: true, src: META_PIXEL_SRC }]);
    expect(calls(win, "init")).toEqual([["init", "1133465872469034"]]);
    expect(pageViews(win)).toHaveLength(1);
    // Meta's own History listener is off: our path dedup is the only source.
    expect(win.fbq!.disablePushState).toBe(true);
    // Automatic events ON by the targetologist's scheme (01.10.2026): no
    // «set autoConfig false» anywhere in the queue.
    expect(win.fbq!.queue!.some((c) => c[0] === "set" && c[1] === "autoConfig")).toBe(false);
  });

  it("StrictMode double effect, remount, second «allow» on the same path → still one init, one PageView", () => {
    const { appended, doc, win } = fakes();
    start(win, doc);
    expect(start(win, doc)).toBe(false);
    expect(trackMetaPageView(win, "/uk")).toBe(false);
    expect(start(win, doc)).toBe(false);
    expect(appended).toHaveLength(1);
    expect(calls(win, "init")).toHaveLength(1);
    expect(pageViews(win)).toHaveLength(1);
  });

  it("a path change (language switch) → +1 PageView; an #anchor is not a path change → +0", () => {
    const { doc, win } = fakes();
    start(win, doc, "/uk");
    expect(trackMetaPageView(win, "/en")).toBe(true);
    expect(pageViews(win)).toHaveLength(2);
    // usePathname() carries no hash: /en#contact arrives as /en again.
    expect(trackMetaPageView(win, "/en")).toBe(false);
    expect(pageViews(win)).toHaveLength(2);
  });

  it("refusal after consent → consent revoke, and nothing is counted until a new «allow»", () => {
    const { doc, win } = fakes();
    start(win, doc, "/uk");
    revokeMetaPixel(win);
    expect(win.fbq!.queue!.at(-1)).toEqual(["consent", "revoke"]);
    expect(trackMetaPageView(win, "/en")).toBe(false);
    expect(pageViews(win)).toHaveLength(1);
    start(win, doc, "/en");
    expect(calls(win, "consent").map((call) => call[1])).toEqual(["grant", "revoke", "grant"]);
    expect(calls(win, "init")).toHaveLength(1);
    expect(pageViews(win)).toHaveLength(2);
  });

  it("revoke with no pixel on the page does nothing", () => {
    const { win } = fakes();
    revokeMetaPixel(win);
    expect(win.fbq).toBeUndefined();
  });

  it("the sink: Contact on a channel click; audit_submit is NOT a Lead here (the thank-you page sends it); the earlier sink still runs", () => {
    expect(CONVERSION_EVENTS_ENABLED).toBe(true);
    const { doc, win } = fakes();
    const earlier: AnalyticsEvent[] = [];
    win.shurTrack = (e: AnalyticsEvent) => void earlier.push(e);
    start(win, doc);
    win.shurTrack!({ name: "audit_submit", locale: "ro", placement: "contact_section", lead_id: "0b8e2f4c" });
    win.shurTrack!({ name: "contact_click", channel: "whatsapp", locale: "ro", placement: "footer" });
    expect(calls(win, "track")).toEqual([
      ["track", "PageView"],
      ["track", "Contact", { content_category: "whatsapp" }],
    ]);
    expect(earlier).toHaveLength(2);
  });

  it("the mapping: Contact carries the channel name only; audit_submit maps to nothing", () => {
    const sent: unknown[][] = [];
    const fbq = (...args: unknown[]) => void sent.push(args);
    sendToPixel(fbq, { name: "audit_submit", locale: "ro", placement: "contact_section", lead_id: "L1" });
    sendToPixel(fbq, { name: "contact_click", channel: "whatsapp", locale: "ro", placement: "footer" });
    expect(sent).toEqual([["track", "Contact", { content_category: "whatsapp" }]]);
  });

  it("SSR: no window — the consent layer renders to nothing and does not throw", () => {
    expect(typeof window).toBe("undefined");
    expect(readConsent()).toBeNull();
    const html = renderToStaticMarkup(createElement(ConsentLayer, { dict: getDictionary("uk").consent }));
    expect(html).toBe("");
  });
});

describe("personal data never reaches a URL or a log line", () => {
  const scenarios: [string, () => void][] = [
    ["ledger ok", () => void installFetch(async () => new Response("{}", { status: 200 }))],
    ["ledger 500", () => void installFetch(async () => new Response(JSON.stringify(PII), { status: 500 }))],
    [
      "ledger throws",
      () =>
        void installFetch(async () => {
          throw new Error(`boom ${PII.contact}`);
        }),
    ],
  ];

  it.each(scenarios)("%s", async (_label, setup) => {
    setup();
    const response = await POST(leadRequest());
    expect(response.status).toBe(200);
    const urls = (vi.mocked(fetch).mock.calls as unknown[][]).map((call) => String(call[0]));
    for (const text of [...urls, ...logged]) {
      expect(text).not.toContain(PII.contact);
      expect(text).not.toContain(PII.igHandle);
      expect(text).not.toContain("IwAR-click-123");
    }
  });

  it("Telegram down: the failure log carries no personal data either", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("err", { status: 500 })),
    );
    await POST(leadRequest());
    expect(logged.length).toBeGreaterThan(0);
    for (const line of logged) {
      expect(line).not.toContain(PII.contact);
      expect(line).not.toContain(PII.igHandle);
    }
  });
});
