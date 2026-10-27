import { NextResponse } from "next/server";
import { isSignedIn, SESSION_COOKIE } from "@/lib/cabinet/auth";
import { metaConfigured } from "@/lib/cabinet/meta";
import { checkOpsBot, readOpsBotFields, saveOpsBot } from "@/lib/cabinet/ops-bot";

export const runtime = "nodejs";

/* The cabinet form posts her ops-bot token here (signed-in only). Write-only:
   checked with Telegram getMe, encrypted and stored; the answer is a redirect
   with a status word — nothing of what she typed comes back. */

function back(request: Request, o: string): NextResponse {
  return NextResponse.redirect(new URL(`/cabinet?o=${o}#ops-bot`, request.url), 303);
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

  let fields: ReturnType<typeof readOpsBotFields>;
  try {
    fields = readOpsBotFields(await request.formData());
  } catch {
    return back(request, "bot_token_format");
  }
  if (!fields.given) return back(request, "bot_token_format");
  if (fields.token === null) return back(request, fields.error);
  if (!metaConfigured()) {
    console.error("[cabinet] ops bot refused: missing env CABINET_META_KEY");
    return back(request, "down");
  }
  const check = await checkOpsBot(fields.token, fields.chatId);
  if (!check.ok) {
    console.info(`[cabinet] ops bot refused: ${check.reason}`);
    return back(request, check.reason);
  }
  try {
    await saveOpsBot({ token: fields.token, chat_id: check.chatId }, check.botName);
  } catch (error) {
    console.error(`[cabinet] ops bot store failed: ${error instanceof Error ? error.name : "unknown"}`);
    return back(request, "down");
  }
  console.info("[cabinet] ops bot stored, encrypted");
  return back(request, "saved");
}
