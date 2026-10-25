import { NextResponse } from "next/server";
import { login, SESSION_COOKIE, sessionCookieOptions } from "@/lib/cabinet/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/* The login form posts here. 303 back to the page either way; the password
   is never logged, echoed or put in a URL. Per IP: 5 tries per 10 minutes
   (this instance); globally: lib/cabinet/auth GLOBAL_FAILURE_LIMIT. */

function back(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`cabinet-login:${ip}`).allowed) {
    return back(request, "/cabinet/login?e=limit");
  }

  let password = "";
  try {
    const form = await request.formData();
    const value = form.get("password");
    password = typeof value === "string" ? value : "";
  } catch {
    return back(request, "/cabinet/login?e=bad");
  }

  let outcome;
  try {
    outcome = await login(password);
  } catch (error) {
    console.error(`[cabinet] login store failed: ${error instanceof Error ? error.name : "unknown"}`);
    return back(request, "/cabinet/login?e=down");
  }
  if (!outcome.ok) {
    console.info(`[cabinet] login refused: ${outcome.error}`);
    return back(request, `/cabinet/login?e=${outcome.error === "bad_password" ? "bad" : outcome.error === "locked" ? "limit" : "unset"}`);
  }
  const response = back(request, "/cabinet");
  response.cookies.set(SESSION_COOKIE, outcome.session, sessionCookieOptions);
  return response;
}
