import { CLIENT_COOKIE, clientCookieOptions, completeClientSetup } from "@/lib/client/clients";
import { back, clientIp, field, idField } from "@/lib/client/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/* The client's setup form: link token + phone (the login) + new password twice. On success the
   link is spent, the password hash stored, old sessions ended, the client is
   signed in. The token travels in the form body; it returns to the URL only
   when the password was refused and the same form must open again. */

export async function POST(request: Request) {
  let id = "";
  let token = "";
  let password = "";
  let repeat = "";
  let phone = "";
  try {
    const form = await request.formData();
    id = idField(form);
    token = field(form, "t");
    password = field(form, "password");
    repeat = field(form, "repeat");
    phone = field(form, "phone");
  } catch {
    return back(request, "/");
  }
  if (!id) return back(request, "/");
  const page = `/client/${id}/setup`;
  if (!rateLimit(`client-setup:${clientIp(request)}`, { limit: 10 }).allowed) return back(request, `${page}?e=limit`);

  let outcome;
  try {
    outcome = await completeClientSetup(id, token, password, repeat, Date.now(), phone);
  } catch (error) {
    console.error(`[client] setup store failed: ${error instanceof Error ? error.name : "unknown"}`);
    return back(request, `${page}?e=down`);
  }
  if (!outcome.ok) {
    console.info(`[client] setup refused: ${outcome.error}`);
    const keep = outcome.error === "bad_link" ? "" : `&t=${encodeURIComponent(token)}`;
    return back(request, `${page}?e=${outcome.error}${keep}`);
  }
  console.info("[client] password set, setup link spent");
  const response = back(request, `/client/${id}`);
  response.cookies.set(CLIENT_COOKIE, outcome.session, clientCookieOptions);
  return response;
}
