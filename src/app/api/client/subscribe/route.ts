import { createSubscription, MonoError, monoToken, PAGE_REUSE_MS, removeSubscription, startSubscription } from "@/lib/billing/mono";
import { clientCookieValue, signedInClient } from "@/lib/client/clients";
import { back, clientIp } from "@/lib/client/http";
import { rateLimit } from "@/lib/rate-limit";
import { site } from "@/lib/site";

export const runtime = "nodejs";

/* «Оформити підписку»: creates a monthly subscription at monobank and sends
   the client to monobank's payment page. The card is entered THERE — this
   site never sees it. Without a token (lib/billing/mono) nothing is created. */

export async function POST(request: Request) {
  let client;
  try {
    client = await signedInClient(clientCookieValue(request));
  } catch {
    return back(request, "/");
  }
  if (!client) return back(request, "/");
  const page = `/client/${client.id}`;
  const token = monoToken(client.test);
  if (!token) return back(request, `${page}?b=soon`);
  if (!rateLimit(`client-subscribe:${clientIp(request)}`, { limit: 10 }).allowed) return back(request, `${page}?b=limit`);

  const { billing } = client;
  const now = Date.now();
  // A live subscription, even one with a failed charge: a second one could charge twice.
  // The way out of a stuck one is «Скасувати», then subscribe again.
  if (billing.status === "active") return back(request, page);
  // Clicked twice: the same payment page, not a second subscription.
  if (billing.status === "pending" && billing.pageUrl && billing.createdAt && now - billing.createdAt < PAGE_REUSE_MS) {
    return Response.redirect(billing.pageUrl, 303);
  }

  try {
    if (billing.status === "pending" && billing.subscriptionId) {
      // The stale unpaid one must not stay payable next to the new one. Best effort.
      await removeSubscription(token, billing.subscriptionId).catch(() => undefined);
    }
    const created = await createSubscription(token, {
      redirectUrl: `${site.siteUrl}${page}?paid=1`,
      webhookUrl: `${site.siteUrl}/api/billing/mono?c=${client.id}`,
    });
    await startSubscription(client, created, now);
    console.info(`[billing] subscription created, ccy=${created.price.ccy}, test=${client.test}`);
    return Response.redirect(created.pageUrl, 303);
  } catch (error) {
    const what = error instanceof MonoError ? `monobank ${error.status} ${error.code}` : error instanceof Error ? error.name : "unknown";
    console.error(`[billing] subscribe failed: ${what}`);
    return back(request, `${page}?b=down`);
  }
}
