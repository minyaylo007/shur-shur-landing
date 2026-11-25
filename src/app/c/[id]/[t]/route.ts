import { isClientId } from "@/lib/client/clients";

export const runtime = "nodejs";

/* The short one-time setup link a client gets: /c/<id>/<token> → the setup
   page. Checks nothing but the shape; the setup page checks the token. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; t: string }> }) {
  const { id, t } = await params;
  const base = new URL(request.url);
  if (!isClientId(id) || !/^[A-Za-z0-9_-]{16,200}$/.test(t)) return Response.redirect(new URL("/", base), 303);
  return Response.redirect(new URL(`/client/${id}/setup?t=${encodeURIComponent(t)}`, base), 303);
}
