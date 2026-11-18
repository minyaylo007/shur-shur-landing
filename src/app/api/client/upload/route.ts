import { clientCookieValue, signedInClient } from "@/lib/client/clients";
import { back, clientIp, storeUpload } from "@/lib/client/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/* A signed-in client uploads the bot's results (.csv or .xlsx). The file goes
   to THIS client's document — the id comes from the session cookie, never
   from the form, so one client cannot write into another's cabinet. */

export async function POST(request: Request) {
  let client;
  try {
    client = await signedInClient(clientCookieValue(request));
  } catch {
    return back(request, "/");
  }
  if (!client) return back(request, "/");
  const page = `/client/${client.id}`;
  if (!rateLimit(`client-upload:${clientIp(request)}`, { limit: 20 }).allowed) return back(request, `${page}?u=limit`);

  try {
    const form = await request.formData();
    const outcome = await storeUpload(client.id, form.get("file"), "client");
    return back(request, `${page}?u=${outcome}`);
  } catch (error) {
    console.error(`[client] upload failed: ${error instanceof Error ? error.name : "unknown"}`);
    return back(request, `${page}?u=down`);
  }
}
