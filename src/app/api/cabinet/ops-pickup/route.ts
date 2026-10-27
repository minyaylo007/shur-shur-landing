import { NextResponse } from "next/server";
import { z } from "zod";
import { ackOpsBot, takeOpsBot } from "@/lib/cabinet/ops-bot";
import { readSignedBody, storeFailure } from "@/lib/cabinet/signed";

export const runtime = "nodejs";

/* ads-engine → site, signed with CABINET_HMAC_SECRET (same as meta-pickup):
   {"action":"take"}            → the CIPHERTEXT of her ops-bot token, or null;
   {"action":"ack","digest":…}  → it is in /opt/ihor/shur-ads/env now: erase
                                  the copy here (only that same ciphertext). */

const bodySchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("take") }),
  z.strictObject({ action: z.literal("ack"), digest: z.string().regex(/^[0-9a-f]{64}$/) }),
]);

export async function POST(request: Request) {
  const signed = await readSignedBody(request, "ops-pickup");
  if (!signed.ok) return signed.response;
  const parsed = bodySchema.safeParse(signed.body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });

  try {
    if (parsed.data.action === "take") {
      const pending = await takeOpsBot();
      console.info(`[cabinet] ops pickup: ${pending ? "envelope handed out" : "nothing pending"}`);
      return NextResponse.json({ ok: true, pending });
    }
    const result = await ackOpsBot(parsed.data.digest);
    console.info(`[cabinet] ops ack: ${result}`);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return storeFailure("ops-pickup", error);
  }
}
