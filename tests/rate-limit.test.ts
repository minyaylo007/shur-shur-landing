import { describe, it, expect } from "vitest";
import { rateLimit } from "../src/lib/rate-limit";

describe("rateLimit (sliding window 5 req / 10 min)", () => {
  it("allows the first 5 requests and blocks the 6th", () => {
    const key = "test-ip-block";
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, { now }).allowed).toBe(true);
    }
    expect(rateLimit(key, { now }).allowed).toBe(false);
  });

  it("allows again once old requests slide out of the window", () => {
    const key = "test-ip-window";
    const now = 2_000_000;
    for (let i = 0; i < 5; i++) {
      rateLimit(key, { now });
    }
    expect(rateLimit(key, { now }).allowed).toBe(false);
    // 10 minutes + 1ms later the window has fully slid
    expect(rateLimit(key, { now: now + 10 * 60 * 1000 + 1 }).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const now = 3_000_000;
    for (let i = 0; i < 5; i++) {
      rateLimit("ip-a", { now });
    }
    expect(rateLimit("ip-a", { now }).allowed).toBe(false);
    expect(rateLimit("ip-b", { now }).allowed).toBe(true);
  });

  it("caps total tracked keys at 10 000 and evicts the oldest (bounded XFF rotation)", () => {
    const now = 4_000_000;
    const victim = "cap-victim";
    for (let i = 0; i < 5; i++) {
      rateLimit(victim, { now });
    }
    expect(rateLimit(victim, { now }).allowed).toBe(false);

    // A bot rotating spoofed x-forwarded-for values must not grow the map
    // unboundedly: past the cap, the oldest-inserted keys are evicted.
    for (let i = 0; i < 10_000; i++) {
      rateLimit(`cap-rotate-${i}`, { now });
    }

    // The victim's history was evicted → treated as a fresh client again.
    expect(rateLimit(victim, { now }).allowed).toBe(true);
  });
});
