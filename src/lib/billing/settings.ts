import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { cabinetStore, type CabinetStore } from "@/lib/cabinet/store";

/**
 * What Sasha sets for payments in her cabinet: the live monobank acquiring
 * token and the seller's details for the offer. Server-only.
 *
 * The token is stored SEALED: AES-256-GCM under a key derived from
 * CABINET_HMAC_SECRET (env only, never in the store), in the private Blob
 * store. It is opened only to call monobank; no page, response or log line
 * carries it — the cabinet shows its last four characters.
 *
 * env MONO_TOKEN, when set, wins over the stored one (it is how billing ran
 * before this form existed, and an operator can still pin it).
 */

export const MONO_KEY = "cabinet/mono.json";
export const OFFER_KEY = "cabinet/offer.json";
const AAD = "shur-mono-token-v1";
const CACHE_MS = 15_000;

const monoSchema = z.object({
  sealed: z.string(),
  last4: z.string(),
  merchant: z.string().nullable(),
  saved_at: z.number(),
});
type MonoState = z.infer<typeof monoSchema>;

export const offerSchema = z.object({
  name: z.string().trim().max(160),
  code: z.string().trim().max(20),
  contact: z.string().trim().max(300),
});
export type Offer = z.infer<typeof offerSchema>;

function sealingKey(): Buffer | null {
  const secret = process.env.CABINET_HMAC_SECRET;
  return secret ? createHash("sha256").update(`mono-token:${secret}`).digest() : null;
}

export const sealingReady = () => sealingKey() !== null;

function seal(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(AAD));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
}

function open(sealed: string, key: Buffer): string | null {
  try {
    const [iv, tag, body] = sealed.split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(AAD));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* A short per-instance cache: the client cabinet asks for the token several
   times per render. Keyed by the store, so tests with a fresh store start clean. */
let cache: { store: CabinetStore; at: number; state: MonoState | null } | null = null;

async function readMono(): Promise<MonoState | null> {
  const store = cabinetStore();
  if (cache && cache.store === store && Date.now() - cache.at < CACHE_MS) return cache.state;
  const stored = await store.read(MONO_KEY);
  const parsed = stored ? monoSchema.safeParse(JSON.parse(stored.text)) : null;
  const state = parsed?.success ? parsed.data : null;
  cache = { store, at: Date.now(), state };
  return state;
}

/** The live token: env first, then the stored one. null → billing is off. A store that does not answer → off, with one log line. */
export async function liveToken(): Promise<string | null> {
  const env = process.env.MONO_TOKEN?.trim();
  if (env) return env;
  try {
    const state = await readMono();
    const key = sealingKey();
    if (!state || !key) return null;
    const plain = open(state.sealed, key);
    if (!plain) console.warn("[billing] stored monobank token does not open (CABINET_HMAC_SECRET changed?) — billing off");
    return plain;
  } catch (error) {
    console.error(`[billing] monobank settings unreadable: ${error instanceof Error ? error.name : "unknown"} — billing off`);
    return null;
  }
}

export interface MonoStatus {
  /** Where the live token comes from. */
  source: "env" | "cabinet" | null;
  last4: string | null;
  merchant: string | null;
  savedAt: number | null;
}

export async function monoStatus(): Promise<MonoStatus> {
  if (process.env.MONO_TOKEN?.trim()) return { source: "env", last4: null, merchant: null, savedAt: null };
  const state = await readMono();
  return state ? { source: "cabinet", last4: state.last4, merchant: state.merchant, savedAt: state.saved_at } : { source: null, last4: null, merchant: null, savedAt: null };
}

export async function saveMonoToken(token: string, merchant: string | null, nowMs = Date.now()): Promise<void> {
  const key = sealingKey();
  if (!key) throw new Error("CABINET_HMAC_SECRET is missing");
  const state: MonoState = { sealed: seal(token, key), last4: token.slice(-4), merchant: merchant?.slice(0, 120) ?? null, saved_at: nowMs };
  await cabinetStore().write(MONO_KEY, JSON.stringify(state));
  cache = { store: cabinetStore(), at: Date.now(), state };
}

export async function clearMonoToken(): Promise<void> {
  await cabinetStore().remove(MONO_KEY);
  cache = { store: cabinetStore(), at: Date.now(), state: null };
}

/* ---------- the offer's details: public text, stored plain ---------- */

export async function readOffer(): Promise<Offer | null> {
  const stored = await cabinetStore().read(OFFER_KEY);
  if (!stored) return null;
  const parsed = offerSchema.safeParse(JSON.parse(stored.text));
  return parsed.success ? parsed.data : null;
}

export async function saveOffer(offer: Offer): Promise<void> {
  await cabinetStore().write(OFFER_KEY, JSON.stringify(offer));
}

/** One line for the offer page, or null → the placeholder stays. */
export function offerLine(offer: Offer | null): string | null {
  if (!offer || !offer.name) return null;
  return [offer.name, offer.code ? `РНОКПП ${offer.code}` : "", offer.contact].filter(Boolean).join(", ");
}
