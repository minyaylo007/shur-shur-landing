import { NextResponse } from "next/server";
import { z } from "zod";
import { accessOf, chargeClient, createInvoice, inspectInvoice, MonoError, monoToken, removeInvoice, startPayment, syncBilling } from "@/lib/billing/mono";
import { clearChargeBlock } from "@/lib/billing/settings";
import { readSignedBody, storeFailure } from "@/lib/cabinet/signed";
import { isClientId, readClient, type Client } from "@/lib/client/clients";
import { site } from "@/lib/site";

export const runtime = "nodejs";

/* ops/billing/test-cycle.mjs → site. Signed with CABINET_HMAC_SECRET.

   For a client marked «test» (monobank's TEST environment, MONO_TEST_TOKEN;
   the live token is out of reach by construction):
   action "start":  the same as the cabinet's button — an invoice that saves
                    the card; its payment page is returned.
   action "check":  reads the first invoice back; answers with its KEY NAMES,
                    what the reader understood, the stored state after the
                    sync and the access it gives.
   action "charge": the month's charge by the saved card, now, even before
                    the month ran out (one per period, as in the daily run).

   With the LIVE token, no client, no money:
   action "probe":        an invoice exactly as the button builds it, to see
                          monobank's page and the amount. Nobody is meant to pay it;
   action "probe_remove": invalidates that invoice (invoice/remove);
   action "unblock":      lifts the h2h stop of monthly charges (after monobank
                          switched charges by card on), when the token is in env.

   No value of monobank's answer except the page link is returned or logged;
   neither token ever is. */

const schema = z.strictObject({
  action: z.enum(["start", "check", "charge", "probe", "probe_remove", "unblock"]),
  client_id: z.string().refine(isClientId).optional(),
  invoice_id: z.string().regex(/^[A-Za-z0-9_-]{4,64}$/).optional(),
});

const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });
const ok = (body: Record<string, unknown>) => NextResponse.json({ ok: true, ...body }, { headers: { "Cache-Control": "no-store" } });

function stored(client: Client) {
  const b = client.billing;
  return {
    status: b.status,
    paid: b.lastPaidAt !== null,
    failed: b.lastFailedAt !== null,
    next_charge: b.nextChargeAt !== null,
    card_saved: b.card !== null,
    charge: b.charge ? { status: b.charge.status, note: b.charge.note } : null,
    webhooks_applied: b.seen.length,
  };
}

export async function POST(request: Request) {
  const signed = await readSignedBody(request, "billing-test");
  if (!signed.ok) return signed.response;
  const parsed = schema.safeParse(signed.body);
  if (!parsed.success) return no("invalid_input", 400);
  const { action, client_id: id, invoice_id: invoiceId } = parsed.data;

  try {
    if (action === "unblock") {
      await clearChargeBlock();
      console.info("[billing] charge block cleared (signed call)");
      return ok({ unblocked: true });
    }
    if (action === "probe" || action === "probe_remove") {
      const live = await monoToken(false);
      if (!live) return no("no_live_token", 409);
      if (action === "probe_remove") {
        if (!invoiceId) return no("invalid_input", 400);
        await removeInvoice(live, invoiceId);
        console.info("[billing] probe invoice removed (signed call)");
        return ok({ removed: true });
      }
      const created = await createInvoice(live, { clientId: "probe", redirectUrl: `${site.siteUrl}/`, reference: `probe-${Date.now()}` });
      console.info(`[billing] probe invoice created (signed call), ccy=${created.price.ccy}`);
      return ok({ page_url: created.pageUrl, invoice_id: created.invoiceId, ccy: created.price.ccy, amount: created.price.amount });
    }

    if (!id) return no("invalid_input", 400);
    const found = await readClient(id);
    if (!found) return no("no_client", 404);
    let client = found.client;
    if (!client.test) return no("not_a_test_client", 409);
    const token = await monoToken(true);
    if (!token) return no("no_test_token", 409);
    const { billing } = client;

    if (action === "start") {
      if (billing.status === "active") return no("already_active", 409);
      if (billing.status === "pending" && billing.invoiceId) await removeInvoice(token, billing.invoiceId).catch(() => undefined);
      const created = await createInvoice(token, { clientId: client.id, redirectUrl: `${site.siteUrl}/client/${client.id}?paid=1`, reference: `${client.id}-first-${Date.now()}` });
      await startPayment(client, created);
      console.info(`[billing] test invoice created (signed call), ccy=${created.price.ccy}`);
      return ok({ page_url: created.pageUrl, ccy: created.price.ccy, amount: created.price.amount });
    }

    if (action === "charge") {
      const outcome = await chargeClient(client, Date.now(), true);
      client = (await readClient(id))?.client ?? client;
      return ok({ outcome, stored: stored(client), access: await accessOf(client) });
    }

    if (!billing.invoiceId) return no("no_invoice", 409);
    const seen = await inspectInvoice(token, billing.invoiceId);
    client = (await syncBilling(client)) ?? client;
    return ok({ ...seen, stored: stored(client), access: await accessOf(client) });
  } catch (error) {
    if (error instanceof MonoError) {
      console.error(`[billing] test cycle: ${error.message}`);
      return no(`monobank_${error.status}_${error.code}${error.h2h ? "_h2h" : ""}`, 502);
    }
    return storeFailure("billing-test", error);
  }
}
