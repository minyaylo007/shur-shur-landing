import type { MetaInput } from "./meta";

/**
 * «Проверить и сохранить»: two read requests to Meta with the key she typed,
 * both within ads_read on that account — the ad account's name, then the
 * account's pixels (act_X/adspixels). The pixel id she typed must be one of
 * them: on 27.10 the app id from step 1 went into the pixel field and an
 * account-only check let it through. A direct GET of the pixel answers 100
 * with ads_read, so the account's list is what we rely on.
 * Server-only. The key rides in the Authorization header, never in the URL
 * (URLs end up in error messages and logs); the answer we keep is the
 * account name or a reason word (plus the account's pixel ids and names —
 * not secret), never Meta's raw message.
 *
 * Same pinned Graph version as ads-engine (ads-engine/src/meta/graph.ts).
 */

export const GRAPH_BASE = "https://graph.facebook.com/v26.0";

export type MetaCheckFailure = "bad_key" | "expired" | "no_access" | "busy" | "unreachable";
export interface MetaPixel {
  id: string;
  name: string;
}
export type MetaCheck =
  | { ok: true; accountName: string }
  | { ok: false; reason: MetaCheckFailure }
  | { ok: false; reason: "pixel_not_in_account"; pixels: MetaPixel[] };

interface GraphAnswer {
  name?: unknown;
  data?: unknown;
  error?: { code?: number; error_subcode?: number };
}

/* Graph error codes (developers.facebook.com/docs/graph-api/guides/error-handling):
   190 — the key is invalid (subcode 463: it has expired);
   100 / 10 / 200 / 294 — the object is not visible to this key or ads_read is missing;
   4 / 17 / 32 / 613 / 80004 — rate limits, try later. */
function reasonOf(error: NonNullable<GraphAnswer["error"]>): MetaCheckFailure {
  if (error.code === 190) return error.error_subcode === 463 ? "expired" : "bad_key";
  if ([100, 10, 200, 294].includes(error.code ?? -1)) return "no_access";
  if ([4, 17, 32, 613, 80004].includes(error.code ?? -1)) return "busy";
  return "unreachable";
}

async function graphGet(path: string, token: string): Promise<{ res: Response; body: GraphAnswer } | null> {
  let res: Response;
  try {
    res = await fetch(`${GRAPH_BASE}/${path}`, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    return null;
  }
  let body: GraphAnswer = {};
  try {
    body = (await res.json()) as GraphAnswer;
  } catch {
    body = {};
  }
  return { res, body };
}

/** Only well-formed ids; names cut short — they travel in a redirect URL. */
function pixelsOf(data: unknown): MetaPixel[] | null {
  if (!Array.isArray(data)) return null;
  const pixels: MetaPixel[] = [];
  for (const row of data as { id?: unknown; name?: unknown }[]) {
    if (typeof row?.id !== "string" || !/^\d{5,25}$/.test(row.id)) continue;
    pixels.push({ id: row.id, name: typeof row.name === "string" ? row.name.slice(0, 80) : "" });
  }
  return pixels;
}

export async function checkMetaKey(input: MetaInput): Promise<MetaCheck> {
  const account = await graphGet(`act_${input.ad_account_id}?fields=name`, input.token);
  if (!account) return { ok: false, reason: "unreachable" };
  if (account.body.error) return { ok: false, reason: reasonOf(account.body.error) };
  if (!account.res.ok || typeof account.body.name !== "string") return { ok: false, reason: "unreachable" };

  const list = await graphGet(`act_${input.ad_account_id}/adspixels?fields=id,name&limit=100`, input.token);
  if (!list) return { ok: false, reason: "unreachable" };
  if (list.body.error) return { ok: false, reason: reasonOf(list.body.error) };
  const pixels = list.res.ok ? pixelsOf(list.body.data) : null;
  if (!pixels) return { ok: false, reason: "unreachable" };
  if (!pixels.some((p) => p.id === input.dataset_id)) return { ok: false, reason: "pixel_not_in_account", pixels };
  return { ok: true, accountName: account.body.name.slice(0, 200) };
}
