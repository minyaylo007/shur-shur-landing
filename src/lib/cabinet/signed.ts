import { NextResponse } from "next/server";
import { verifyLedgerSignature } from "@/lib/ledger";

/**
 * ace-main → site for the cabinet: same scheme as the lead ledger (HMAC-SHA256
 * of «timestamp.raw body», ±300 s, headers X-Shur-Timestamp/X-Shur-Signature),
 * but its OWN secret, CABINET_HMAC_SECRET: whoever can push stats must not be
 * able to forge leads, and the other way round.
 */

export const MAX_SIGNED_BODY = 2 * 1024 * 1024;

export type SignedBody = { ok: true; body: unknown } | { ok: false; response: NextResponse };

export async function readSignedBody(request: Request, what: string): Promise<SignedBody> {
  const secret = process.env.CABINET_HMAC_SECRET;
  if (!secret) {
    console.error(`[cabinet] ${what} refused: missing env CABINET_HMAC_SECRET`);
    return { ok: false, response: NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 }) };
  }
  const raw = await request.text();
  if (raw.length > MAX_SIGNED_BODY) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "too_large" }, { status: 413 }) };
  }
  const signed = verifyLedgerSignature(
    secret,
    request.headers.get("x-shur-timestamp"),
    request.headers.get("x-shur-signature"),
    raw,
  );
  if (!signed) {
    console.error(`[cabinet] ${what} refused: bad signature`);
    return { ok: false, response: NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 }) };
  }
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false, response: NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }) };
  }
}

/** The store is down or not configured: name the kind, never the message. */
export function storeFailure(what: string, error: unknown): NextResponse {
  console.error(`[cabinet] ${what} store failed: ${error instanceof Error ? error.name : "unknown"}`);
  return NextResponse.json({ ok: false, error: "store_unavailable" }, { status: 503 });
}
