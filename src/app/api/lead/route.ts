import { NextResponse } from "next/server";
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
    return NextResponse.json({ ok: true });
  }

  try {
    await sendLeadToTelegram({
      kind: parsed.data.kind,
      name: parsed.data.name,
      contact: parsed.data.contact,
      message: parsed.data.message,
      igHandle: parsed.data.igHandle,
      locale: parsed.data.locale ?? defaultLocale,
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
    return NextResponse.json({ ok: false, error: "delivery_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
