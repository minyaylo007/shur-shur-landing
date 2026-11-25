import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runCharges } from "@/lib/billing/mono";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Vercel cron (vercel.json, once a day) → the month's charges by saved cards
   (lib/billing/mono runCharges). Vercel sends «Authorization: Bearer
   $CRON_SECRET»; without CRON_SECRET on the site nothing runs. Answers with
   counts only. */

const digest = (value: string) => createHash("sha256").update(value).digest();

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  const given = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(given), digest(`Bearer ${secret}`))) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const counts = await runCharges();
    console.info(`[billing] charge run: ${Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${k}=${n}`).join(" ") || "no clients"}`);
    return NextResponse.json({ ok: true, counts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`[billing] charge run failed: ${error instanceof Error ? error.name : "unknown"}`);
    return NextResponse.json({ ok: false, error: "run_failed" }, { status: 503 });
  }
}
