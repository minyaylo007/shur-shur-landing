import { log } from "../log.ts";

/* The write layer. In this version there is NO implementation that talks to
   an ad platform: `AdsWriter` is an interface, and the only class that
   implements it is the simulator, which changes nothing anywhere and just
   reports what it would have done. A real writer (ads_management scope) is a
   separate, owner-approved step. */

export interface BudgetChange {
  objectId: string;
  level: "campaign" | "adset";
  fromDaily: number;
  toDaily: number;
  currency: string;
}

export interface WriteResult {
  ok: boolean;
  simulated: boolean;
  detail: string;
}

export interface AdsWriter {
  readonly kind: "simulator";
  /** Must be idempotent on idemKey: a second call with the same key is a no-op. */
  setDailyBudget(change: BudgetChange, idemKey: string): Promise<WriteResult>;
}

export class SimulatorWriter implements AdsWriter {
  readonly kind = "simulator" as const;
  private readonly seen = new Set<string>();

  async setDailyBudget(change: BudgetChange, idemKey: string): Promise<WriteResult> {
    if (this.seen.has(idemKey)) {
      return { ok: true, simulated: true, detail: "повтор: уже выполнено (симуляция)" };
    }
    this.seen.add(idemKey);
    log("writer.simulated", {
      object_id: change.objectId,
      level: change.level,
      from: change.fromDaily,
      to: change.toDaily,
      currency: change.currency,
      idem_key: idemKey,
    });
    return {
      ok: true,
      simulated: true,
      detail: `симуляция: дневной бюджет ${change.fromDaily} → ${change.toDaily} ${change.currency}, в Meta ничего не отправлено`,
    };
  }
}
