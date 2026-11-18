import { CLIENT_COOKIE, clientCookieOptions } from "@/lib/client/clients";
import { back, idField } from "@/lib/client/http";

export const runtime = "nodejs";

/* «Вийти»: the cookie is dropped on this device. */

export async function POST(request: Request) {
  let id = "";
  try {
    id = idField(await request.formData());
  } catch {
    id = "";
  }
  const response = back(request, id ? `/client/${id}/login` : "/");
  response.cookies.set(CLIENT_COOKIE, "", { ...clientCookieOptions, maxAge: 0 });
  return response;
}
