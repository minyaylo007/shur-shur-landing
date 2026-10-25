import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { cabinetStore, StoreConflictError } from "./store";

/**
 * Her Meta key, write-only. Server-only.
 *
 * She types the system-user token (ads_read), the ad account id and the
 * pixel (dataset) id into /cabinet/setup or the cabinet. The site ENCRYPTS
 * them at once (AES-256-GCM, key CABINET_META_KEY — only in Vercel env and
 * /opt/ihor/shur-ads/env) and keeps the ciphertext in the private store. The
 * site has no code that decrypts it and no page or response that shows it.
 *
 * ads-engine takes the ciphertext with a signed request, decrypts it on
 * ace-main, writes META_ACCESS_TOKEN / META_AD_ACCOUNT_ID / META_DATASET_ID
 * into its 600 env file, then acks — and the copy here is overwritten with
 * `pending: null`. Only dates stay: when it was handed in, when it was taken.
 */

export const META_STORE_KEY = "cabinet/meta.json";
/** Bound into every ciphertext; ads-engine checks the same string. */
export const META_AAD = "shur-cabinet-meta-v1";

export const metaInputSchema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_\-.|]{40,1024}$/),
  ad_account_id: z
    .string()
    .regex(/^(?:act_)?\d{5,25}$/)
    .transform((v) => v.replace(/^act_/, "")),
  dataset_id: z.string().regex(/^\d{5,25}$/),
});

export type MetaInput = z.infer<typeof metaInputSchema>;

const envelopeSchema = z.object({ iv: z.string(), tag: z.string(), ct: z.string(), saved_at: z.number() });
export type MetaEnvelope = z.infer<typeof envelopeSchema>;

const stateSchema = z.object({ pending: envelopeSchema.nullable(), taken_at: z.number().nullable() });
type MetaState = z.infer<typeof stateSchema>;

export class MetaNotConfiguredError extends Error {
  constructor() {
    super("CABINET_META_KEY is missing or not 32 bytes");
    this.name = "MetaNotConfiguredError";
  }
}

function encryptionKey(): Buffer {
  const raw = process.env.CABINET_META_KEY ?? "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new MetaNotConfiguredError();
  return key;
}

export function metaConfigured(): boolean {
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}

/** Form fields → input. Every field empty = she gave no key (not an error). */
export function readMetaFields(form: FormData): { given: false } | { given: true; input: MetaInput | null } {
  const text = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v.trim() : "";
  };
  const raw = { token: text("meta_token"), ad_account_id: text("meta_account"), dataset_id: text("meta_dataset") };
  if (!raw.token && !raw.ad_account_id && !raw.dataset_id) return { given: false };
  const parsed = metaInputSchema.safeParse(raw);
  return { given: true, input: parsed.success ? parsed.data : null };
}

function encrypt(input: MetaInput, nowMs: number): MetaEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(META_AAD));
  const ct = Buffer.concat([cipher.update(JSON.stringify(input), "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ct: ct.toString("base64"),
    saved_at: nowMs,
  };
}

async function readState(): Promise<{ state: MetaState; etag: string | undefined }> {
  const stored = await cabinetStore().read(META_STORE_KEY);
  if (!stored) return { state: { pending: null, taken_at: null }, etag: undefined };
  const parsed = stateSchema.safeParse(JSON.parse(stored.text));
  if (!parsed.success) throw new Error("cabinet meta state is malformed");
  return { state: parsed.data, etag: stored.etag };
}

/** A newer key replaces one that was not taken yet. */
export async function saveMeta(input: MetaInput, nowMs = Date.now()): Promise<void> {
  const envelope = encrypt(input, nowMs);
  const { state } = await readState();
  await cabinetStore().write(META_STORE_KEY, JSON.stringify({ pending: envelope, taken_at: state.taken_at }));
}

/** For the page: dates only, never a character of the key. */
export async function metaStatus(): Promise<{ pendingSince: number | null; takenAt: number | null }> {
  const { state } = await readState();
  return { pendingSince: state.pending?.saved_at ?? null, takenAt: state.taken_at };
}

/** ads-engine (signed): the ciphertext, or null when nothing waits. */
export async function takeMeta(): Promise<MetaEnvelope | null> {
  return (await readState()).state.pending;
}

export function envelopeDigest(envelope: Pick<MetaEnvelope, "ct">): string {
  return createHash("sha256").update(envelope.ct).digest("hex");
}

/**
 * ads-engine (signed) has written the key into its env: erase the copy here.
 * Only the envelope it took — a key she handed in meanwhile stays pending.
 */
export async function ackMeta(digest: string, nowMs = Date.now()): Promise<"erased" | "changed" | "none"> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { state, etag } = await readState();
    if (!state.pending) return "none";
    if (envelopeDigest(state.pending) !== digest) return "changed";
    try {
      await cabinetStore().write(META_STORE_KEY, JSON.stringify({ pending: null, taken_at: nowMs }), etag);
      return "erased";
    } catch (error) {
      if (!(error instanceof StoreConflictError)) throw error;
    }
  }
  throw new StoreConflictError();
}
