import { CLIENT_COOKIE, clientCookieOptions } from "@/lib/client/clients";
import { back } from "@/lib/client/http";

export const runtime = "nodejs";

/* «Вийти»: the cookie is dropped on this device; back to the phone login. */

export async function POST(request: Request) {
  const response = back(request, "/client/login");
  response.cookies.set(CLIENT_COOKIE, "", { ...clientCookieOptions, maxAge: 0 });
  return response;
}
