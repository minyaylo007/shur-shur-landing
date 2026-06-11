import { z } from "zod";
import { locales } from "./i18n";

/**
 * Shared lead-form schema (client pre-submit + server route).
 *
 * NOTE on the honeypot: `extra_field` intentionally PASSES validation with
 * any value so that bots never receive a revealing 400 — spam is detected
 * separately via `isSpam()` and answered with a silent 200. The name is
 * deliberately meaningless so browser/extension autofill never classifies
 * it (autofilled honeypots silently kill real leads).
 */
/** Instagram handle: 2–60 of [a-z0-9._], an optional leading @ (cycle 4). */
export const IG_HANDLE_RE = /^@?[a-zA-Z0-9._]{2,60}$/;

export const leadSchema = z
  .object({
    /**
     * Request type (cycle 4): "lead" = classic contact form,
     * "audit" = one-field free Instagram audit from the hero card.
     * Same endpoint, same honeypot/rate-limit/elapsedMs pipeline.
     */
    kind: z.enum(["lead", "audit"]).default("lead"),
    name: z.string().trim().min(2).max(100).optional(),
    contact: z.string().trim().min(3).max(100).optional(),
    message: z.string().trim().max(1000).optional(),
    /** Instagram nickname for audit requests (with or without the @). */
    igHandle: z.string().trim().regex(IG_HANDLE_RE).optional(),
    /** Honeypot field — must stay empty for humans. */
    extra_field: z.string().max(200).optional().default(""),
    /** Time between form mount and submit, measured on the client. */
    elapsedMs: z.number(),
    /** Page locale — single source of truth is lib/i18n. */
    locale: z.enum(locales).optional(),
  })
  .superRefine((data, ctx) => {
    // Per-kind required fields. Length/charset rules above still apply
    // whenever a field IS present, for either kind.
    if (data.kind === "lead") {
      if (data.name === undefined) {
        ctx.addIssue({ code: "custom", path: ["name"], message: "Required for lead requests" });
      }
      if (data.contact === undefined) {
        ctx.addIssue({ code: "custom", path: ["contact"], message: "Required for lead requests" });
      }
    } else if (data.igHandle === undefined) {
      ctx.addIssue({ code: "custom", path: ["igHandle"], message: "Required for audit requests" });
    }
  });

export type LeadInput = z.input<typeof leadSchema>;
export type Lead = z.output<typeof leadSchema>;

/**
 * Minimum believable fill time (ms), per request kind. The classic lead form
 * has three fields (3000ms floor); the hero audit form is ONE paste-able
 * field — holding it to the same floor silently killed legit fast
 * submissions, so it gets a much lower 1200ms floor (REM-FIX-C4).
 */
export const MIN_ELAPSED_MS: Record<Lead["kind"], number> = {
  lead: 3000,
  audit: 1200,
};

/** Honeypot tripped OR submitted suspiciously fast (per-kind) → spam. */
export function isSpam(lead: Pick<Lead, "kind" | "extra_field" | "elapsedMs">): boolean {
  return lead.extra_field !== "" || lead.elapsedMs < MIN_ELAPSED_MS[lead.kind];
}
