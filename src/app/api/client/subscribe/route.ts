import { accessOf, createInvoice, MonoError, monoToken, PAGE_REUSE_MS, removeInvoice, startPayment } from "@/lib/billing/mono";
import { clientCookieValue, signedInClient, updateClient } from "@/lib/client/clients";
import { back, clientIp } from "@/lib/client/http";
import { rateLimit } from "@/lib/rate-limit";
import { site } from "@/lib/site";

export const runtime = "nodejs";

/* «Оформити підписку»: an invoice for 15 € that also saves the card
   (lib/billing/mono), and the client goes to monobank's payment page. The
   card is entered THERE — this site never sees it; it keeps only monobank's
   card token, sealed. Without a token (lib/billing/mono) nothing is created. */

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
  if (!token) return back(request, `${page}?b=soon`);
  if (!rateLimit(`client-subscribe:${clientIp(request)}`, { limit: 10 }).allowed) return back(request, `${page}?b=limit`);

  const { billing } = client;
  const now = Date.now();
  const access = await accessOf(client, now);
  // A month's charge in flight: a second payment could take the money twice.
  if (billing.charge?.status === "processing" || billing.charge?.status === "started") return back(request, page);
  if (access.state === "paid" && (billing.status === "active" || billing.status === "cancelled")) {
    // A paid month: nothing to pay now. A cancelled one resumes — charges go on from the month's end.
    if (billing.status === "cancelled") {
      await updateClient(client.id, (c) => {
        if (c.billing.status !== "cancelled") return false;
        c.billing.status = "active";
        c.billing.nextChargeAt = c.billing.lastPaidAt;
      }).catch(() => null);
      console.info(`[billing] subscription resumed, test=${client.test}`);
    }
    return back(request, page);
  }
  // Clicked twice: the same payment page, not a second invoice.
  if (billing.status === "pending" && billing.pageUrl && billing.createdAt && now - billing.createdAt < PAGE_REUSE_MS) {
    return Response.redirect(billing.pageUrl, 303);
  }

  try {
    if (billing.status === "pending" && billing.invoiceId) {
      // The stale unpaid one must not stay payable next to the new one. Best effort.
      await removeInvoice(token, billing.invoiceId).catch(() => undefined);
    }
    const created = await createInvoice(token, {
      clientId: client.id,
      redirectUrl: `${site.siteUrl}${page}?paid=1`,
      reference: `${client.id}-first-${now}`,
      amount: billing.first?.amount,
    });
    await startPayment(client, created, now);
    console.info(`[billing] invoice created, ccy=${created.price.ccy}, test=${client.test}`);
    return Response.redirect(created.pageUrl, 303);
  } catch (error) {
    const what = error instanceof MonoError ? `monobank ${error.status} ${error.code}` : error instanceof Error ? error.name : "unknown";
    console.error(`[billing] subscribe failed: ${what}`);
    return back(request, `${page}?b=down`);
  }
}
