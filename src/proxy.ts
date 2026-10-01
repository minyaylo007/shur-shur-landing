import { NextResponse, type NextRequest } from "next/server";
import { COUNTRY_HEADER, ZONE_COOKIE, zoneForCountry } from "@/lib/zone";

/**
 * Leaves the consent zone (lib/zone) in a first-party cookie for the client.
 * Strictly necessary, not advertising: one of two words, no identifier,
 * nothing that tells visitors apart. Not HttpOnly — the consent layer reads
 * it. The pages themselves stay static: the proxy only adds a Set-Cookie,
 * and only when the value changes.
 */
export function proxy(request: NextRequest) {
  const zone = zoneForCountry(request.headers.get(COUNTRY_HEADER));
  const response = NextResponse.next();
  if (request.cookies.get(ZONE_COOKIE)?.value !== zone) {
    response.cookies.set(ZONE_COOKIE, zone, {
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24,
    });
  }
  return response;
}

export const config = {
  // Pages only: not the API, not build assets, not files with an extension.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
