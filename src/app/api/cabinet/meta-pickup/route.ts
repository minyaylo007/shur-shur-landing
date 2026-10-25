import { NextResponse } from "next/server";
import { z } from "zod";
import { ackMeta, takeMeta } from "@/lib/cabinet/meta";
import { readSignedBody, storeFailure } from "@/lib/cabinet/signed";

export const runtime = "nodejs";

/* ads-engine → site, signed with CABINET_HMAC_SECRET:
   {"action":"take"}            → the CIPHERTEXT of her Meta key, or null;
   {"action":"ack","digest":…}  → it is in /opt/ihor/shur-ads/env now: erase
                                  the copy here (only that same ciphertext).
   The site cannot decrypt it: the plain key never leaves it in any answer. */

const bodySchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("take") }),
  z.strictObject({ action: z.literal("ack"), digest: z.string().regex(/^[0-9a-f]{64}$/) }),
]);

export async function POST(request: Request) {
  const signed = await readSignedBody(request, "meta-pickup");
  if (!signed.ok) return signed.response;
  const parsed = bodySchema.safeParse(signed.body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });

  try {
    if (parsed.data.action === "take") {
      const pending = await takeMeta();
      console.info(`[cabinet] meta pickup: ${pending ? "envelope handed out" : "nothing pending"}`);
      return NextResponse.json({ ok: true, pending });
    }
    const result = await ackMeta(parsed.data.digest);
    console.info(`[cabinet] meta ack: ${result}`);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return storeFailure("meta-pickup", error);
  }
}
