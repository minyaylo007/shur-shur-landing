/**
 * In-memory sliding-window rate limiter.
 *
 * CAVEAT (documented by design): state lives in the Node process memory —
 * it resets on every deploy/restart and is NOT shared between serverless
 * instances. For a landing-page lead form this is an acceptable trade-off;
 * swap for Redis/Upstash if the site moves to multi-instance hosting.
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const LIMIT = 5; // max requests per window
const MAX_KEYS = 10_000; // hard cap — bounds memory against rotating spoofed XFF

const hits = new Map<string, number[]>();

export interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
  /** Injectable clock for tests. */
  now?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export function rateLimit(key: string, options: RateLimitOptions = {}): RateLimitResult {
  const { limit = LIMIT, windowMs = WINDOW_MS, now = Date.now() } = options;

  const windowStart = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return { allowed: false, remaining: 0 };
  }

  recent.push(now);

  // Hard cap on tracked keys: evict the oldest-inserted entry so a client
  // rotating x-forwarded-for values cannot grow the map without bound.
  if (!hits.has(key) && hits.size >= MAX_KEYS) {
    const oldest = hits.keys().next().value;
    if (oldest !== undefined) hits.delete(oldest);
  }
  hits.set(key, recent);

  // Opportunistic cleanup of fully-stale keys.
  if (hits.size > 5000) {
    for (const [k, stamps] of hits) {
      if (stamps.every((t) => t <= windowStart)) hits.delete(k);
    }
  }

  return { allowed: true, remaining: limit - recent.length };
}
