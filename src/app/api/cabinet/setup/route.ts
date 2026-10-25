import { NextResponse } from "next/server";
import { completeSetup, SESSION_COOKIE, sessionCookieOptions } from "@/lib/cabinet/auth";
import { metaConfigured, readMetaFields, saveMeta } from "@/lib/cabinet/meta";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/* The setup form posts here: link token + new password twice. On success the
   link is spent, the password hash stored, every old session ended, and she
   is signed in. The token travels in the form body, not in a redirect URL.
   Optionally the same form carries her Meta key (lib/cabinet/meta): checked
   BEFORE the link is spent, encrypted after; never echoed back. */

function back(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

const field = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`cabinet-setup:${ip}`, { limit: 10 }).allowed) {
    return back(request, "/cabinet/setup?e=limit");
  }

  let token = "";
  let password = "";
  let repeat = "";
  let meta: ReturnType<typeof readMetaFields>;
  try {
    const form = await request.formData();
    token = field(form, "t");
    password = field(form, "password");
    repeat = field(form, "repeat");
    meta = readMetaFields(form);
  } catch {
    return back(request, "/cabinet/setup?e=bad_link");
  }

  // A key that cannot be kept must not cost her the link: refuse first.
  if (meta.given && (!meta.input || !metaConfigured())) {
    const error = meta.input ? "meta_down" : "meta_invalid";
    console.info(`[cabinet] setup refused: ${error}`);
    return back(request, `/cabinet/setup?e=${error}&t=${encodeURIComponent(token)}`);
  }

  let outcome;
  try {
    outcome = await completeSetup(token, password, repeat);
  } catch (error) {
    console.error(`[cabinet] setup store failed: ${error instanceof Error ? error.name : "unknown"}`);
    return back(request, "/cabinet/setup?e=down");
  }
  if (!outcome.ok) {
    console.info(`[cabinet] setup refused: ${outcome.error}`);
    // A wrong password shape keeps the link usable: back to the same form.
    const keep = outcome.error === "bad_link" ? "" : `&t=${encodeURIComponent(token)}`;
    return back(request, `/cabinet/setup?e=${outcome.error}${keep}`);
  }
  console.info("[cabinet] password set, setup link spent");
  let landing = "/cabinet";
  if (meta.given && meta.input) {
    try {
      await saveMeta(meta.input);
      console.info("[cabinet] meta key stored, encrypted");
      landing = "/cabinet?m=saved";
    } catch (error) {
      // The password is set; she can hand the key in again from the cabinet.
      console.error(`[cabinet] meta key store failed: ${error instanceof Error ? error.name : "unknown"}`);
      landing = "/cabinet?m=down";
    }
  }
  const response = back(request, landing);
  response.cookies.set(SESSION_COOKIE, outcome.session, sessionCookieOptions);
  return response;
}
