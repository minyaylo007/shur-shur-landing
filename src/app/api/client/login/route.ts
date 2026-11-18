import { CLIENT_COOKIE, clientCookieOptions, clientLogin } from "@/lib/client/clients";
import { back, clientIp, field, idField } from "@/lib/client/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/* A client's login form posts here. 303 back either way; the password is
   never logged, echoed or put in a URL. Per IP: 5 tries per 10 minutes (this
   instance); per client: 10 failures an hour (lib/client/clients). */

export async function POST(request: Request) {
  let id = "";
  let password = "";
  try {
    const form = await request.formData();
    id = idField(form);
    password = field(form, "password");
  } catch {
    return back(request, "/");
  }
  if (!id) return back(request, "/");
  const page = `/client/${id}/login`;
  if (!rateLimit(`client-login:${clientIp(request)}`).allowed) return back(request, `${page}?e=limit`);

  let outcome;
  try {
    outcome = await clientLogin(id, password);
  } catch (error) {
    console.error(`[client] login store failed: ${error instanceof Error ? error.name : "unknown"}`);
    return back(request, `${page}?e=down`);
  }
  if (!outcome.ok) {
    console.info(`[client] login refused: ${outcome.error}`);
    return back(request, `${page}?e=${outcome.error === "bad_password" ? "bad" : outcome.error === "locked" ? "limit" : "unset"}`);
  }
  const response = back(request, `/client/${id}`);
  response.cookies.set(CLIENT_COOKIE, outcome.session, clientCookieOptions);
  return response;
}
