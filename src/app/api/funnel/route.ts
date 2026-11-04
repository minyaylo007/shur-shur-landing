import { marketOf } from "@/lib/attribution";
import { funnelSchema } from "@/lib/funnel-schema";
import { sendFunnelToLedger } from "@/lib/ledger";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** A page view, a form reached and a click per visitor fit many times over. */
const FUNNEL_LIMIT = 60;

const noContent = () => new Response(null, { status: 204 });

/**
 * Site funnel counter (lib/funnel): one beacon → +1 in the ledger's daily
 * aggregate. Forwarded are the event, the locale, the market and, for a
 * click, channel and placement — no IP, no user agent, no cookie, no id, no
 * path. The IP below keys the in-memory rate limit and goes nowhere else.
 * The answer is 204 whether the ledger took it or not: the page never waits
 * on, or learns about, the counter.
 */
export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`funnel:${ip}`, { limit: FUNNEL_LIMIT }).allowed) return new Response(null, { status: 429 });

  let body: unknown;
  try {
    // sendBeacon may arrive as text/plain: read text, not request.json().
    body = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = funnelSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });

  const { path, ...event } = parsed.data;
  // Awaited: a serverless function may be frozen the moment it answers. Bounded at 2 s, never throws.
  await sendFunnelToLedger({ ...event, market: marketOf({ landing_path: path }) });
  return noContent();
}
