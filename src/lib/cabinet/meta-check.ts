import type { MetaInput } from "./meta";

/**
 * «Проверить и сохранить»: ONE read request to Meta with the key she typed —
 * the ad account's name, which needs exactly ads_read on that account.
 * Server-only. The key rides in the Authorization header, never in the URL
 * (URLs end up in error messages and logs); the answer we keep is the
 * account name or a reason word, never Meta's raw message.
 *
 * Same pinned Graph version as ads-engine (ads-engine/src/meta/graph.ts).
 */

export const GRAPH_BASE = "https://graph.facebook.com/v26.0";

export type MetaCheckFailure = "bad_key" | "expired" | "no_access" | "busy" | "unreachable";
export type MetaCheck = { ok: true; accountName: string } | { ok: false; reason: MetaCheckFailure };

interface GraphAnswer {
  name?: unknown;
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

export async function checkMetaKey(input: MetaInput): Promise<MetaCheck> {
  const url = `${GRAPH_BASE}/act_${input.ad_account_id}?fields=name`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { authorization: `Bearer ${input.token}` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  let body: GraphAnswer = {};
  try {
    body = (await res.json()) as GraphAnswer;
  } catch {
    body = {};
  }
  if (body.error) return { ok: false, reason: reasonOf(body.error) };
  if (!res.ok || typeof body.name !== "string") return { ok: false, reason: "unreachable" };
  return { ok: true, accountName: body.name.slice(0, 200) };
}
