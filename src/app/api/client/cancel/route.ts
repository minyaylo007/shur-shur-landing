import { MonoError, monoToken, removeInvoice, syncBilling } from "@/lib/billing/mono";
import { clientCookieValue, signedInClient, updateClient } from "@/lib/client/clients";
import { back } from "@/lib/client/http";

export const runtime = "nodejs";

/* «Скасувати підписку». The monthly charge is ours (lib/billing/mono), so
   cancelling is a mark in the record: the daily run charges only «active».
   The paid month stays open; no refund is requested here. An unpaid invoice
   is invalidated at monobank so the old page cannot be paid afterwards. */

export async function POST(request: Request) {
  let client;
  try {
    client = await signedInClient(clientCookieValue(request));
  } catch {
    return back(request, "/");
  }
  if (!client) return back(request, "/");
  const page = `/client/${client.id}`;
  const token = await monoToken(client.test);
  const { status, invoiceId } = client.billing;
  if (!token || status === "cancelled" || status === "none") return back(request, page);

  try {
    if (status === "pending" && invoiceId) {
      try {
        await removeInvoice(token, invoiceId);
      } catch (error) {
        // Refused: it was paid after our last look — take that payment in, then cancel.
        if (!(error instanceof MonoError)) throw error;
        await syncBilling(client).catch(() => null);
      }
    }
    await updateClient(client.id, (c) => {
      if (c.billing.status === "none" || c.billing.status === "cancelled") return false;
      c.billing.status = c.billing.lastPaidAt ? "cancelled" : "none";
      c.billing.pageUrl = null;
      c.billing.nextChargeAt = null;
    });
    console.info(`[billing] subscription cancelled, test=${client.test}`);
    return back(request, `${page}?b=cancelled`);
  } catch (error) {
    const what = error instanceof MonoError ? `monobank ${error.status} ${error.code}` : error instanceof Error ? error.name : "unknown";
    console.error(`[billing] cancel failed: ${what}`);
    return back(request, `${page}?b=cancel_failed`);
  }
}
