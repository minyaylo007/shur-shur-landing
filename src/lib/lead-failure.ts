/**
 * What went wrong with a lead submission — and what the form should DO about
 * it. One record per outcome, because until 15.09.2026 there was one.
 *
 * `/api/lead` has always answered four different failures with four different
 * codes, and the form collapsed all of them into a single `status === "error"`
 * with a single line of copy: «Не надіслалося. Спробуйте ще раз або напишіть
 * нам напряму:». Two of those four make that advice actively wrong:
 *
 *   • 429 — the previous five requests DID arrive. «It did not send» is false,
 *     and «try again» is guaranteed to fail for the next ten minutes.
 *   • 400 `invalid_input` — the same payload will be rejected the same way
 *     forever. «Try again» is a closed loop with no exit; the fix is in a
 *     field, so the person has to be sent back to the field.
 *
 * Hence this table: the failure decides the copy (`dictionaries.*.audit.form
 * .failures[key]`), whether the direct channels are offered, and what the
 * button is allowed to promise. `tests/lead-failures.test.ts` reads the route
 * source and requires every `error` it can return to appear here with copy in
 * all four languages, so a fifth code cannot quietly inherit someone else's
 * sentence.
 */

export interface LeadFailureBehaviour {
  /**
   * What the send button does in this state:
   *   primary   — «try again» is honest and is the main action;
   *   secondary — retrying may work, but the direct channel is the real exit,
   *               so the button goes below the channels as a quiet link;
   *   edit      — the payload itself is wrong: keep the normal «send» label,
   *               resending unchanged is pointless;
   *   none      — retrying cannot succeed right now; show no button at all.
   */
  retry: "primary" | "secondary" | "edit" | "none";
  /** Offer the phone + the ready messengers as a way out of this failure. */
  channels: boolean;
  /** Put the cursor back in the first field — the fix lives in the form. */
  focusField: boolean;
  /** Is this an `error` value the route answers with, or a client-side state? */
  fromServer: boolean;
}

export const LEAD_FAILURES = {
  /** 429 — LIMIT=5 per WINDOW_MS=10min in lib/rate-limit. */
  rate_limited: { retry: "none", channels: true, focusField: false, fromServer: true },
  /** 400 — the body did not parse. Nothing about the content is known. */
  invalid_json: { retry: "primary", channels: true, focusField: false, fromServer: true },
  /** 400 — the server schema rejected what the client schema let through. */
  invalid_input: { retry: "edit", channels: false, focusField: true, fromServer: true },
  /** 502 — Telegram did not take it. Currently the only branch in production. */
  delivery_failed: { retry: "secondary", channels: true, focusField: false, fromServer: true },
  /** fetch threw: offline, DNS, or the 15s AbortSignal.timeout fired. */
  network: { retry: "primary", channels: false, focusField: false, fromServer: false },
  /** A code this build does not know — say exactly that, never guess a cause. */
  unknown: { retry: "primary", channels: true, focusField: false, fromServer: false },
} as const satisfies Record<string, LeadFailureBehaviour>;

export type LeadFailure = keyof typeof LEAD_FAILURES;

/** Copy for one failure. Lives per locale in the dictionaries. */
export interface LeadFailureCopy {
  title: string;
  text: string;
}

function isServerFailure(value: unknown): value is LeadFailure {
  return (
    typeof value === "string" &&
    Object.hasOwn(LEAD_FAILURES, value) &&
    LEAD_FAILURES[value as LeadFailure].fromServer
  );
}

/**
 * Which state a response puts the form into. The body is asked first — it
 * names the cause — and the status code is the fallback for the case where
 * there is no usable body at all (a proxy answered, JSON.parse failed).
 *
 * Only two status classes are read there, and only because HTTP itself
 * defines them: 429 is «too many» whoever sent it, and any 5xx means the
 * request did not get through. A 4xx with no body is NOT guessed into
 * `invalid_input` — being told the wrong reason is worse than being told the
 * reason is unknown.
 */
export function failureOf(status: number, error: unknown): LeadFailure {
  if (isServerFailure(error)) return error;
  if (status === 429) return "rate_limited";
  if (status >= 500) return "delivery_failed";
  return "unknown";
}
