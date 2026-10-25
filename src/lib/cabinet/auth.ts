import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AUTH_KEY, cabinetStore, StoreConflictError } from "./store";

/**
 * Cabinet auth: one person, one password, view only. Server-only.
 *
 * - The password is set by her, through a one-time link that ads-engine's
 *   ops script issues (ops/cabinet/setup-link.mjs). The site receives only
 *   the SHA-256 of the link token and its expiry; the token itself lives in a
 *   600 file on ace-main and in her browser.
 * - Stored: scrypt hash + salt. Never the password, never in a log.
 * - Session: httpOnly cookie, HMAC-signed with a random key from the auth
 *   state. A new password rotates the key, so every old session dies.
 * - Login attempts are limited per IP (lib/rate-limit, per instance) AND
 *   globally in the stored state, so a cold start does not reset the count.
 */

export const SESSION_COOKIE = "shur_cabinet";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SETUP_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 200;
/** Failed logins across all IPs before the cabinet stops checking passwords. */
export const GLOBAL_FAILURE_LIMIT = 30;
export const GLOBAL_FAILURE_WINDOW_MS = 60 * 60 * 1000;

const SCRYPT = { N: 1 << 15, r: 8, p: 1, keylen: 64 } as const;

const authSchema = z.object({
  password: z.object({ salt: z.string(), hash: z.string() }).nullable(),
  sessionKey: z.string().nullable(),
  setup: z.object({ tokenHash: z.string(), expiresAt: z.number() }).nullable(),
  failures: z.object({ since: z.number(), count: z.number() }),
});

export type AuthState = z.infer<typeof authSchema>;

const EMPTY: AuthState = { password: null, sessionKey: null, setup: null, failures: { since: 0, count: 0 } };

export async function readAuth(): Promise<{ state: AuthState; etag: string | undefined }> {
  const stored = await cabinetStore().read(AUTH_KEY);
  if (!stored) return { state: structuredClone(EMPTY), etag: undefined };
  const parsed = authSchema.safeParse(JSON.parse(stored.text));
  if (!parsed.success) throw new Error("cabinet auth state is malformed");
  return { state: parsed.data, etag: stored.etag };
}

async function writeAuth(state: AuthState, etag: string | undefined): Promise<void> {
  await cabinetStore().write(AUTH_KEY, JSON.stringify(state), etag);
}

function scryptHash(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password.normalize("NFC"),
      salt,
      SCRYPT.keylen,
      { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}

export async function hashPassword(password: string): Promise<{ salt: string; hash: string }> {
  const salt = randomBytes(16);
  return { salt: salt.toString("base64"), hash: (await scryptHash(password, salt)).toString("base64") };
}

export async function checkPassword(password: string, stored: { salt: string; hash: string }): Promise<boolean> {
  const expected = Buffer.from(stored.hash, "base64");
  const given = await scryptHash(password, Buffer.from(stored.salt, "base64"));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function hashSetupToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/* ---------- sessions ---------- */

function sessionMac(key: string, payload: string): string {
  return createHmac("sha256", Buffer.from(key, "hex")).update(payload).digest("base64url");
}

export function makeSession(key: string, nowMs = Date.now()): string {
  const payload = String(Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS);
  return `${payload}.${sessionMac(key, payload)}`;
}

export function sessionValid(key: string | null, cookie: string | undefined, nowMs = Date.now()): boolean {
  if (!key || !cookie) return false;
  const [payload, mac] = cookie.split(".");
  if (!payload || !mac || !/^\d{1,12}$/.test(payload)) return false;
  if (Number(payload) * 1000 < nowMs) return false;
  const expected = Buffer.from(sessionMac(key, payload));
  const given = Buffer.from(mac);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function isSignedIn(cookie: string | undefined): Promise<boolean> {
  if (!cookie) return false;
  const { state } = await readAuth();
  return sessionValid(state.sessionKey, cookie);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

/* ---------- setup link ---------- */

/** ops → site: a new link replaces any earlier one that was not used. */
export async function issueSetup(tokenHash: string, expiresAt: number): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { state, etag } = await readAuth();
    state.setup = { tokenHash, expiresAt };
    try {
      return await writeAuth(state, etag);
    } catch (error) {
      if (!(error instanceof StoreConflictError)) throw error;
    }
  }
  throw new StoreConflictError();
}

export async function setupLinkValid(token: string | undefined, nowMs = Date.now()): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const { state } = await readAuth();
  return !!state.setup && state.setup.expiresAt > nowMs && sameHex(state.setup.tokenHash, hashSetupToken(token));
}

export function passwordProblem(password: string, repeat: string): "weak_password" | "mismatch" | null {
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) return "weak_password";
  if (password !== repeat) return "mismatch";
  return null;
}

export type SetupOutcome = { ok: true; session: string } | { ok: false; error: "bad_link" | "weak_password" | "mismatch" };

/**
 * Spends the link and sets the password in ONE conditional write: whoever
 * loses a race for the same link sees the etag moved and gets `bad_link`.
 */
export async function completeSetup(
  token: string,
  password: string,
  repeat: string,
  nowMs = Date.now(),
): Promise<SetupOutcome> {
  const { state, etag } = await readAuth();
  if (!state.setup || state.setup.expiresAt <= nowMs || !sameHex(state.setup.tokenHash, hashSetupToken(token))) {
    return { ok: false, error: "bad_link" };
  }
  const problem = passwordProblem(password, repeat);
  if (problem) return { ok: false, error: problem };

  const sessionKey = randomBytes(32).toString("hex");
  const next: AuthState = {
    password: await hashPassword(password),
    sessionKey,
    setup: null,
    failures: { since: 0, count: 0 },
  };
  try {
    await writeAuth(next, etag);
  } catch (error) {
    if (error instanceof StoreConflictError) return { ok: false, error: "bad_link" };
    throw error;
  }
  return { ok: true, session: makeSession(sessionKey, nowMs) };
}

/* ---------- login ---------- */

export type LoginOutcome = { ok: true; session: string } | { ok: false; error: "bad_password" | "locked" | "not_set" };

export async function login(password: string, nowMs = Date.now()): Promise<LoginOutcome> {
  const { state, etag } = await readAuth();
  if (!state.password || !state.sessionKey) return { ok: false, error: "not_set" };
  const windowOpen = nowMs - state.failures.since < GLOBAL_FAILURE_WINDOW_MS;
  if (windowOpen && state.failures.count >= GLOBAL_FAILURE_LIMIT) return { ok: false, error: "locked" };

  if (password.length > 0 && password.length <= MAX_PASSWORD && (await checkPassword(password, state.password))) {
    return { ok: true, session: makeSession(state.sessionKey, nowMs) };
  }
  state.failures = windowOpen ? { since: state.failures.since, count: state.failures.count + 1 } : { since: nowMs, count: 1 };
  try {
    await writeAuth(state, etag);
  } catch (error) {
    // A concurrent write (another failure, a new password) won: the count is
    // one short at worst; the per-IP limit still holds.
    if (!(error instanceof StoreConflictError)) throw error;
  }
  return { ok: false, error: "bad_password" };
}
