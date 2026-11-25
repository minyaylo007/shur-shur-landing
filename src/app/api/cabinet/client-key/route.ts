import { NextResponse } from "next/server";
import { z } from "zod";
import { readSignedBody, storeFailure } from "@/lib/cabinet/signed";
import { attemptsKey } from "@/lib/client/attempts";
import { createClient, deleteClient, isClientId, issueIngestKey, listClients, MAX_CLIENT_NAME, readClient, reissueSetup, setupPath } from "@/lib/client/clients";
import { site } from "@/lib/site";
import { resultsKey } from "@/lib/client/results";

export const runtime = "nodejs";

/* ops/cabinet/client-key.mjs → site: the owner's «Ключ бота» button without a
   browser. Signed with CABINET_HMAC_SECRET like every ace-main → site call.

   action "key":    the client named by `client_id`, or by its exact `name`;
                    no client with that name → it is created. A NEW key is
                    issued each time (the previous one stops working) and
                    returned once, in this answer — the caller writes it to a
                    file and prints nothing. A created client also gets its
                    one-time setup token.
   action "list":   id, name, whether a password is set — to find a client.
   action "link":   a NEW one-time setup link (short form, 7 days); the
                    password set by it replaces the old one and signs out
                    every earlier session.
   action "delete": removes the client and its data; refused while a
                    subscription is charging. */

const schema = z.union([
  z.strictObject({ action: z.literal("key"), client_id: z.string().refine(isClientId) }),
  z.strictObject({ action: z.literal("key"), name: z.string().trim().min(1).max(MAX_CLIENT_NAME), test: z.boolean().optional() }),
  z.strictObject({ action: z.literal("delete"), client_id: z.string().refine(isClientId) }),
  z.strictObject({ action: z.literal("list") }),
  z.strictObject({ action: z.literal("link"), client_id: z.string().refine(isClientId) }),
]);

const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: Request) {
  const signed = await readSignedBody(request, "client-key");
  if (!signed.ok) return signed.response;
  const parsed = schema.safeParse(signed.body);
  if (!parsed.success) return no("invalid_input", 400);
  const input = parsed.data;

  try {
    if (input.action === "delete") {
      const found = await readClient(input.client_id);
      if (!found) return no("no_client", 404);
      if (found.client.billing.status === "active") return no("paying", 409);
      await deleteClient(input.client_id, [resultsKey(input.client_id), attemptsKey(input.client_id)]);
      console.info("[cabinet] client deleted (signed call)");
      return NextResponse.json({ ok: true });
    }

    if (input.action === "list") {
      const clients = (await listClients()).map((c) => ({ id: c.id, name: c.name, test: c.test, password_set: c.auth.password !== null }));
      return NextResponse.json({ ok: true, clients }, { headers: { "Cache-Control": "no-store" } });
    }
    if (input.action === "link") {
      const token = await reissueSetup(input.client_id);
      if (!token) return no("no_client", 404);
      console.info("[cabinet] client setup link reissued (signed call)");
      return NextResponse.json({ ok: true, setup_url: `${site.siteUrl}${setupPath(input.client_id, token)}` }, { headers: { "Cache-Control": "no-store" } });
    }

    let id: string;
    let name: string;
    let setupToken: string | undefined;
    if ("client_id" in input) {
      const found = await readClient(input.client_id);
      if (!found) return no("no_client", 404);
      [id, name] = [found.client.id, found.client.name];
    } else {
      const same = (await listClients()).filter((c) => c.name === input.name);
      if (same.length > 1) return no("ambiguous_name", 409);
      if (same.length === 1) [id, name] = [same[0].id, same[0].name];
      else {
        const made = await createClient(input.name, input.test ?? false);
        [id, name, setupToken] = [made.client.id, made.client.name, made.token];
      }
    }
    const issued = await issueIngestKey(id);
    if (typeof issued === "string") return no(issued, issued === "no_client" ? 404 : 503);
    console.info(`[cabinet] client bot key issued (signed call), created=${setupToken !== undefined}`);
    return NextResponse.json(
      { ok: true, client_id: id, name, secret: issued.secret, created: setupToken !== undefined, setup_token: setupToken },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return storeFailure("client-key", error);
  }
}
