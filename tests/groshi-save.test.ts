import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * «Гроші» — SAVING (money; owner's rule 13.10.2026). 26.11.2026 every write of
 * Sasha's failed: Blob answers a read with a WEAK etag (W/"…", the body is
 * compressed) and a conditional write wants the strong one, so each write was a
 * «conflict» three times over → 503 «спробуй за хвилину». Here: the real Blob
 * adapter against a fake Blob API that behaves like that; a refusal of her
 * input is 400 with a reason, not «try later»; what was not saved stays in her
 * browser for one «Зберегти ще раз».
 */

const blob = new Map<string, { text: string; etag: string }>();
let version = 0;
let blobDown = false;
vi.mock("@vercel/blob", async (importOriginal) => {
  const real = await importOriginal<typeof import("@vercel/blob")>();
  return {
    ...real,
    get: async (key: string) => {
      if (blobDown) throw new Error("blob down");
      const b = blob.get(key);
      if (!b) return null;
      // what Blob really answers for a compressed body: the same version, weak
      return { statusCode: 200, stream: new Response(b.text).body, blob: { etag: `W/${b.etag}` } };
    },
    put: async (key: string, text: string, opts: { ifMatch?: string }) => {
      if (blobDown) throw new Error("blob down");
      const b = blob.get(key);
      if (opts.ifMatch !== undefined && opts.ifMatch !== b?.etag) throw new real.BlobPreconditionFailedError();
      blob.set(key, { text, etag: `"v${++version}"` });
      return {};
    },
  };
});
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const { AUTH_KEY, strongEtag } = await import("../src/lib/cabinet/store");
const auth = await import("../src/lib/cabinet/auth");
const { BOOK_KEY } = await import("../src/lib/money/store");
const { POST: GROSHI } = await import("../src/app/api/cabinet/groshi/route");
const { keepUnsaved, readUnsaved, dropUnsaved, retryable, problemText, UNSAVED_KEY } = await import("../src/lib/money/pending");

const SESSION_KEY = randomBytes(32).toString("hex");
const BOOK = { version: 1, projects: [{ id: "p1", name: "Проект", amount: 10_000_00, currency: "UAH" }], plan: [], rules: {}, payers: {}, entries: [] };
const cookie = () => `${auth.SESSION_COOKIE}=${auth.makeSession(SESSION_KEY)}`;
const api = (body: unknown) =>
  GROSHI(new Request("https://shur-shur.com/api/cabinet/groshi", { method: "POST", headers: { "content-type": "application/json", cookie: cookie() }, body: JSON.stringify(body) }));
const stored = () => JSON.parse(blob.get(BOOK_KEY)!.text);

// the two actions that failed on 26.11 (13 times), and the one the page is for
const payerAssign = { type: "payer.assign", keys: ["UA213223130000026007233566001"], name: "ФОП Платник", projects: ["p1"] };
const ruleSet = { type: "rule.set", key: "маша д.", name: "Маша Д.", category: "team" };
const addCash = { type: "entry.add", entry: { date: "2026-11-26", amount: 5_000_00, currency: "UAH", projects: ["p1"], cash: true } };

beforeEach(() => {
  blob.clear();
  blobDown = false;
  blob.set(AUTH_KEY, { text: JSON.stringify({ password: { salt: "", hash: "" }, sessionKey: SESSION_KEY, setup: null, failures: { since: 0, count: 0 } }), etag: '"a"' });
  blob.set(BOOK_KEY, { text: JSON.stringify(BOOK), etag: '"b"' });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("saving to Blob with a weak etag on read", () => {
  it("W/\"x\" is the same version as \"x\"", () => {
    expect(strongEtag('W/"abc"')).toBe('"abc"');
    expect(strongEtag('"abc"')).toBe('"abc"');
  });

  it("payer.assign, rule.set and entry.add — the actions that failed 26.11 — are saved first time, one after another", async () => {
    for (const action of [payerAssign, ruleSet, addCash]) expect((await api(action)).status).toBe(200);
    const book = stored();
    expect(Object.keys(book.payers)).toHaveLength(1);
    expect(book.rules["маша д."].category).toBe("team");
    expect(book.entries).toHaveLength(1);
  });

  it("a long bank description as the key is not refused (limits were tighter than any reason)", async () => {
    const key = "Переказ на картку ".repeat(14).trim(); // ~250 chars
    expect((await api({ ...ruleSet, key, name: key })).status).toBe(200);
  });
});

describe("what she reads when it does not save", () => {
  it("her input refused → 400 with the reason, nothing stored, not «try in a minute»", async () => {
    const unknown = await api({ ...addCash, entry: { ...addCash.entry, projects: ["nope"] } });
    expect(unknown.status).toBe(400);
    expect((await unknown.json()).error).toBe("unknown_project");
    const bad = await api({ ...addCash, entry: { ...addCash.entry, amount: -1 } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("invalid");
    // the whole book refused by its own schema (full) — also 400, not 503
    blob.set(BOOK_KEY, { text: JSON.stringify({ ...BOOK, entries: Array.from({ length: 5000 }, (_, i) => ({ id: `e${i}`, ...addCash.entry })) }), etag: '"full"' });
    const full = await api(addCash);
    expect(full.status).toBe(400);
    expect(stored().entries).toHaveLength(5000);
    expect(problemText("invalid", 400)).not.toMatch(/хвилин/);
    expect(retryable(400)).toBe(false);
  });

  it("503 only when the store really did not answer; it is worth one more tap", async () => {
    blobDown = true;
    const res = await api(addCash);
    // the session check reads the store too: no store → 503 before anything else
    expect(res.status).toBe(503);
    expect(retryable(503)).toBe(true);
    expect(retryable(409)).toBe(true);
    expect(retryable(0)).toBe(true);
  });

  it("the log line carries the action type and error class only — no sums, no names", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const realPut = blob.set.bind(blob);
    blob.set = () => {
      throw new Error("Маша 5000");
    };
    try {
      await api(addCash);
    } finally {
      blob.set = realPut;
    }
    const logged = spy.mock.calls.flat().join(" ");
    expect(logged).toMatch(/\[groshi\] entry\.add failed: Error/);
    expect(logged).not.toMatch(/Маша|5000|500000/);
  });
});

describe("what was not saved stays in her browser", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
  };

  it("kept after a failed save, read back after a reload, gone once saved", () => {
    const local = memory();
    keepUnsaved(local, addCash as never);
    expect(readUnsaved(local)).toEqual(addCash);
    dropUnsaved(local);
    expect(readUnsaved(local)).toBeNull();
  });

  it("garbage or a broken storage never breaks the page", () => {
    const local = memory();
    local.m.set(UNSAVED_KEY, "{not json");
    expect(readUnsaved(local)).toBeNull();
    local.m.set(UNSAVED_KEY, JSON.stringify({ type: "rm -rf" }));
    expect(readUnsaved(local)).toBeNull();
    const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("full"); }, removeItem: () => { throw new Error("denied"); } };
    expect(() => keepUnsaved(broken, addCash as never)).not.toThrow();
    expect(readUnsaved(broken)).toBeNull();
    expect(() => dropUnsaved(broken)).not.toThrow();
    expect(readUnsaved(undefined)).toBeNull();
  });
});
