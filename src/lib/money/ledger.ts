/**
 * «Гроші» — Sasha's money at one glance: what came in, what went out, what
 * is left for her. Pure functions over a statement in the shape of the
 * monobank PERSONAL API (api.monobank.ua/docs, /personal/statement): amounts
 * in kopecks, `time` in unix seconds, out is negative. Stage 1 feeds it demo
 * data; stage 2 swaps only the source.
 *
 * The owner's rule (simplicity): an answer to «прийшло / пішло / залишилось»
 * and nothing else. Less precise but clear beats exact and confusing.
 *
 * Money path: clients pay the FOP account → Sasha moves it to her white card
 * (work only) → people. Her own money goes to the pink (platinum) card.
 */

/** monobank account types we read; `platinum` is the pink card. */
export type AccountType = "fop" | "white" | "platinum";

export interface Account {
  id: string;
  type: AccountType;
  iban: string;
}

/** One statement line, as the personal API returns it, plus the account it came from. */
export interface Operation {
  id: string;
  account: string;
  time: number;
  description: string;
  mcc: number;
  amount: number;
  counterName?: string;
  counterIban?: string;
}

export type Category = "income" | "self" | "team" | "taxes" | "ads" | "other" | "sort" | "skip";
/** What Sasha can put an unknown recipient into with one tap. */
export type Spend = "team" | "taxes" | "ads" | "other";
export const SPENDS: Spend[] = ["team", "taxes", "ads", "other"];

/** A remembered decision about one recipient: once sorted — sorted forever. */
export interface Rule {
  category: Spend;
  /** How the recipient is called on the page (team members by name). */
  name: string;
}
export type Rules = Record<string, Rule>;

/** The recipient an operation is remembered by: IBAN first, then name, then the bank's description. */
export const recipientKey = (op: Operation) => op.counterIban ?? op.counterName ?? op.description;
export const recipientName = (op: Operation) => op.counterName ?? op.description;

const TAX = /ДПС|казнач|ЄСВ|єдиний внесок|єдиний податок|військовий збір/i;
/** Advertising, software, digital services, hosting, telecom. */
const ADS_MCC = new Set([7311, 7372, 7399, 5734, 5817, 5818, 4814, 4816, 4899]);
/** Money transfers: a person or a firm we have not met yet. */
const TRANSFER_MCC = new Set([4829, 6012, 6538]);

export function classify(op: Operation, accounts: Account[], rules: Rules, plan: Plan = []): Category {
  const account = accounts.find((a) => a.id === op.account);
  if (!account || account.type === "platinum") return "skip"; // pink card purchases are hers, not the business's
  const own = accounts.find((a) => op.counterIban !== undefined && a.iban === op.counterIban);
  if (own) return own.type === "platinum" && op.amount < 0 ? "self" : "skip"; // FOP ⇄ white is not money moving anywhere
  if (op.amount > 0) return account.type === "fop" ? "income" : "skip";
  if (planRowOf(op, accounts, plan)) return "team";
  const rule = rules[recipientKey(op)];
  if (rule) return rule.category;
  if (TAX.test(op.description) || TAX.test(op.counterName ?? "")) return "taxes";
  if (ADS_MCC.has(op.mcc)) return "ads";
  if (TRANSFER_MCC.has(op.mcc) || op.counterIban) return "sort";
  return "other";
}

/** Sasha put one operation into a category: remember the recipient, not the operation. */
export function remember(rules: Rules, op: Operation, category: Spend): Rules {
  return { ...rules, [recipientKey(op)]: { category, name: recipientName(op) } };
}

/* ---------- the payout plan: the one setting ---------- */

/** One line of the plan: who, how much, which day of the month, for which client (optional). */
export interface PlanRow {
  id: string;
  name: string;
  /** what the white card's statement calls this person (the recipient key) */
  recipient: string;
  /** kopecks */
  amount: number;
  day: number;
  /** part of the payer's name as the FOP statement shows it */
  client?: string;
}
export type Plan = PlanRow[];

const DAY = 86_400;
/** A payout a few days off its planned date is still that payout. */
export const PLAN_SLACK_DAYS = 4;
/** «за <клієнт>» when that client paid within this many days before the payout. */
export const CLIENT_LOOKBACK_DAYS = 5;

/** Kyiv calendar date of an operation, as [year, month 1..12, day]. */
function kyivDate(time: number): [number, number, number] {
  const [y, m, d] = new Date(time * 1000).toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv" }).split("-").map(Number);
  return [y, m, d];
}
/** A calendar date as a day count, so date distances ignore hours and DST. */
const dayNumber = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 86_400_000;
const isoOf = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** The plan's day in a given month; the 31st in a short month falls on its last day. */
const planDay = (row: PlanRow, y: number, m: number) => Math.min(row.day, lastDay(y, m));

/** The plan row a white-card transfer to a stranger pays: same recipient, same sum, near the planned day. */
export function planRowOf(op: Operation, accounts: Account[], plan: Plan): PlanRow | undefined {
  if (op.amount >= 0 || accounts.find((a) => a.id === op.account)?.type !== "white") return undefined;
  const [y, m, d] = kyivDate(op.time);
  const today = dayNumber(y, m, d);
  return plan.find((row) => {
    if (row.recipient !== recipientKey(op) || row.amount !== -op.amount) return false;
    // the planned date this month, last month and next month — a payout on the 30th may be the 2nd's
    return [-1, 0, 1].some((shift) => {
      const pm = ((m - 1 + shift + 12) % 12) + 1;
      const py = y + Math.floor((m - 1 + shift) / 12);
      return Math.abs(dayNumber(py, pm, planDay(row, py, pm)) - today) <= PLAN_SLACK_DAYS;
    });
  });
}

/** «за <клієнт>»: the row names a client and that client paid the FOP shortly before this payout. */
export function paidFor(op: Operation, row: PlanRow, ops: Operation[], accounts: Account[]): string | undefined {
  if (!row.client) return undefined;
  const client = row.client.toLowerCase();
  const fop = new Set(accounts.filter((a) => a.type === "fop").map((a) => a.id));
  const paid = ops.some(
    (o) =>
      fop.has(o.account) &&
      o.amount > 0 &&
      (o.counterName ?? "").toLowerCase().includes(client) &&
      o.time <= op.time &&
      o.time >= op.time - CLIENT_LOOKBACK_DAYS * DAY,
  );
  return paid ? row.client : undefined;
}

export interface Payout {
  row: PlanRow;
  /** the planned day this month */
  day: number;
  /** day of the month it was paid, when it was */
  paidOn?: number;
  /** «за <клієнт>» when the money for it had come in */
  forClient?: string;
}

/** Every plan row in one month, by planned day: paid (and on which day) or still due. */
export function payouts(ops: Operation[], accounts: Account[], plan: Plan, month: string): Payout[] {
  const [y, m] = month.split("-").map(Number);
  const inMonth = ops.filter((o) => monthOf(o.time) === month);
  return plan
    .map((row) => {
      const op = inMonth.find((o) => planRowOf(o, accounts, [row]) === row);
      return { row, day: planDay(row, y, m), paidOn: op ? kyivDate(op.time)[2] : undefined, forClient: op ? paidFor(op, row, ops, accounts) : undefined };
    })
    .sort((a, b) => a.day - b.day);
}

export interface Reminder {
  /** ISO date the payouts are due */
  date: string;
  items: { name: string; amount: number }[];
  total: number;
}

/** What the plan says to pay on one date and is not paid yet. No items — nothing to remind. */
export function dueOn(ops: Operation[], accounts: Account[], plan: Plan, date: string): Reminder {
  const d = Number(date.slice(8, 10));
  const items = payouts(ops, accounts, plan, date.slice(0, 7))
    .filter((p) => p.day === d && p.paidOn === undefined)
    .map((p) => ({ name: p.row.name, amount: p.row.amount }));
  return { date, items, total: items.reduce((s, i) => s + i.amount, 0) };
}

/** Tomorrow's reminder (the Telegram message is the next step): who, how much, total. `now` in unix seconds. */
export function remindTomorrow(ops: Operation[], accounts: Account[], plan: Plan, now: number): Reminder {
  const [y, m, d] = kyivDate(now);
  return dueOn(ops, accounts, plan, isoOf(dayNumber(y, m, d) + 1));
}

/** The nearest date with unpaid plan payouts, today included, up to two months ahead. */
export function nextPayout(ops: Operation[], accounts: Account[], plan: Plan, now: number): Reminder | undefined {
  const [y, m, d] = kyivDate(now);
  const today = dayNumber(y, m, d);
  for (let i = 0; plan.length > 0 && i <= 62; i++) {
    const r = dueOn(ops, accounts, plan, isoOf(today + i));
    if (r.items.length) return r;
  }
  return undefined;
}

/* ---------- taxes ---------- */

/** FOP 3rd group, one year per entry. Rates of «Прийшло»; ЄСВ is a flat monthly sum. */
export interface TaxYear {
  single: number;
  military: number;
  /** kopecks per month */
  esv: number;
  /** Payment deadline per quarter (1..4) as [month (1..12), day, +year]. The earliest of the taxes due. */
  deadlines: Record<1 | 2 | 3 | 4, [number, number, number]>;
}

/** 2026: 5 % + 1 % military levy; ЄСВ 22 % of the minimum wage 8 647 = 1 902,34 грн; ЄСВ is due by the
 *  20th of the month after the quarter (the single tax later, on the 19th of the second month — we show the earlier). */
export const TAXES: Record<number, TaxYear> = {
  2026: {
    single: 0.05,
    military: 0.01,
    esv: 190_234,
    deadlines: { 1: [4, 20, 0], 2: [7, 20, 0], 3: [10, 20, 0], 4: [1, 20, 1] },
  },
};

export interface TaxDue {
  /** what this month's income owes, kopecks */
  due: number;
  /** already paid this month (operations in «Податки») */
  paid: number;
  /** what is still to put aside */
  setAside: number;
  /** ISO date to pay by */
  by: string;
}

/** `month` is "YYYY-MM". A year without its config is refused loudly — wrong taxes are worse than none. */
export function taxes(month: string, income: number, paid: number): TaxDue {
  const [year, m] = month.split("-").map(Number);
  const cfg = TAXES[year];
  if (!cfg) throw new Error(`no tax config for ${year}`);
  const due = Math.round(income * (cfg.single + cfg.military)) + cfg.esv;
  const quarter = (Math.floor((m - 1) / 3) + 1) as 1 | 2 | 3 | 4;
  const [dm, dd, dy] = cfg.deadlines[quarter];
  const by = `${year + dy}-${String(dm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  return { due, paid, setAside: Math.max(0, due - paid), by };
}

/* ---------- one month ---------- */

/** "YYYY-MM" of an operation, in Kyiv time. */
export const monthOf = (time: number) => new Date(time * 1000).toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 7);

export interface Month {
  month: string;
  income: number;
  /** everything that left the business: four categories plus the not yet sorted */
  spent: number;
  by: Record<Spend, number>;
  /** team members, biggest first */
  team: { name: string; amount: number }[];
  toSort: Operation[];
  self: number;
  tax: TaxDue;
  /** income − spent − taxes still to put aside */
  left: number;
}

/** All sums positive, in kopecks. */
export function summarize(ops: Operation[], accounts: Account[], rules: Rules, month: string, plan: Plan = []): Month {
  const by: Record<Spend, number> = { team: 0, taxes: 0, ads: 0, other: 0 };
  const team = new Map<string, number>();
  const toSort: Operation[] = [];
  let income = 0;
  let self = 0;
  let unsorted = 0;
  for (const op of ops) {
    if (monthOf(op.time) !== month) continue;
    const c = classify(op, accounts, rules, plan);
    const sum = Math.abs(op.amount);
    if (c === "income") income += sum;
    else if (c === "self") self += sum;
    else if (c === "sort") {
      unsorted += sum;
      toSort.push(op);
    } else if (c !== "skip") {
      by[c] += sum;
      if (c === "team") {
        const name = planRowOf(op, accounts, plan)?.name ?? rules[recipientKey(op)]?.name ?? recipientName(op);
        team.set(name, (team.get(name) ?? 0) + sum);
      }
    }
  }
  const spent = by.team + by.taxes + by.ads + by.other + unsorted;
  const tax = taxes(month, income, by.taxes);
  return {
    month,
    income,
    spent,
    by,
    team: [...team].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
    toSort: toSort.sort((a, b) => b.time - a.time),
    self,
    tax,
    left: income - spent - tax.setAside,
  };
}

/** Months present in the statement, oldest first. */
export const monthsOf = (ops: Operation[]) => [...new Set(ops.map((o) => monthOf(o.time)))].sort();
