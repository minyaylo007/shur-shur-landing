import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { compactAttribution, marketOf } from "@/lib/attribution";
import { markLeadDelivered, sendLeadToLedger } from "@/lib/ledger";
import { leadSchema, isSpam } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { sendLeadToTelegram, TelegramNotConfiguredError } from "@/lib/telegram";
import { defaultLocale } from "@/lib/i18n";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // First hop of x-forwarded-for = client IP (behind a single trusted proxy).
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || "unknown";

  const { allowed } = rateLimit(`lead:${ip}`);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  // Honeypot / too-fast submissions: pretend success so bots learn nothing,
  // but log server-side (with the kind — audit/lead use different elapsed
  // thresholds) so silently dropped real leads stay observable.
  if (isSpam(parsed.data)) {
    const reason = parsed.data.extra_field !== "" ? "honeypot" : "too-fast";
    console.info("[lead] silent drop:", reason, "kind:", parsed.data.kind);
    // A lead_id here too: a response without one would tell a bot it was caught.
    return NextResponse.json({ ok: true, lead_id: randomUUID() });
  }

  /* Contract v1 (29.09.2026): the SERVER names the lead. The same UUID goes
     to the ledger and back to the browser, where the pixel uses it as the
     event id — so the pixel and a later Conversions API event are one lead. */
  const leadId = randomUUID();
  const locale = parsed.data.locale ?? defaultLocale;
  const attribution = compactAttribution(parsed.data.attribution);
  const market = marketOf(attribution);

  /* Contract v1.1 (03.10.2026): the ledger FIRST, Telegram second. A lead
     the ledger has taken is no longer lost when Telegram is down: the visitor
     gets 200, and the ledger (a server that never sleeps) re-sends it to the
     lead chat after 2 minutes unless the site marks it delivered. Awaited (a
     serverless function may be frozen the moment it answers), bounded at 2 s
     and unable to throw; not configured = skipped, behaviour as in v1. */
  const ledger = await sendLeadToLedger({
    lead_id: leadId,
    created_at: new Date().toISOString(),
    kind: parsed.data.kind,
    locale,
    market,
    name: parsed.data.name,
    contact: parsed.data.contact,
    message: parsed.data.message,
    ig_handle: parsed.data.igHandle,
    attribution,
    consent: parsed.data.consent,
    delivery: "pending",
  });

  try {
    await sendLeadToTelegram({
      kind: parsed.data.kind,
      name: parsed.data.name,
      contact: parsed.data.contact,
      message: parsed.data.message,
      igHandle: parsed.data.igHandle,
      locale,
      source: { market, attribution },
    });
  } catch (error) {
    // Two different incidents, two different log lines. «Not configured» means
    // the env vars were never set here — every request fails, nobody at
    // Telegram is at fault, and the fix is one deployment setting. It used to
    // be logged word for word like an outage. Names of the missing variables
    // only: never a value, not even a prefix. The request kind stays in both,
    // so dropped audit requests remain distinguishable from classic leads.
    if (error instanceof TelegramNotConfiguredError) {
      console.error(
        `[lead] Telegram bot NOT CONFIGURED (kind=${parsed.data.kind}): missing env ${error.missing.join(", ")} — lead not delivered, nothing was sent to Telegram`,
      );
    } else {
      console.error(
        `[lead] Telegram delivery failed (kind=${parsed.data.kind}):`,
        error instanceof Error ? error.message : error,
      );
    }
    if (ledger === "sent") {
      console.error(`[lead] held by the ledger, redelivery pending (lead_id=${leadId})`);
      return NextResponse.json({ ok: true, lead_id: leadId });
    }
    return NextResponse.json({ ok: false, error: "delivery_failed" }, { status: 502 });
  }

  // Telegram has it: stop the ledger from re-sending. One more try on a failed
  // mark — a lost mark means the same lead in the chat twice, 2 minutes apart.
  if (ledger === "sent" && (await markLeadDelivered(leadId)) === "failed") {
    await markLeadDelivered(leadId);
  }

  return NextResponse.json({ ok: true, lead_id: leadId });
}
