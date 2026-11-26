import { login, SESSION_COOKIE, sessionCookieOptions } from "@/lib/cabinet/auth";
import { ADMIN_LOGIN, CLIENT_COOKIE, clientCookieOptions, clientLogin, findClientByLogin, findClientByPhone } from "@/lib/client/clients";
import { back, clientIp, field } from "@/lib/client/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/* The one login (/login): «admin» (any case) is checked against the cabinet
   password and opens /cabinet; any other login is a client's (or the phone of
   a client who set one) and opens that client's own cabinet. 303 back either
   way; the password and the login are never logged, echoed or put in a URL.
   Per IP: 5 tries per 10 minutes (this instance); the cabinet's global and the
   client's own failure limits still apply. An unknown login answers like a
   wrong password. */

const ERROR = { bad_password: "bad", locked: "limit", not_set: "unset" } as const;

export async function POST(request: Request) {
  let name = "";
  let password = "";
  try {
    const form = await request.formData();
    name = field(form, "login").trim();
    password = field(form, "password");
  } catch {
    return back(request, "/login");
  }
  if (!name) return back(request, "/login");
  if (!rateLimit(`login:${clientIp(request)}`).allowed) return back(request, "/login?e=limit");

  const admin = name.toLowerCase() === ADMIN_LOGIN;
  try {
    if (admin) {
      const outcome = await login(password);
      if (!outcome.ok) {
        console.info(`[login] cabinet refused: ${outcome.error}`);
        return back(request, `/login?e=${ERROR[outcome.error]}`);
      }
      const response = back(request, "/cabinet");
      response.cookies.set(SESSION_COOKIE, outcome.session, sessionCookieOptions);
      return response;
    }
    const id = (await findClientByLogin(name)) ?? (await findClientByPhone(name)) ?? "";
    const outcome = id ? await clientLogin(id, password) : ({ ok: false, error: "bad_password" } as const);
    if (!outcome.ok) {
      console.info(`[login] client refused: ${outcome.error}`);
      return back(request, `/login?e=${ERROR[outcome.error]}`);
    }
    const response = back(request, `/client/${id}`);
    response.cookies.set(CLIENT_COOKIE, outcome.session, clientCookieOptions);
    return response;
  } catch (error) {
    console.error(`[login] store failed: ${error instanceof Error ? error.name : "unknown"}`);
    return back(request, "/login?e=down");
  }
}
