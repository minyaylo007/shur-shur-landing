import { cancelSubscription, MonoError, monoToken, removeSubscription, syncBilling } from "@/lib/billing/mono";
import { clientCookieValue, EMPTY_BILLING, signedInClient, updateClient } from "@/lib/client/clients";
import { back } from "@/lib/client/http";

export const runtime = "nodejs";

/* «Скасувати підписку». Never paid → the subscription is deleted (remove).
   Paid at least once → future charges are stopped (edit, action cancel):
   monobank refuses `remove` once there was a payment. The paid month stays
   open; no refund is requested here. */

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
  const subscriptionId = client.billing.subscriptionId;
  if (!token || !subscriptionId || client.billing.status === "cancelled") return back(request, page);

  try {
    let removed = false;
    if (client.billing.status === "pending") {
      try {
        await removeSubscription(token, subscriptionId);
        removed = true;
      } catch (error) {
        // 1001: a payment came through after our last look — cancel instead.
        if (!(error instanceof MonoError)) throw error;
      }
    }
    if (removed) {
      await updateClient(client.id, (c) => {
        if (c.billing.subscriptionId !== subscriptionId) return false;
        c.billing = { ...EMPTY_BILLING, lastPaidAt: c.billing.lastPaidAt, seen: c.billing.seen };
      });
    } else {
      await cancelSubscription(token, subscriptionId);
      const synced = await syncBilling(client).catch(() => null);
      if (!synced || synced.billing.status !== "cancelled") {
        // monobank accepted the cancel; do not show «active» while its status catches up.
        await updateClient(client.id, (c) => {
          if (c.billing.subscriptionId !== subscriptionId) return false;
          c.billing.status = "cancelled";
          c.billing.nextChargeAt = null;
        });
      }
    }
    console.info(`[billing] subscription ${removed ? "removed" : "cancelled"}, test=${client.test}`);
    return back(request, `${page}?b=cancelled`);
  } catch (error) {
    const what = error instanceof MonoError ? `monobank ${error.status} ${error.code}` : error instanceof Error ? error.name : "unknown";
    console.error(`[billing] cancel failed: ${what}`);
    return back(request, `${page}?b=cancel_failed`);
  }
}
