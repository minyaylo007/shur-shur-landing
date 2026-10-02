import { NextResponse } from "next/server";
import { z } from "zod";
import { attributionSchema, compactAttribution, markets } from "@/lib/attribution";
import { verifyLedgerSignature } from "@/lib/ledger";
import { sendLeadToTelegram, TelegramNotConfiguredError } from "@/lib/telegram";

export const runtime = "nodejs";

/* Contract v1.1 (03.10.2026), ledger → site. The ledger holds a lead whose
   Telegram delivery failed at submit time and re-sends it here; this route
   puts it into the same lead chat with the same bot, so the bot token lives
   only on Vercel. Signed exactly like site → ledger (HMAC of «ts.raw body»,
   ±300 s) with the same LEDGER_HMAC_SECRET. 200 = Telegram took it, and the
   ledger marks the lead delivered; anything else and the ledger tries again
   later. Not rate-limited by IP: the only caller is one server, and an
   unsigned request is refused before anything else happens. */

const MAX_BODY = 32 * 1024;

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const redeliverSchema = z.object({
  lead_id: z.uuid(),
  kind: z.enum(["lead", "audit"]),
  locale: z.string().max(5).nullish(),
  market: z.enum(markets),
  name: optionalText(100),
  contact: optionalText(100),
  message: optionalText(1000),
  ig_handle: optionalText(61),
  attribution: attributionSchema,
});

export async function POST(request: Request) {
  const secret = process.env.LEDGER_HMAC_SECRET;
  if (!secret) {
    console.error("[lead] redeliver refused: missing env LEDGER_HMAC_SECRET");
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) {
    return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });
  }
  const signed = verifyLedgerSignature(
    secret,
    request.headers.get("x-shur-timestamp"),
    request.headers.get("x-shur-signature"),
    raw,
  );
  if (!signed) {
    console.error("[lead] redeliver refused: bad signature");
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = redeliverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  const lead = parsed.data;

  try {
    await sendLeadToTelegram({
      kind: lead.kind,
      name: lead.name,
      contact: lead.contact,
      message: lead.message,
      igHandle: lead.ig_handle,
      locale: lead.locale ?? "—",
      source: { market: lead.market, attribution: compactAttribution(lead.attribution) },
      redelivered: true,
    });
  } catch (error) {
    // Same rule as the submit route: variable names or Telegram's status, never the lead.
    const why =
      error instanceof TelegramNotConfiguredError
        ? `NOT CONFIGURED: missing env ${error.missing.join(", ")}`
        : error instanceof Error
          ? error.message
          : "unknown";
    console.error(`[lead] redelivery failed (lead_id=${lead.lead_id}): ${why}`);
    return NextResponse.json({ ok: false, error: "delivery_failed" }, { status: 502 });
  }

  console.info(`[lead] redelivered to Telegram (lead_id=${lead.lead_id})`);
  return NextResponse.json({ ok: true, lead_id: lead.lead_id });
}
