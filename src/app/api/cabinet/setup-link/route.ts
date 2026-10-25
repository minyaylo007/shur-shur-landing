import { NextResponse } from "next/server";
import { z } from "zod";
import { issueSetup, SETUP_TTL_SECONDS } from "@/lib/cabinet/auth";
import { readSignedBody, storeFailure } from "@/lib/cabinet/signed";

export const runtime = "nodejs";

/* ops/cabinet/setup-link.mjs → site: registers a one-time password link.
   Only the SHA-256 of the token arrives here — the token itself never leaves
   ace-main except inside the link. A new link replaces an unused older one.
   Expiry is capped at 7 days whatever the caller asks for. */

const schema = z.strictObject({
  token_hash: z.string().regex(/^[0-9a-f]{64}$/),
  expires_at: z.number().int().positive(),
});

export async function POST(request: Request) {
  const signed = await readSignedBody(request, "setup-link");
  if (!signed.ok) return signed.response;

  const parsed = schema.safeParse(signed.body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  const expiresAt = Math.min(parsed.data.expires_at, Date.now() + SETUP_TTL_SECONDS * 1000);
  try {
    await issueSetup(parsed.data.token_hash, expiresAt);
  } catch (error) {
    return storeFailure("setup-link", error);
  }
  console.info("[cabinet] setup link registered");
  return NextResponse.json({ ok: true, expires_at: expiresAt });
}
