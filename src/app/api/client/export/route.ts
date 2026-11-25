import { NextResponse } from "next/server";
import { isSignedIn, SESSION_COOKIE } from "@/lib/cabinet/auth";
import { readAttempts } from "@/lib/client/attempts";
import { clientCookieValue, isClientId, readClient, signedInClient, type Client } from "@/lib/client/clients";
import { attemptsCsv, tableCsv } from "@/lib/client/export";
import { readResults } from "@/lib/client/results";

export const runtime = "nodejs";

/* GET /api/client/export?id=<id> — the cabinet's results as a .csv file.
   Who may: the client signed in to THIS cabinet, or the back office (as the
   page itself). Anyone else gets 401 and nothing is read. The URL carries the
   id only; nothing of the file's content reaches a log. */

const noStore = { "Cache-Control": "no-store" };
const fail = (status: number) => new NextResponse(null, { status, headers: noStore });

function cabinetCookie(request: Request): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return undefined;
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!isClientId(id)) return fail(401);
  let client: Client | null;
  try {
    client = await signedInClient(clientCookieValue(request), id);
    if (!client && (await isSignedIn(cabinetCookie(request)))) client = (await readClient(id))?.client ?? null;
  } catch {
    return fail(503);
  }
  if (!client) return fail(401);

  let body: string | null = null;
  try {
    const attempts = await readAttempts(client.id);
    if (attempts?.attempts.length) body = attemptsCsv(attempts.attempts);
    else {
      const results = await readResults(client.id);
      if (results) body = tableCsv(results);
    }
  } catch {
    console.error("[client] export failed: store");
    return fail(503);
  }
  if (body === null) return fail(404);
  return new NextResponse(body, {
    headers: {
      ...noStore,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shur-results-${client.id}.csv"`,
    },
  });
}
