import { NextResponse } from "next/server";
import { isSignedIn, SESSION_COOKIE } from "@/lib/cabinet/auth";
import { checkMetaKey } from "@/lib/cabinet/meta-check";
import { metaConfigured, readMetaFields, saveMeta } from "@/lib/cabinet/meta";

export const runtime = "nodejs";

/* The cabinet form posts her Meta key here (signed-in only). Write-only: the
   key is checked with one read request to Meta, then encrypted and stored, the answer is a redirect with a status word —
   nothing of what she typed comes back. */

function back(request: Request, m: string): NextResponse {
  return NextResponse.redirect(new URL(`/cabinet?m=${m}`, request.url), 303);
}

function cookieValue(request: Request): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return undefined;
}

export async function POST(request: Request) {
  let signedIn = false;
  try {
    signedIn = await isSignedIn(cookieValue(request));
  } catch {
    return back(request, "down");
  }
  if (!signedIn) return NextResponse.redirect(new URL("/cabinet/login", request.url), 303);

  let meta: ReturnType<typeof readMetaFields>;
  try {
    meta = readMetaFields(await request.formData());
  } catch {
    return back(request, "token_format");
  }
  if (!meta.given) return back(request, "token_format");
  if (!meta.input) return back(request, meta.error);
  if (!metaConfigured()) {
    console.error("[cabinet] meta key refused: missing env CABINET_META_KEY");
    return back(request, "down");
  }
  const check = await checkMetaKey(meta.input);
  if (!check.ok) {
    console.info(`[cabinet] meta key refused: ${check.reason}`);
    return back(request, check.reason);
  }
  try {
    await saveMeta(meta.input, check.accountName);
  } catch (error) {
    console.error(`[cabinet] meta key store failed: ${error instanceof Error ? error.name : "unknown"}`);
    return back(request, "down");
  }
  console.info("[cabinet] meta key stored, encrypted");
  return back(request, "saved");
}
