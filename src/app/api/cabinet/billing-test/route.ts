import { NextResponse } from "next/server";
import { z } from "zod";
import { accessOf, createSubscription, inspectSubscription, MonoError, monoToken, removeSubscription, startSubscription, syncBilling } from "@/lib/billing/mono";
import { readSignedBody, storeFailure } from "@/lib/cabinet/signed";
import { isClientId, readClient } from "@/lib/client/clients";
import { site } from "@/lib/site";

export const runtime = "nodejs";

/* ops/billing/test-cycle.mjs → site: one pass of the subscription in
   monobank's TEST environment, for a client marked «test». Signed with
   CABINET_HMAC_SECRET. The live token is out of reach here by construction:
   only a test client is accepted, and a test client only ever gets
   MONO_TEST_TOKEN.

   action "start": the same as the cabinet's button — a subscription is
                   created and its payment page returned.
   action "check": reads status and payments back; answers with the KEY NAMES
                   of both, what the reader understood, the stored state after
                   the sync and the access it gives. No value of monobank's
                   answer is returned or logged. */

const schema = z.strictObject({ action: z.enum(["start", "check"]), client_id: z.string().refine(isClientId) });

const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: Request) {
  const signed = await readSignedBody(request, "billing-test");
  if (!signed.ok) return signed.response;
  const parsed = schema.safeParse(signed.body);
  if (!parsed.success) return no("invalid_input", 400);
  const { action, client_id: id } = parsed.data;

  try {
    const found = await readClient(id);
    if (!found) return no("no_client", 404);
    let client = found.client;
    if (!client.test) return no("not_a_test_client", 409);
    const token = monoToken(true);
    if (!token) return no("no_test_token", 409);
    const { billing } = client;

    if (action === "start") {
      if (billing.status === "active") return no("already_active", 409);
      if (billing.status === "pending" && billing.subscriptionId) await removeSubscription(token, billing.subscriptionId).catch(() => undefined);
      const page = `/client/${client.id}`;
      const created = await createSubscription(token, {
        redirectUrl: `${site.siteUrl}${page}?paid=1`,
        webhookUrl: `${site.siteUrl}/api/billing/mono?c=${client.id}`,
      });
      await startSubscription(client, created);
      console.info(`[billing] test subscription created (signed call), ccy=${created.price.ccy}`);
      return NextResponse.json({ ok: true, page_url: created.pageUrl, ccy: created.price.ccy, amount: created.price.amount }, { headers: { "Cache-Control": "no-store" } });
    }

    if (!billing.subscriptionId) return no("no_subscription", 409);
    const since = (billing.createdAt ?? Date.now()) - 24 * 60 * 60 * 1000;
    const seen = await inspectSubscription(token, billing.subscriptionId, since);
    client = (await syncBilling(client)) ?? client;
    const b = client.billing;
    return NextResponse.json(
      {
        ok: true,
        ...seen,
        stored: { status: b.status, paid: b.lastPaidAt !== null, failed: b.lastFailedAt !== null, next_charge: b.nextChargeAt !== null, unclear: b.unclearAt !== null, webhooks_applied: b.seen.length },
        access: accessOf(client),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof MonoError) {
      console.error(`[billing] test cycle: monobank ${error.status} ${error.code}`);
      return no(`monobank_${error.status}_${error.code}`, 502);
    }
    return storeFailure("billing-test", error);
  }
}
