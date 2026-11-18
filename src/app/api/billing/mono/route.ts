import { NextResponse } from "next/server";
import { MonoError, monoToken, syncBilling, webhookDigest, webhookSigned } from "@/lib/billing/mono";
import { readClient } from "@/lib/client/clients";

export const runtime = "nodejs";

/* monobank → site: «something happened to the subscription of client ?c=».
   Order of checks: size → client → X-Sign (ECDSA, monobank's public key) →
   seen before? → read the truth back from monobank → one write.

   The body is only verified and fingerprinted, never trusted for the state
   and never logged. A repeat of a body already applied answers 200 and
   changes nothing. Anything but 200 makes monobank try again (up to 3 times),
   which is what a failed read-back wants. */

const MAX_BODY = 64 * 1024;
const answer = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return answer(413, { ok: false, error: "too_large" });

  let found;
  try {
    found = await readClient(new URL(request.url).searchParams.get("c") ?? "");
  } catch (error) {
    console.error(`[billing] webhook store failed: ${error instanceof Error ? error.name : "unknown"}`);
    return answer(503, { ok: false, error: "store_unavailable" });
  }
  if (!found) return answer(404, { ok: false, error: "no_client" });
  const { client } = found;
  if (!monoToken(client.test)) return answer(503, { ok: false, error: "not_configured" });

  let signed = false;
  try {
    signed = await webhookSigned(client.test, raw, request.headers.get("x-sign"));
  } catch (error) {
    // The key could not be fetched: not the sender's fault, let monobank retry.
    console.error(`[billing] webhook key fetch failed: ${error instanceof MonoError ? `monobank ${error.status}` : "network"}`);
    return answer(503, { ok: false, error: "key_unavailable" });
  }
  if (!signed) {
    console.error("[billing] webhook refused: bad signature");
    return answer(401, { ok: false, error: "bad_signature" });
  }

  const digest = webhookDigest(raw);
  if (client.billing.seen.includes(digest)) return answer(200, { ok: true, repeat: true });

  // A webhook about a subscription this client no longer has (replaced, removed): nothing to do.
  let about: unknown;
  try {
    about = (JSON.parse(raw) as { subscriptionId?: unknown } | null)?.subscriptionId;
  } catch {
    about = undefined;
  }
  if (!client.billing.subscriptionId || (typeof about === "string" && about !== client.billing.subscriptionId)) {
    return answer(200, { ok: true, ignored: true });
  }

  try {
    const synced = await syncBilling(client, digest);
    console.info(`[billing] webhook applied: status=${synced?.billing.status ?? "unchanged"}, test=${client.test}`);
    return answer(200, { ok: true });
  } catch (error) {
    const what = error instanceof MonoError ? `monobank ${error.status} ${error.code}` : error instanceof Error ? error.name : "unknown";
    console.error(`[billing] webhook sync failed: ${what}`);
    return answer(502, { ok: false, error: "sync_failed" });
  }
}
