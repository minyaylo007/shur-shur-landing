/* Graph API version, pinned. Checked 29.09.2026 against the official changelog
   https://developers.facebook.com/docs/graph-api/changelog — “The latest Graph
   API version is v26.0”, released 29.07.2026 (v25.0: 18.02.2026). Meta retires
   a version about two years after release; bump deliberately, with a date. */
export const GRAPH_API_VERSION = "v26.0";
export const GRAPH_API_VERSION_CHECKED = "2026-09-29";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Graph error without the URL: URLs carry the access token. */
export class GraphError extends Error {
  readonly status: number;
  readonly code: number | undefined;
  constructor(status: number, code: number | undefined, message: string) {
    super(message);
    this.status = status;
    this.code = code;
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

/** Read-only client: GET only. The ads_read token is all it ever needs. */
export class GraphReader {
  private readonly token: string;
  private readonly fetchFn: FetchLike;
  constructor(token: string, fetchFn: FetchLike = fetch) {
    this.token = token;
    this.fetchFn = fetchFn;
  }

  async get(path: string, params: Record<string, string> = {}): Promise<unknown> {
    const url = new URL(`${GRAPH_BASE}/${path.replace(/^\//, "")}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("access_token", this.token);
    return parse(await this.fetchFn(url.toString(), { method: "GET", signal: AbortSignal.timeout(30_000) }));
  }

  /** Follows paging.next; each next URL already carries the token. */
  async getAll<T>(path: string, params: Record<string, string>): Promise<T[]> {
    const out: T[] = [];
    let page = (await this.get(path, params)) as { data?: T[]; paging?: { next?: string } };
    for (let i = 0; i < 200; i++) {
      out.push(...(page.data ?? []));
      const next = page.paging?.next;
      if (!next || !next.startsWith("https://graph.facebook.com/")) break;
      page = (await parse(
        await this.fetchFn(next, { method: "GET", signal: AbortSignal.timeout(30_000) }),
      )) as typeof page;
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
  const url = `${GRAPH_BASE}/${path.replace(/^\//, "")}?access_token=${encodeURIComponent(token)}`;
  return parse(
    await fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    }),
  );
}
