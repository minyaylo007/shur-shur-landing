import { NextResponse } from "next/server";
import { MAX_SIGNED_BODY, storeFailure } from "@/lib/cabinet/signed";
import { addAttempts, attemptSchema, batchSchema, fromWire } from "@/lib/client/attempts";
import { ingestSecret, isClientId, readClient } from "@/lib/client/clients";
import { clientIp } from "@/lib/client/http";
import { verifyLedgerSignature } from "@/lib/ledger";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/* bot → site: finished quiz attempts of ONE client's bot. docs/client-ingest.md.

   X-Shur-Client     the client's id
   X-Shur-Timestamp  unix seconds, ±300 s
   X-Shur-Signature  sha256=<hex HMAC-SHA256(that client's key, «timestamp.raw body»)>

   The key is the client's own (issued in the owner's cabinet), so a bot can
   write into its own cabinet and no other. Nothing is parsed before the
   signature holds. A replay inside the window adds nothing: attempts are
   stored once per attempt_id.

   The schema is strict — a field it does not know (a name, a username, a
   telegram id) refuses the whole request. Answers are still free text, so the
   log gets counts and the error answers get field paths, never a value. */

const refused = () => NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });

export async function POST(request: Request) {
  const id = request.headers.get("x-shur-client");
  if (!isClientId(id)) return refused();
  // Per sender, not per client: a stranger's flood must not lock the real bot out.
  if (!rateLimit(`client-ingest:${clientIp(request)}`, { limit: 300 }).allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const raw = await request.text();
  if (raw.length > MAX_SIGNED_BODY) return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });

  let secret: string | null;
  try {
    const found = await readClient(id);
    secret = found ? ingestSecret(found.client) : null;
  } catch (error) {
    return storeFailure("client ingest", error);
  }
  // No such client, no key issued, wrong key: one answer — it does not tell which ids exist.
  if (!secret || !verifyLedgerSignature(secret, request.headers.get("x-shur-timestamp"), request.headers.get("x-shur-signature"), raw)) {
    console.error("[client] ingest refused: bad signature");
    return refused();
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  // One attempt as the body itself, or a batch under `attempts`.
  const single = typeof json === "object" && json !== null && !("attempts" in json);
  const parsed = single ? attemptSchema.safeParse(json) : batchSchema.safeParse(json);
  if (!parsed.success) {
    // Paths only («attempts.3.score») — zod messages can quote the offending value, and an
    // unknown KEY may itself be the data, so unrecognised keys are counted, not named.
    const where = [...new Set(parsed.error.issues.slice(0, 8).map((issue) => (issue.code === "unrecognized_keys" ? [...issue.path, "<unknown field>"] : issue.path).join(".")))];
    console.error(`[client] ingest refused: invalid at ${where.join(", ")}`);
    return NextResponse.json({ ok: false, error: "invalid", where }, { status: 400 });
  }
  const attempts = ("attempts" in parsed.data ? parsed.data.attempts : [parsed.data]).map(fromWire);

  try {
    const { stored, duplicates } = await addAttempts(id, attempts);
    console.info(`[client] attempts stored: ${stored} new, ${duplicates} repeated`);
    return NextResponse.json({ ok: true, stored, duplicates });
  } catch (error) {
    return storeFailure("client ingest", error);
  }
}
