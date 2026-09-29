import { createHash } from "node:crypto";

/* One normalisation, two uses: duplicate detection (same person within 30
   days) and the SHA-256 identifiers sent to Meta. Meta's rules: e-mail
   trimmed and lower-cased; phone digits only, with the country code. A
   Telegram/Instagram handle is lower-cased without the @ — good for
   duplicates, but Meta has no field for it, so it is never sent there. */

export type ContactKind = "email" | "phone" | "handle";

export interface NormalizedContact {
  kind: ContactKind;
  value: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Default country codes for local numbers, by market. */
const LOCAL_PREFIX: Record<string, { trunk: string; cc: string }> = {
  suceava: { trunk: "0", cc: "40" },
  tel_aviv: { trunk: "0", cc: "972" },
};

export function normalizeContact(raw: string, market?: string): NormalizedContact | null {
  const s = raw.trim().normalize("NFKC");
  if (!s) return null;
  if (EMAIL_RE.test(s)) return { kind: "email", value: s.toLowerCase() };

  // A phone: only digits and phone punctuation, at least 7 digits.
  if (/^[+()\d\s.\-/]+$/.test(s)) {
    let digits = s.replace(/\D/g, "");
    if (digits.length >= 7) {
      if (s.startsWith("00")) digits = digits.slice(2);
      else if (!s.startsWith("+")) {
        const local = market ? LOCAL_PREFIX[market] : undefined;
        if (local && digits.startsWith(local.trunk) && !digits.startsWith(local.cc)) {
          digits = local.cc + digits.slice(local.trunk.length);
        }
      }
      return { kind: "phone", value: digits };
    }
  }

  const handle = s
    .replace(/^https?:\/\/(www\.)?(t\.me|instagram\.com)\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  return handle ? { kind: "handle", value: handle } : null;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Duplicate key: kind-prefixed so an e-mail never collides with a handle. */
export function contactHash(n: NormalizedContact): string {
  return sha256Hex(`${n.kind}:${n.value}`);
}
