import { describe, it, expect, afterEach } from "vitest";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { META_AAD, pickupMetaKey } from "../src/meta-key.ts";
import { verify } from "../src/hmac.ts";
import { setLogSink } from "../src/log.ts";

/* Her Meta key, engine side — rights only: taken with a signed request,
   written into the 600 env file with the other lines kept, the site copy
   acked for erasure only after the write, and no value in any log line. The
   site's half is in tests/cabinet-access.test.ts. */

const CAB = "cabinet-secret-not-real";
const CRYPT = randomBytes(32);
const TOKEN = "EAAG" + randomBytes(90).toString("base64url");

function envelope() {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", CRYPT, iv);
  c.setAAD(Buffer.from(META_AAD));
  const ct = Buffer.concat([c.update(JSON.stringify({ token: TOKEN, ad_account_id: "1234567890", dataset_id: "9876543210" })), c.final()]);
  return { iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), ct: ct.toString("base64"), saved_at: 1 };
}

function site(pending: ReturnType<typeof envelope> | null) {
  const calls: { action: string; digest?: string; signed: boolean }[] = [];
  let held = pending;
  const fetchFn = async (_url: string, init?: RequestInit) => {
    const h = init!.headers as Record<string, string>;
    const body = String(init!.body);
    const signed = verify(CAB, h["X-Shur-Timestamp"], h["X-Shur-Signature"], Buffer.from(body)).ok;
    const req = JSON.parse(body);
    calls.push({ ...req, signed });
    if (!signed) return new Response('{"ok":false}', { status: 401 });
    if (req.action === "take") return Response.json({ ok: true, pending: held });
    const erased = held && createHash("sha256").update(held.ct).digest("hex") === req.digest;
    if (erased) held = null;
    return Response.json({ ok: true, result: erased ? "erased" : "changed" });
  };
  return { calls, fetchFn, held: () => held };
}

const lines: string[] = [];
const restore = setLogSink((l) => lines.push(l));
afterEach(() => {
  lines.length = 0;
});
process.on("exit", () => setLogSink(restore));

function envFile(): string {
  const f = join(mkdtempSync(join(tmpdir(), "shur-ads-test-")), "env");
  writeFileSync(f, "LEDGER_HMAC_SECRET=keep-me\nMETA_ACCESS_TOKEN=\nSHUR_SITE_URL=https://site.test\n", { mode: 0o600 });
  return f;
}

describe("Meta key from the cabinet", () => {
  it("signed take → env written 600, other lines kept → ack erases the site copy", async () => {
    const s = site(envelope());
    const file = envFile();
    const got = await pickupMetaKey({ siteUrl: "https://site.test", secret: CAB, cryptKey: CRYPT.toString("base64"), envFile: file, fetchFn: s.fetchFn });
    expect(got.outcome).toBe("taken");
    expect(s.calls.map((c) => [c.action, c.signed])).toEqual([["take", true], ["ack", true]]);
    expect(s.held()).toBeNull();

    const text = readFileSync(file, "utf8");
    expect(text).toContain("LEDGER_HMAC_SECRET=keep-me\n");
    expect(text).toContain(`META_ACCESS_TOKEN=${TOKEN}\n`);
    expect(text).toContain("META_AD_ACCOUNT_ID=1234567890\n");
    expect(text).toContain("META_DATASET_ID=9876543210\n");
    expect(text.match(/^META_ACCESS_TOKEN=/gm)).toHaveLength(1);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(lines.join("\n")).not.toContain(TOKEN.slice(4, 30));
  });

  it("a wrong decryption key: nothing written, the site copy is not erased", async () => {
    const s = site(envelope());
    const file = envFile();
    const before = readFileSync(file, "utf8");
    const got = await pickupMetaKey({ siteUrl: "https://site.test", secret: CAB, cryptKey: randomBytes(32).toString("base64"), envFile: file, fetchFn: s.fetchFn });
    expect(got.outcome).toBe("failed");
    expect(readFileSync(file, "utf8")).toBe(before);
    expect(s.calls.map((c) => c.action)).toEqual(["take"]);
    expect(s.held()).not.toBeNull();
  });

  it("no keys configured → nothing is sent", async () => {
    const s = site(envelope());
    const got = await pickupMetaKey({ siteUrl: "https://site.test", secret: undefined, cryptKey: undefined, envFile: envFile(), fetchFn: s.fetchFn });
    expect(got.outcome).toBe("skipped");
    expect(s.calls).toHaveLength(0);
  });
});
