import { NextResponse } from "next/server";
import { isSignedIn, SESSION_COOKIE } from "@/lib/cabinet/auth";
import { merchantDetails, MonoError } from "@/lib/billing/mono";
import { clearMonoToken, offerSchema, saveMonoToken, saveOffer, sealingReady } from "@/lib/billing/settings";

export const runtime = "nodejs";

/* The «Оплата monobank» block of the cabinet posts here (signed-in only).
   Write-only like the Meta form: the token is checked with one read request
   to monobank, sealed and stored; the answer is a redirect with a status word.
   Nothing she typed comes back, and no log line carries it. */

const TOKEN = /^[A-Za-z0-9_\-+/=.]{20,256}$/;

function back(request: Request, b: string): NextResponse {
  return NextResponse.redirect(new URL(`/cabinet?b=${b}#mono`, request.url), 303);
}

function cookieValue(request: Request): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return undefined;
}

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

export async function POST(request: Request) {
  let signedIn = false;
  try {
    signedIn = await isSignedIn(cookieValue(request));
  } catch {
    return back(request, "down");
  }
  if (!signedIn) return NextResponse.redirect(new URL("/cabinet/login", request.url), 303);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return back(request, "bad");
  }
  const action = text(form, "action");

  if (action === "off") {
    try {
      await clearMonoToken();
    } catch (error) {
      console.error(`[cabinet] mono token erase failed: ${error instanceof Error ? error.name : "unknown"}`);
      return back(request, "down");
    }
    console.info("[cabinet] mono token erased");
    return back(request, "off");
  }

  if (action === "offer") {
    const offer = offerSchema.safeParse({ name: text(form, "name"), code: text(form, "code"), contact: text(form, "contact") });
    if (!offer.success || (offer.data.code && !/^\d{8,10}$/.test(offer.data.code))) return back(request, "offer_format");
    try {
      await saveOffer(offer.data);
    } catch (error) {
      console.error(`[cabinet] offer details store failed: ${error instanceof Error ? error.name : "unknown"}`);
      return back(request, "down");
    }
    return back(request, "offer_saved");
  }

  if (action !== "save") return back(request, "bad");
  const token = text(form, "token").trim();
  if (!TOKEN.test(token)) return back(request, "token_format");
  if (!sealingReady()) {
    console.error("[cabinet] mono token refused: missing env CABINET_HMAC_SECRET");
    return back(request, "down");
  }
  let merchant: string | null;
  try {
    merchant = (await merchantDetails(token)).merchantName;
  } catch (error) {
    if (error instanceof MonoError && (error.status === 401 || error.status === 403 || error.status === 400 || error.status === 404)) {
      console.info(`[cabinet] mono token refused by monobank: ${error.status}`);
      return back(request, "refused");
    }
    console.error(`[cabinet] mono token check failed: ${error instanceof MonoError ? `monobank ${error.status}` : "network"}`);
    return back(request, "bank_down");
  }
  try {
    await saveMonoToken(token, merchant);
  } catch (error) {
    console.error(`[cabinet] mono token store failed: ${error instanceof Error ? error.name : "unknown"}`);
    return back(request, "down");
  }
  console.info("[cabinet] mono token checked and stored, sealed");
  return back(request, "saved");
}
