import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { checkPassword, hashPassword, hashSetupToken, MAX_PASSWORD, passwordProblem } from "@/lib/cabinet/auth";
import { cabinetStore, StoreConflictError } from "@/lib/cabinet/store";

/**
 * Clients of the 15 €/month bot cabinet (/client/<id>). Server-only.
 *
 * One record per client in the same private Vercel Blob as the owner's
 * cabinet: name, login state and the subscription state. The bot results
 * (which may hold respondents' personal data) live in a SEPARATE document,
 * lib/client/results — nothing here is personal data of a third party.
 *
 * Login is the owner cabinet's scheme, once per client: a one-time setup
 * link (only its SHA-256 is stored), a scrypt password hash, an HMAC session
 * key that a new password rotates. The session cookie names its client and is
 * signed with THAT client's key, so a cookie of one client opens nothing of
 * another.
 */

export const CLIENT_INDEX_KEY = "cabinet/clients/index.json";
export const clientKey = (id: string) => `cabinet/clients/${id}.json`;

export const CLIENT_COOKIE = "shur_client";
export const CLIENT_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const CLIENT_SETUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CLIENT_FAILURE_LIMIT = 10;
export const CLIENT_FAILURE_WINDOW_MS = 60 * 60 * 1000;
export const MAX_CLIENT_NAME = 80;

const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const ID = /^[a-z2-9]{12}$/;
export const isClientId = (value: unknown): value is string => typeof value === "string" && ID.test(value);

/** One monthly charge by the saved card. One per paid period — `period` is its key. */
const chargeSchema = z.object({
  /** The day the paid month ran out (ms): the month this charge pays for starts here. */
  period: z.number(),
  at: z.number(),
  /** monobank's invoice of the charge; null until monobank answered. */
  invoiceId: z.string().nullable(),
  /** started: asked, no answer yet — never asked again for the same period. */
  status: z.enum(["started", "processing", "success", "failure", "error"]),
  /** A short code for the cabinet line (h2h, no_answer, 3ds, refused…). Never a card or a token. */
  note: z.string().nullable(),
});

const billingSchema = z.object({
  /** The first payment: monobank's invoice that also saves the card. */
  invoiceId: z.string().nullable().default(null),
  /** monobank's payment page while that invoice waits. */
  pageUrl: z.string().nullable(),
  createdAt: z.number().nullable(),
  status: z.enum(["none", "pending", "active", "cancelled"]),
  ccy: z.number().nullable(),
  amount: z.number().nullable(),
  /** Start of the last paid month. */
  lastPaidAt: z.number().nullable(),
  lastFailedAt: z.number().nullable(),
  nextChargeAt: z.number().nullable(),
  syncedAt: z.number().nullable(),
  /** monobank's card token, SEALED (lib/billing/settings sealCard). Null: no saved card. */
  card: z.string().nullable().default(null),
  charge: chargeSchema.nullable().default(null),
  /** A one-off first payment (owner's card check): this amount opens this many days, then the usual monthly charge. */
  first: z.object({ amount: z.number().int().min(1), days: z.number().int().min(1).max(31) }).nullable().default(null),
  /** SHA-256 of the webhook bodies already applied — a repeat changes nothing. */
  seen: z.array(z.string()),
});
export type Billing = z.infer<typeof billingSchema>;
export type Charge = z.infer<typeof chargeSchema>;

export const EMPTY_BILLING: Billing = {
  invoiceId: null,
  pageUrl: null,
  createdAt: null,
  status: "none",
  ccy: null,
  amount: null,
  lastPaidAt: null,
  lastFailedAt: null,
  nextChargeAt: null,
  syncedAt: null,
  card: null,
  charge: null,
  first: null,
  seen: [],
};

const clientSchema = z.object({
  id: z.string().regex(ID),
  name: z.string(),
  createdAt: z.number(),
  /** A test client pays in monobank's test environment only (MONO_TEST_TOKEN). */
  test: z.boolean(),
  auth: z.object({
    password: z.object({ salt: z.string(), hash: z.string() }).nullable(),
    sessionKey: z.string().nullable(),
    setup: z.object({ tokenHash: z.string(), expiresAt: z.number() }).nullable(),
    failures: z.object({ since: z.number(), count: z.number() }),
  }),
  billing: billingSchema,
  /** The bot's signing key for /api/client/ingest, sealed (see `sealKey`). Null: none issued. */
  ingest: z.object({ sealed: z.string(), createdAt: z.number() }).nullable().default(null),
});
export type Client = z.infer<typeof clientSchema>;

const indexSchema = z.object({ ids: z.array(z.string()) });

/* ---------- records ---------- */

export async function readClient(id: string): Promise<{ client: Client; etag: string } | null> {
  if (!isClientId(id)) return null;
  const stored = await cabinetStore().read(clientKey(id));
  if (!stored) return null;
  const parsed = clientSchema.safeParse(JSON.parse(stored.text));
  if (!parsed.success) throw new Error("client record is malformed");
  return { client: parsed.data, etag: stored.etag };
}

export async function writeClient(client: Client, etag?: string): Promise<void> {
  await cabinetStore().write(clientKey(client.id), JSON.stringify(client), etag);
}

/**
 * Read → change → conditional write, retried when someone else wrote first.
 * `change` returns false to leave the record alone. Null: no such client.
 */
export async function updateClient(id: string, change: (client: Client) => boolean | void): Promise<Client | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const found = await readClient(id);
    if (!found) return null;
    if (change(found.client) === false) return found.client;
    try {
      await writeClient(found.client, found.etag);
      return found.client;
    } catch (error) {
      if (!(error instanceof StoreConflictError)) throw error;
    }
  }
  throw new StoreConflictError();
}

async function changeIndex(change: (ids: string[]) => string[]): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const stored = await cabinetStore().read(CLIENT_INDEX_KEY);
    const ids = stored ? indexSchema.parse(JSON.parse(stored.text)).ids : [];
    try {
      // `ifMatch` only when there is something to match: the first write creates the index.
      return await cabinetStore().write(CLIENT_INDEX_KEY, JSON.stringify({ ids: change(ids) }), stored?.etag);
    } catch (error) {
      if (!(error instanceof StoreConflictError)) throw error;
    }
  }
  throw new StoreConflictError();
}

export async function listClients(): Promise<Client[]> {
  const stored = await cabinetStore().read(CLIENT_INDEX_KEY);
  if (!stored) return [];
  const { ids } = indexSchema.parse(JSON.parse(stored.text));
  const found = await Promise.all(ids.map((id) => readClient(id)));
  return found.flatMap((f) => (f ? [f.client] : [])).sort((a, b) => b.createdAt - a.createdAt);
}

function newId(): string {
  let id = "";
  for (let i = 0; i < 12; i++) id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  return id;
}

/** A new client with a fresh one-time setup link. The token is returned once and never stored. */
export async function createClient(name: string, test: boolean, nowMs = Date.now()): Promise<{ client: Client; token: string }> {
  const token = randomBytes(32).toString("base64url");
  const client: Client = {
    id: newId(),
    name: name.trim().slice(0, MAX_CLIENT_NAME),
    createdAt: nowMs,
    test,
    auth: {
      password: null,
      sessionKey: null,
      setup: { tokenHash: hashSetupToken(token), expiresAt: nowMs + CLIENT_SETUP_TTL_MS },
      failures: { since: 0, count: 0 },
    },
    billing: structuredClone(EMPTY_BILLING),
    ingest: null,
  };
  await writeClient(client);
  await changeIndex((ids) => [...ids.filter((id) => id !== client.id), client.id]);
  return { client, token };
}

/** A new setup link for an existing client; replaces an unused older one. */
export async function reissueSetup(id: string, nowMs = Date.now()): Promise<string | null> {
  const token = randomBytes(32).toString("base64url");
  const client = await updateClient(id, (c) => {
    c.auth.setup = { tokenHash: hashSetupToken(token), expiresAt: nowMs + CLIENT_SETUP_TTL_MS };
  });
  return client ? token : null;
}

/** The index line, the client's data documents and the record itself. */
export async function deleteClient(id: string, dataKeys: string[]): Promise<void> {
  if (!isClientId(id)) return;
  await changeIndex((ids) => ids.filter((x) => x !== id));
  for (const key of dataKeys) await cabinetStore().remove(key);
  await cabinetStore().remove(clientKey(id));
}

/* ---------- the bot's key ----------
   Each client's bot signs its pushes with its OWN secret, so one bot can
   write into one cabinet only. HMAC needs the secret itself, not a hash, so
   it is stored sealed: AES-256-GCM under a key derived from
   CABINET_HMAC_SECRET, which lives in the environment and never in the store.
   A leaked store alone signs nothing. The plain secret is shown to the owner
   once, at issue. */

function sealingKey(): Buffer | null {
  const secret = process.env.CABINET_HMAC_SECRET;
  return secret ? createHash("sha256").update(`client-ingest-key:${secret}`).digest() : null;
}

function sealKey(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
}

/** The bot's signing secret, or null: none issued, or it does not open (the env secret changed). */
export function ingestSecret(client: Client): string | null {
  const key = sealingKey();
  if (!key || !client.ingest) return null;
  const [iv, tag, body] = client.ingest.sealed.split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !body || iv.length !== 12 || tag.length !== 16) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** A new key for the client's bot; the previous one stops working at once. */
export async function issueIngestKey(id: string, nowMs = Date.now()): Promise<{ secret: string } | "no_client" | "not_configured"> {
  const key = sealingKey();
  if (!key) return "not_configured";
  const secret = randomBytes(32).toString("base64url");
  const client = await updateClient(id, (c) => {
    c.ingest = { sealed: sealKey(secret, key), createdAt: nowMs };
  });
  return client ? { secret } : "no_client";
}

/* ---------- sessions ---------- */

const mac = (key: string, payload: string) => createHmac("sha256", Buffer.from(key, "hex")).update(payload).digest("base64url");

function makeSession(client: Client, nowMs: number): string {
  const payload = `${client.id}.${Math.floor(nowMs / 1000) + CLIENT_SESSION_TTL_SECONDS}`;
  return `${payload}.${mac(client.auth.sessionKey!, payload)}`;
}

/** The client a cookie belongs to — or null. `expectId` pins it to the page being opened. */
export async function signedInClient(cookie: string | undefined, expectId?: string, nowMs = Date.now()): Promise<Client | null> {
  if (!cookie) return null;
  const [id, expires, given] = cookie.split(".");
  if (!isClientId(id) || !expires || !given || !/^\d{1,12}$/.test(expires)) return null;
  if (expectId !== undefined && id !== expectId) return null;
  if (Number(expires) * 1000 < nowMs) return null;
  const found = await readClient(id);
  if (!found?.client.auth.sessionKey) return null;
  const expected = Buffer.from(mac(found.client.auth.sessionKey, `${id}.${expires}`));
  const got = Buffer.from(given);
  return got.length === expected.length && timingSafeEqual(got, expected) ? found.client : null;
}

export function clientCookieValue(request: Request): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CLIENT_COOKIE) return rest.join("=");
  }
  return undefined;
}

export const clientCookieOptions = {
  httpOnly: true,
  secure: true,
  // lax, not strict: the client comes BACK from monobank's payment page by a
  // cross-site redirect and must land signed in. Every state change is a POST.
  sameSite: "lax" as const,
  path: "/",
  maxAge: CLIENT_SESSION_TTL_SECONDS,
};

/* ---------- setup link and login ---------- */

function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

const linkOk = (client: Client, token: string, nowMs: number) =>
  !!client.auth.setup && client.auth.setup.expiresAt > nowMs && sameHex(client.auth.setup.tokenHash, hashSetupToken(token));

export async function clientSetupValid(id: string, token: string | undefined, nowMs = Date.now()): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const found = await readClient(id);
  return !!found && linkOk(found.client, token, nowMs);
}

export type ClientSetupOutcome = { ok: true; session: string } | { ok: false; error: "bad_link" | "weak_password" | "mismatch" };

/** Spends the link and sets the password in one conditional write (the loser of a race gets `bad_link`). */
export async function completeClientSetup(id: string, token: string, password: string, repeat: string, nowMs = Date.now()): Promise<ClientSetupOutcome> {
  const found = await readClient(id);
  if (!found || !linkOk(found.client, token, nowMs)) return { ok: false, error: "bad_link" };
  const problem = passwordProblem(password, repeat);
  if (problem) return { ok: false, error: problem };
  const client = found.client;
  client.auth = {
    password: await hashPassword(password),
    sessionKey: randomBytes(32).toString("hex"),
    setup: null,
    failures: { since: 0, count: 0 },
  };
  try {
    await writeClient(client, found.etag);
  } catch (error) {
    if (error instanceof StoreConflictError) return { ok: false, error: "bad_link" };
    throw error;
  }
  return { ok: true, session: makeSession(client, nowMs) };
}

export type ClientLoginOutcome = { ok: true; session: string } | { ok: false; error: "bad_password" | "locked" | "not_set" };

export async function clientLogin(id: string, password: string, nowMs = Date.now()): Promise<ClientLoginOutcome> {
  const found = await readClient(id);
  // An unknown id answers like a wrong password: the form does not tell which ids exist.
  if (!found) return { ok: false, error: "bad_password" };
  const { client, etag } = found;
  if (!client.auth.password || !client.auth.sessionKey) return { ok: false, error: "not_set" };
  const windowOpen = nowMs - client.auth.failures.since < CLIENT_FAILURE_WINDOW_MS;
  if (windowOpen && client.auth.failures.count >= CLIENT_FAILURE_LIMIT) return { ok: false, error: "locked" };

  if (password.length > 0 && password.length <= MAX_PASSWORD && (await checkPassword(password, client.auth.password))) {
    return { ok: true, session: makeSession(client, nowMs) };
  }
  client.auth.failures = windowOpen ? { since: client.auth.failures.since, count: client.auth.failures.count + 1 } : { since: nowMs, count: 1 };
  try {
    await writeClient(client, etag);
  } catch (error) {
    if (!(error instanceof StoreConflictError)) throw error;
  }
  return { ok: false, error: "bad_password" };
}
