import { NextResponse } from "next/server";
import { isSignedIn, SESSION_COOKIE } from "@/lib/cabinet/auth";
import { actionSchema, BookError } from "@/lib/money/book";
import { act } from "@/lib/money/store";

export const runtime = "nodejs";

/* «Гроші» in the cabinet: one action per call (lib/money/book), signed-in
   only; answers with the whole new book. JSON only — a cross-site form cannot
   send it, and the session cookie is SameSite=Strict anyway. Names and sums
   never reach a log. */

function cookieValue(request: Request): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return undefined;
}

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  try {
    if (!(await isSignedIn(cookieValue(request)))) return fail("unauthorized", 401);
  } catch {
    return fail("store_unavailable", 503);
  }
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) return fail("bad_request", 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("bad_request", 400);
  }
  const action = actionSchema.safeParse(body);
  if (!action.success) return fail("bad_request", 400);

  try {
    const book = await act(action.data);
    return NextResponse.json({ ok: true, book }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BookError) return fail(error.message, 400);
    console.error(`[groshi] ${action.data.type} failed: ${error instanceof Error ? error.name : "unknown"}`);
    return fail("store_unavailable", 503);
  }
}
