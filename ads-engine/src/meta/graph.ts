/* Graph API version, pinned. Checked 29.09.2026 against the official changelog
   https://developers.facebook.com/docs/graph-api/changelog — “The latest Graph
   API version is v26.0”, released 29.07.2026 (v25.0: 18.02.2026). Meta retires
   a version about two years after release; bump deliberately, with a date. */
export const GRAPH_API_VERSION = "v26.0";
export const GRAPH_API_VERSION_CHECKED = "2026-09-29";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Graph error without the URL or the token. */
export class GraphError extends Error {
  readonly status: number;
  readonly code: number | undefined;
  constructor(status: number, code: number | undefined, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/* The token never rides in a URL: URLs end up in fetch error messages, proxy
   and access logs. GET sends it as `Authorization: Bearer` — Meta documents
   that header for graph.facebook.com (developers.facebook.com/documentation/
   business-messaging/whatsapp/access-tokens/). POST sends it as the
   `access_token` field of the body — the Conversions API reference passes it
   as a body parameter (`-F 'access_token=…'`, developers.facebook.com/docs/
   marketing-api/conversions-api/using-the-api). Checked 29.09.2026. */

/** Network failures (DNS, reset, timeout) become a GraphError with the token cut out. */
async function send(fetchFn: FetchLike, url: string, init: RequestInit, token: string): Promise<Response> {
  try {
    return await fetchFn(url, init);
  } catch (error) {
    const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw new GraphError(0, undefined, `network: ${token ? raw.split(token).join("[redacted]") : raw}`);
  }
}

async function parse(res: Response): Promise<unknown> {
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number };
  };
  if (!res.ok || body.error) {
    throw new GraphError(res.status, body.error?.code, body.error?.message ?? `HTTP ${res.status}`);
  }
  return body;
}

/** Drops a token Meta may echo into paging.next; the header carries it instead. */
function withoutToken(url: string): string {
  const u = new URL(url);
  u.searchParams.delete("access_token");
  return u.toString();
}

/** Read-only client: GET only. The ads_read token is all it ever needs. */
export class GraphReader {
  private readonly token: string;
  private readonly fetchFn: FetchLike;
  constructor(token: string, fetchFn: FetchLike = fetch) {
    this.token = token;
    this.fetchFn = fetchFn;
  }

  private fetchGet(url: string): Promise<Response> {
    return send(
      this.fetchFn,
      url,
      { method: "GET", headers: { authorization: `Bearer ${this.token}` }, signal: AbortSignal.timeout(30_000) },
      this.token,
    );
  }

  async get(path: string, params: Record<string, string> = {}): Promise<unknown> {
    const url = new URL(`${GRAPH_BASE}/${path.replace(/^\//, "")}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return parse(await this.fetchGet(url.toString()));
  }

  /** Follows paging.next, stripped of any echoed token. */
  async getAll<T>(path: string, params: Record<string, string>): Promise<T[]> {
    const out: T[] = [];
    let page = (await this.get(path, params)) as { data?: T[]; paging?: { next?: string } };
    for (let i = 0; i < 200; i++) {
      out.push(...(page.data ?? []));
      const next = page.paging?.next;
      if (!next || !next.startsWith("https://graph.facebook.com/")) break;
      page = (await parse(await this.fetchGet(withoutToken(next)))) as typeof page;
    }
    return out;
  }
}

/** POST client, used ONLY by the Conversions API sender (events, not ad objects). */
export async function graphPost(
  fetchFn: FetchLike,
  path: string,
  token: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const url = `${GRAPH_BASE}/${path.replace(/^\//, "")}`;
  return parse(
    await send(
      fetchFn,
      url,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, access_token: token }),
        signal: AbortSignal.timeout(15_000),
      },
      token,
    ),
  );
}
