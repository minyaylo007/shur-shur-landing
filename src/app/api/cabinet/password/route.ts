import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_PASSWORD, setPasswordByOwner } from "@/lib/cabinet/auth";
import { readSignedBody, storeFailure } from "@/lib/cabinet/signed";

export const runtime = "nodejs";

/* ops/cabinet/set-password.mjs → site: the cabinet password set from ace-main,
   no link. Signed with CABINET_HMAC_SECRET; only the scrypt hash is stored;
   the password is never logged or echoed. Every old session ends. */

const schema = z.strictObject({ password: z.string().min(1).max(MAX_PASSWORD) });

export async function POST(request: Request) {
  const signed = await readSignedBody(request, "password");
  if (!signed.ok) return signed.response;

  const parsed = schema.safeParse(signed.body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  let outcome;
  try {
    outcome = await setPasswordByOwner(parsed.data.password);
  } catch (error) {
    return storeFailure("password", error);
  }
  if (outcome !== "ok") return NextResponse.json({ ok: false, error: outcome }, { status: 400 });
  console.info("[cabinet] password set by the owner");
  return NextResponse.json({ ok: true });
}
