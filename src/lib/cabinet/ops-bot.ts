import { createCipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { cabinetStore, StoreConflictError } from "./store";
import { encryptionKey, envelopeDigest, type MetaEnvelope } from "./meta";

/**
 * Her ops-bot token, write-only — the same scheme as the Meta key (meta.ts).
 * Server-only.
 *
 * The ops bot is the Telegram bot that sends her the daily report and takes
 * /client. She creates it in @BotFather and types its token here; the site
 * checks it with getMe, finds the chat she wrote /start in when no chat id is
 * given, ENCRYPTS both at once (AES-256-GCM, CABINET_META_KEY, its own AAD)
 * and keeps the ciphertext in the private store. There is no code here that
 * decrypts it, and no page or response shows it.
 *
 * ads-engine takes the ciphertext with a signed request, writes
 * SHUR_OPS_BOT_TOKEN / SHUR_OPS_CHAT_ID into its 600 env file, then acks —
 * and the copy here is overwritten with `pending: null`.
 */

export const OPS_BOT_STORE_KEY = "cabinet/ops-bot.json";
/** Bound into every ciphertext; ads-engine checks the same string. */
export const OPS_BOT_AAD = "shur-cabinet-ops-bot-v1";

const TOKEN = /^\d{5,15}:[A-Za-z0-9_-]{30,50}$/;
const CHAT_ID = /^-?\d{3,20}$/;

export interface OpsBotInput {
  token: string;
  chat_id: string;
}

const envelopeSchema = z.object({ iv: z.string(), tag: z.string(), ct: z.string(), saved_at: z.number() });

const stateSchema = z.object({
  pending: envelopeSchema.nullable(),
  taken_at: z.number().nullable(),
  /** The bot's @username from getMe — shown, not secret. */
  bot_name: z.string().nullable().default(null),
});
type OpsBotState = z.infer<typeof stateSchema>;

export type OpsBotFieldError = "bot_token_format" | "bot_chat_format";

export type OpsBotFields =
  | { given: false }
  | { given: true; token: string; chatId: string | null; error?: undefined }
  | { given: true; token: null; chatId: null; error: OpsBotFieldError };

/** Form fields → input. Copy-paste spaces are dropped; the chat id may stay empty. */
export function readOpsBotFields(form: FormData): OpsBotFields {
  const text = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v.replace(/\s+/g, "") : "";
  };
  const token = text("bot_token");
  const chatId = text("bot_chat");
  if (!token && !chatId) return { given: false };
  if (!TOKEN.test(token)) return { given: true, token: null, chatId: null, error: "bot_token_format" };
  if (chatId && !CHAT_ID.test(chatId)) return { given: true, token: null, chatId: null, error: "bot_chat_format" };
  return { given: true, token, chatId: chatId || null };
}

export type OpsBotCheckFailure = "bot_refused" | "bot_no_chat" | "bot_unreachable";
export type OpsBotCheck = { ok: true; botName: string; chatId: string } | { ok: false; reason: OpsBotCheckFailure };

type Fetch = typeof fetch;

async function telegram(fetchFn: Fetch, token: string, method: string): Promise<{ ok: boolean; result?: unknown } | null> {
  try {
    // The token is part of the Bot API path by design; this URL is never logged.
    const res = await fetchFn(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    return (await res.json()) as { ok: boolean; result?: unknown };
  } catch {
    return null;
  }
}

/**
 * getMe proves the token; with no chat id, getUpdates finds the chat of the
 * latest message (she writes /start to the bot, or in her work group). Only
 * the chat id and the bot's @username are kept — nothing from the messages.
 */
export async function checkOpsBot(token: string, chatId: string | null, fetchFn: Fetch = fetch): Promise<OpsBotCheck> {
  const me = await telegram(fetchFn, token, "getMe");
  if (!me) return { ok: false, reason: "bot_unreachable" };
  const user = me.result as { username?: unknown } | undefined;
  if (!me.ok || typeof user?.username !== "string") return { ok: false, reason: "bot_refused" };
  const botName = `@${user.username}`.slice(0, 64);
  if (chatId) return { ok: true, botName, chatId };

  const updates = await telegram(fetchFn, token, "getUpdates");
  if (!updates) return { ok: false, reason: "bot_unreachable" };
  const list = Array.isArray(updates.result) ? (updates.result as Record<string, unknown>[]) : [];
  for (const u of list.reverse()) {
    const msg = (u.message ?? u.my_chat_member ?? u.channel_post) as { chat?: { id?: unknown } } | undefined;
    const id = msg?.chat?.id;
    if (typeof id === "number" && CHAT_ID.test(String(id))) return { ok: true, botName, chatId: String(id) };
  }
  return { ok: false, reason: "bot_no_chat" };
}

function encrypt(input: OpsBotInput, nowMs: number): MetaEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(OPS_BOT_AAD));
  const ct = Buffer.concat([cipher.update(JSON.stringify(input), "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ct: ct.toString("base64"), saved_at: nowMs };
}

async function readState(): Promise<{ state: OpsBotState; etag: string | undefined }> {
  const stored = await cabinetStore().read(OPS_BOT_STORE_KEY);
  if (!stored) return { state: { pending: null, taken_at: null, bot_name: null }, etag: undefined };
  const parsed = stateSchema.safeParse(JSON.parse(stored.text));
  if (!parsed.success) throw new Error("cabinet ops-bot state is malformed");
  return { state: parsed.data, etag: stored.etag };
}

/** A newer token replaces one that was not taken yet. */
export async function saveOpsBot(input: OpsBotInput, botName: string | null, nowMs = Date.now()): Promise<void> {
  const { state } = await readState();
  const next: OpsBotState = { pending: encrypt(input, nowMs), taken_at: state.taken_at, bot_name: botName };
  await cabinetStore().write(OPS_BOT_STORE_KEY, JSON.stringify(next));
}

export interface OpsBotStatus {
  pendingSince: number | null;
  takenAt: number | null;
  botName: string | null;
}

/** For the page: dates and the bot's @username only, never a character of the token. */
export async function opsBotStatus(): Promise<OpsBotStatus> {
  const { state } = await readState();
  return { pendingSince: state.pending?.saved_at ?? null, takenAt: state.taken_at, botName: state.bot_name };
}

/** ads-engine (signed): the ciphertext, or null when nothing waits. */
export async function takeOpsBot(): Promise<MetaEnvelope | null> {
  return (await readState()).state.pending;
}

/** ads-engine (signed) has it in its env: erase the copy here (only that same ciphertext). */
export async function ackOpsBot(digest: string, nowMs = Date.now()): Promise<"erased" | "changed" | "none"> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { state, etag } = await readState();
    if (!state.pending) return "none";
    if (envelopeDigest(state.pending) !== digest) return "changed";
    try {
      const next: OpsBotState = { pending: null, taken_at: nowMs, bot_name: state.bot_name };
      await cabinetStore().write(OPS_BOT_STORE_KEY, JSON.stringify(next), etag);
      return "erased";
    } catch (error) {
      if (!(error instanceof StoreConflictError)) throw error;
    }
  }
  throw new StoreConflictError();
}
