import { createHmac, timingSafeEqual } from "node:crypto";

/* Contract v1: X-Shur-Signature: sha256=<hex HMAC-SHA256(secret, timestamp + "." + raw body)>,
   X-Shur-Timestamp: unix seconds, window ±300 s. The signature is checked on
   the RAW bytes before any parsing: a re-serialised body would not match. */

export const WINDOW_SECONDS = 300;

export function sign(secret: string, timestamp: string, rawBody: string | Buffer): string {
  const mac = createHmac("sha256", secret);
  mac.update(timestamp + ".");
  mac.update(rawBody);
  return "sha256=" + mac.digest("hex");
}

export type VerifyResult = { ok: true } | { ok: false; error: "bad_signature" | "stale_timestamp" };

export function verify(
  secret: string,
  timestampHeader: string | undefined,
  signatureHeader: string | undefined,
  rawBody: Buffer,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): VerifyResult {
  if (!timestampHeader || !/^\d{1,12}$/.test(timestampHeader)) {
    return { ok: false, error: "stale_timestamp" };
  }
  if (Math.abs(nowSeconds - Number(timestampHeader)) > WINDOW_SECONDS) {
    return { ok: false, error: "stale_timestamp" };
  }
  if (!signatureHeader || !/^sha256=[0-9a-f]{64}$/i.test(signatureHeader)) {
    return { ok: false, error: "bad_signature" };
  }
  const expected = Buffer.from(sign(secret, timestampHeader, rawBody).slice(7), "hex");
  const given = Buffer.from(signatureHeader.slice(7), "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, error: "bad_signature" };
  }
  return { ok: true };
}
