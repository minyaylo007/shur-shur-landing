import { createDecipheriv, createHash } from "node:crypto";
import { chmodSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { sign } from "./hmac.ts";
import { log } from "./log.ts";
import type { FetchLike } from "./meta/graph.ts";

/* The owner's Meta key, handed in on the site (/cabinet/setup or /cabinet).
   The site keeps it ENCRYPTED (AES-256-GCM, CABINET_META_KEY) and cannot read
   it back; this module takes the ciphertext with a request signed by
   CABINET_HMAC_SECRET, opens it here, writes META_ACCESS_TOKEN /
   META_AD_ACCOUNT_ID / META_DATASET_ID into the 600 env file, and only then
   acks — the site erases its copy. Values never reach a log: names only.

   The ops-bot token (the Telegram bot for reports and /client) comes the same
   way through its own slot: /api/cabinet/ops-pickup, its own AAD, written as
   SHUR_OPS_BOT_TOKEN / SHUR_OPS_CHAT_ID. */

export const META_AAD = "shur-cabinet-meta-v1";
export const ENV_NAMES = { token: "META_ACCESS_TOKEN", ad_account_id: "META_AD_ACCOUNT_ID", dataset_id: "META_DATASET_ID" } as const;

export type MetaKeyOutcome = "skipped" | "none" | "taken" | "taken_not_erased" | "refused" | "failed";

export interface MetaKeyResult {
  outcome: MetaKeyOutcome;
  /** Set when the env file was updated: overlay onto process.env before loadConfig(). */
  values?: Record<string, string>;
}

export interface MetaKeyConfig {
  siteUrl: string | undefined;
  secret: string | undefined;
  /** base64, 32 bytes — the same CABINET_META_KEY as in Vercel. */
  cryptKey: string | undefined;
  envFile: string;
  fetchFn?: FetchLike;
}

interface Envelope {
  iv: string;
  tag: string;
  ct: string;
}

/** One sealed slot on the site: where to take it, its AAD, field shapes → env names. */
interface Slot {
  /** Log prefix. */
  name: string;
  path: string;
  aad: string;
  fields: Record<string, { re: RegExp; env: string }>;
}

const META_SLOT: Slot = {
  name: "meta_key",
  path: "/api/cabinet/meta-pickup",
  aad: META_AAD,
  fields: {
    token: { re: /^[A-Za-z0-9_\-.|]{40,1024}$/, env: ENV_NAMES.token },
    ad_account_id: { re: /^\d{5,25}$/, env: ENV_NAMES.ad_account_id },
    dataset_id: { re: /^\d{5,25}$/, env: ENV_NAMES.dataset_id },
  },
};

export const OPS_BOT_AAD = "shur-cabinet-ops-bot-v1";
const OPS_BOT_SLOT: Slot = {
  name: "ops_bot",
  path: "/api/cabinet/ops-pickup",
  aad: OPS_BOT_AAD,
  fields: {
    token: { re: /^\d{5,15}:[A-Za-z0-9_-]{30,50}$/, env: "SHUR_OPS_BOT_TOKEN" },
    chat_id: { re: /^-?\d{3,20}$/, env: "SHUR_OPS_CHAT_ID" },
  },
};

function open(slot: Slot, envelope: Envelope, key: Buffer): Record<string, string> {
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  d.setAAD(Buffer.from(slot.aad));
  d.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plain = JSON.parse(Buffer.concat([d.update(Buffer.from(envelope.ct, "base64")), d.final()]).toString("utf8"));
  const values: Record<string, string> = {};
  for (const [field, { re, env }] of Object.entries(slot.fields)) {
    if (typeof plain?.[field] !== "string" || !re.test(plain[field])) throw new Error(`bad field ${field}`);
    values[env] = plain[field];
  }
  return values;
}

/** Replace (or append) the three lines, keep every other line; 600, atomic. */
export function writeEnvValues(file: string, values: Record<string, string>): void {
  let lines: string[] = [];
  try {
    lines = readFileSync(file, "utf8").split("\n");
  } catch {
    lines = [];
  }
  if (lines.at(-1) === "") lines.pop();
  const pending = new Map(Object.entries(values));
  lines = lines.map((line) => {
    const name = /^([A-Z0-9_]+)=/.exec(line)?.[1];
    if (name && pending.has(name)) {
      const out = `${name}=${pending.get(name)}`;
      pending.delete(name);
      return out;
    }
    return line;
  });
  for (const [name, value] of pending) lines.push(`${name}=${value}`);
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, lines.join("\n") + "\n", { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, file);
}

interface PickupAnswer {
  pending?: Envelope | null;
  result?: string;
}

async function post(slot: Slot, cfg: MetaKeyConfig, payload: unknown): Promise<{ status: number; answer: PickupAnswer | null }> {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const res = await (cfg.fetchFn ?? fetch)(`${cfg.siteUrl!.replace(/\/+$/, "")}${slot.path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shur-Timestamp": ts, "X-Shur-Signature": sign(cfg.secret!, ts, body) },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  let answer: PickupAnswer | null = null;
  try {
    answer = (await res.json()) as PickupAnswer;
  } catch {
    answer = null;
  }
  return { status: res.status, answer };
}

export function pickupMetaKey(cfg: MetaKeyConfig): Promise<MetaKeyResult> {
  return pickup(META_SLOT, cfg);
}

/** Her ops-bot token from the cabinet → SHUR_OPS_BOT_TOKEN / SHUR_OPS_CHAT_ID. */
export function pickupOpsBot(cfg: MetaKeyConfig): Promise<MetaKeyResult> {
  return pickup(OPS_BOT_SLOT, cfg);
}

async function pickup(slot: Slot, cfg: MetaKeyConfig): Promise<MetaKeyResult> {
  const key = Buffer.from(cfg.cryptKey ?? "", "base64");
  if (!cfg.siteUrl || !cfg.secret || key.length !== 32) {
    const missing = [cfg.siteUrl ? null : "SHUR_SITE_URL", cfg.secret ? null : "CABINET_HMAC_SECRET", key.length === 32 ? null : "CABINET_META_KEY"];
    log(`${slot.name}.skipped`, { missing: missing.filter(Boolean).join(",") });
    return { outcome: "skipped" };
  }
  try {
    const taken = await post(slot, cfg, { action: "take" });
    if (taken.status !== 200) {
      log(`${slot.name}.refused`, { status: taken.status });
      return { outcome: "refused" };
    }
    const envelope = taken.answer?.pending ?? null;
    if (!envelope) return { outcome: "none" };

    let values: Record<string, string>;
    try {
      values = open(slot, envelope, key);
    } catch (e) {
      // Wrong CABINET_META_KEY or a damaged envelope: keep the site copy.
      log(`${slot.name}.unreadable`, { error: e instanceof Error ? e.name : "unknown" });
      return { outcome: "failed" };
    }
    writeEnvValues(cfg.envFile, values);
    log(`${slot.name}.written`, { file: cfg.envFile, names: Object.keys(values).join(",") });

    const digest = createHash("sha256").update(envelope.ct).digest("hex");
    const ack = await post(slot, cfg, { action: "ack", digest });
    if (ack.status !== 200) {
      log(`${slot.name}.ack_failed`, { status: ack.status });
      return { outcome: "taken_not_erased", values };
    }
    log(`${slot.name}.site_copy`, { result: String(ack.answer?.result ?? "?") });
    return { outcome: ack.answer?.result === "erased" ? "taken" : "taken_not_erased", values };
  } catch (e) {
    log(`${slot.name}.unreachable`, { error: e instanceof Error ? e.name : "unknown" });
    return { outcome: "failed" };
  }
}
