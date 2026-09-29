import type { Db } from "./db.ts";
import { tx } from "./db.ts";

/* Funnel: new → contacted → qualified → proposal → won | lost.
   Forward jumps are allowed (a lead can be qualified on the first call);
   going back is not, except “reopen” of a closed lead to contacted.
   max_stage remembers the furthest stage reached, so a lead qualified and
   later lost still counts as qualified in the stage conversions. */

export const STAGES = ["new", "contacted", "qualified", "proposal", "won"] as const;
export const STATUSES = [...STAGES, "lost"] as const;
export type Status = (typeof STATUSES)[number];

export const LOST_REASONS = {
  too_expensive: "дорого",
  wrong_segment: "не наш сегмент",
  no_response: "не отвечает",
  chose_other: "выбрал другого",
  spam: "спам",
  other: "другое",
} as const;
export type LostReason = keyof typeof LOST_REASONS;

export const STATUS_LABELS: Record<Status, string> = {
  new: "новая",
  contacted: "связались",
  qualified: "квалифицирована",
  proposal: "предложение",
  won: "сделка",
  lost: "отказ",
};

export function stageIndex(s: Status): number {
  return s === "lost" ? -1 : STAGES.indexOf(s);
}

export class FunnelError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface TransitionInput {
  to: Status;
  actor: string;
  reason?: LostReason;
  amount?: number;
  currency?: string;
}

export interface Transition {
  lead_id: string;
  from: Status;
  to: Status;
  at: string;
}

export function setStatus(db: Db, leadId: string, input: TransitionInput, now = new Date()): Transition {
  return tx(db, () => {
    const row = db.prepare("SELECT status, max_stage FROM leads WHERE lead_id = ?").get(leadId) as
      | { status: Status; max_stage: number }
      | undefined;
    if (!row) throw new FunnelError("not_found", "lead not found");
    const from = row.status;
    const to = input.to;
    if (!STATUSES.includes(to)) throw new FunnelError("bad_status", `unknown status ${String(to)}`);
    if (from === to) throw new FunnelError("same_status", `already ${to}`);

    const closed = from === "won" || from === "lost";
    if (closed && to !== "contacted") {
      throw new FunnelError("closed", `lead is ${from}; only reopen to contacted is allowed`);
    }
    if (!closed && to !== "lost" && stageIndex(to) <= stageIndex(from)) {
      throw new FunnelError("backwards", `cannot move ${from} → ${to}`);
    }
    if (to === "lost" && !(input.reason && input.reason in LOST_REASONS)) {
      throw new FunnelError("reason_required", "lost needs a reason: " + Object.keys(LOST_REASONS).join(", "));
    }
    let amount: number | null = null;
    let currency: string | null = null;
    if (to === "won") {
      if (!(typeof input.amount === "number" && Number.isFinite(input.amount) && input.amount > 0)) {
        throw new FunnelError("amount_required", "won needs a positive amount");
      }
      if (!input.currency || !/^[A-Z]{3}$/.test(input.currency)) {
        throw new FunnelError("currency_required", "won needs an ISO currency code, e.g. EUR");
      }
      amount = input.amount;
      currency = input.currency;
    }
    const at = now.toISOString();
    const maxStage = Math.max(row.max_stage, stageIndex(to));
    db.prepare(
      `UPDATE leads SET status = ?, max_stage = ?, status_at = ?,
         lost_reason = ?, deal_amount = COALESCE(?, deal_amount), deal_currency = COALESCE(?, deal_currency)
       WHERE lead_id = ?`,
    ).run(to, maxStage, at, to === "lost" ? input.reason! : null, amount, currency, leadId);
    db.prepare(
      "INSERT INTO lead_events(lead_id, at, from_status, to_status, actor, reason, amount, currency) VALUES(?,?,?,?,?,?,?,?)",
    ).run(leadId, at, from, to, input.actor, input.reason ?? null, amount, currency);
    return { lead_id: leadId, from, to, at };
  });
}

/** Accepts a full UUID or a unique prefix of at least 8 characters (the bot shows 8). */
export function resolveLeadId(db: Db, idOrPrefix: string): string {
  const p = idOrPrefix.toLowerCase();
  if (p.length < 8 || !/^[0-9a-f-]+$/.test(p)) throw new FunnelError("bad_id", "need at least 8 hex characters");
  const rows = db.prepare("SELECT lead_id FROM leads WHERE lead_id LIKE ? LIMIT 2").all(p + "%") as {
    lead_id: string;
  }[];
  if (rows.length === 0) throw new FunnelError("not_found", "lead not found");
  if (rows.length > 1) throw new FunnelError("ambiguous", "prefix matches several leads");
  return rows[0].lead_id;
}
