import { z } from "zod";
import { classify, monthOf, SPENDS, type Account, type Operation, type Plan, type ProjectsOf, type Rules } from "./ledger";

/**
 * «Гроші»: everything Sasha sets or teaches the page, in ONE record (the
 * cabinet keeps it in Blob, the demo in the page's memory):
 *  - projects: who pays a known sum a month, in hryvnias or dollars, maybe on
 *    a pause; the second and last setting next to the payout plan;
 *  - the payout plan; remembered recipients (where money went);
 *  - remembered payers (who pays for which projects): the money comes from
 *    some FOP, not under the project's name, and the FOP changes;
 *  - what she typed in by hand: cash, or a bank payment while no bank key;
 *    and a spending the bank does not show (cash out), straight into its category.
 *
 * Simplicity rule: a project is paid in a month when at least one incoming
 * payment is put on it. Sums are not reconciled, dollars are not converted.
 * All amounts in minor units (kopecks, cents).
 */

export const CURRENCIES = ["UAH", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

const id = z.string().min(1).max(40);
const name = z.string().trim().min(1).max(80);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const date = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
const minor = z.number().int().min(0).max(100_000_000_00);

const projectFields = {
  name,
  amount: minor,
  currency: z.enum(CURRENCIES),
  /** first month of the pause; empty — paused from now on */
  pausedFrom: month.optional(),
  /** the month it pays again; the pause ends before it («пауза до березня») */
  pausedUntil: month.optional(),
};
const projectSchema = z.object({ id, ...projectFields });
export type Project = z.infer<typeof projectSchema>;

const entryFields = {
  date,
  amount: minor.min(1),
  currency: z.enum(CURRENCIES),
  /** income: the projects it is for; none — «Інше» (income for no project); a spending has none */
  projects: z.array(id).max(20),
  cash: z.boolean(),
  /** set → this is money that WENT, into this category (hryvnias only) */
  spend: z.enum(SPENDS).optional(),
};
const entrySchema = z.object({ id, ...entryFields });
export type Entry = z.infer<typeof entrySchema>;

const planFields = {
  name,
  /** what the white card's statement calls this person; empty — the name */
  recipient: z.string().trim().max(120),
  amount: minor.min(1),
  day: z.number().int().min(1).max(31),
  project: id.optional(),
};
const planSchema = z.object({ id, ...planFields });

/** A remembered payer: the projects it pays for; none — «Інше» (income, but for no project). */
const payerSchema = z.object({ name: z.string().max(300), projects: z.array(id).max(20) });
export type Payer = z.infer<typeof payerSchema>;

export const bookSchema = z.object({
  version: z.literal(1),
  projects: z.array(projectSchema).max(200),
  plan: z.array(planSchema).max(100),
  rules: z.record(z.string().max(300), z.object({ category: z.enum(SPENDS), name: z.string().max(300) })),
  payers: z.record(z.string().max(300), payerSchema),
  entries: z.array(entrySchema).max(5000),
});
export type Book = z.infer<typeof bookSchema>;

export const emptyBook = (): Book => ({ version: 1, projects: [], plan: [], rules: {}, payers: {}, entries: [] });

/* ---------- what Sasha can do ---------- */

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("project.save"), project: z.object({ id: id.optional(), ...projectFields }) }),
  z.object({ type: z.literal("project.remove"), id }),
  /** income with no project only when Sasha tapped «Інше» (`other`); `create` makes a project (sum 0) right from the step */
  z.object({
    type: z.literal("entry.add"),
    entry: z.object(entryFields),
    other: z.literal(true).optional(),
    create: z.object({ name }).optional(),
  }),
  /** `drop`: the project that same entry created («Скасувати запис» right after saving) */
  z.object({ type: z.literal("entry.remove"), id, drop: id.optional() }),
  /** projects: none and nothing created — «Інше»; `create` makes a project (sum 0) right from «Розібрати» and adds it */
  z.object({
    type: z.literal("payer.assign"),
    keys: z.array(z.string().min(1).max(300)).min(1).max(3),
    name: z.string().max(300),
    projects: z.array(id).max(20),
    create: z.object({ name, currency: z.enum(CURRENCIES) }).optional(),
  }),
  /** «Скасувати» right after sorting or changing an incoming payment: each key back as it was (null — a question
   *  again), and the project that tap created, if any, removed */
  z.object({
    type: z.literal("payer.restore"),
    payers: z.array(z.object({ key: z.string().min(1).max(300), payer: payerSchema.nullable() })).min(1).max(3),
    drop: id.optional(),
  }),
  z.object({ type: z.literal("rule.set"), key: z.string().min(1).max(300), name: z.string().max(300), category: z.enum(SPENDS) }),
  /** «Скасувати» right after a tap: the recipient is a question again */
  z.object({ type: z.literal("rule.remove"), key: z.string().min(1).max(300) }),
  z.object({ type: z.literal("plan.save"), row: z.object({ id: id.optional(), ...planFields }) }),
  z.object({ type: z.literal("plan.remove"), id }),
]);
export type Action = z.infer<typeof actionSchema>;

export class BookError extends Error {}

/** One action on the book → a new book. Unknown project ids are refused, not stored. */
export function apply(book: Book, action: Action, newId: () => string): Book {
  const known = (ids: string[]) => {
    if (!ids.every((p) => book.projects.some((x) => x.id === p))) throw new BookError("unknown_project");
    return [...new Set(ids)];
  };
  switch (action.type) {
    case "project.save": {
      const { id: given, ...fields } = action.project;
      const project = { id: given ?? newId(), ...fields };
      const exists = book.projects.some((p) => p.id === project.id);
      return { ...book, projects: exists ? book.projects.map((p) => (p.id === project.id ? project : p)) : [...book.projects, project] };
    }
    case "project.remove": {
      const drop = (ids: string[]) => ids.filter((p) => p !== action.id);
      return {
        ...book,
        projects: book.projects.filter((p) => p.id !== action.id),
        plan: book.plan.map((r) => (r.project === action.id ? { ...r, project: undefined } : r)),
        // a payer left without projects by this removal is a question again; one in «Інше» stays there
        payers: Object.fromEntries(
          Object.entries(book.payers)
            .filter(([, v]) => !v.projects.includes(action.id) || v.projects.length > 1)
            .map(([k, v]) => [k, { ...v, projects: drop(v.projects) }]),
        ),
        // an income left without projects by this removal goes; one typed in as «Інше» stays
        entries: book.entries
          .filter((e) => e.spend || !e.projects.length || e.projects.some((p) => p !== action.id))
          .map((e) => ({ ...e, projects: drop(e.projects) })),
      };
    }
    case "entry.add": {
      const { spend, currency } = action.entry;
      const { other, create } = action;
      const projects = known(action.entry.projects);
      if (spend && (currency !== "UAH" || projects.length || other || create)) throw new BookError("invalid");
      if (other && (projects.length || create)) throw new BookError("invalid");
      if (!spend && !other && !projects.length && !create) throw new BookError("no_project");
      let next = book;
      if (create) {
        const created = { id: newId(), name: create.name, amount: 0, currency };
        next = { ...book, projects: [...book.projects, created] };
        projects.push(created.id);
      }
      return { ...next, entries: [...next.entries, { id: newId(), ...action.entry, projects }] };
    }
    case "entry.remove": {
      const base = { ...book, entries: book.entries.filter((e) => e.id !== action.id) };
      return action.drop ? apply(base, { type: "project.remove", id: action.drop }, newId) : base;
    }
    case "payer.assign": {
      const projects = known(action.projects);
      let next = book;
      if (action.create) {
        const created = { id: newId(), name: action.create.name, amount: 0, currency: action.create.currency };
        next = { ...book, projects: [...book.projects, created] };
        projects.push(created.id);
      }
      const payer = { name: action.name, projects };
      return { ...next, payers: { ...next.payers, ...Object.fromEntries(action.keys.map((k) => [k, payer])) } };
    }
    case "payer.restore": {
      const base = action.drop ? apply(book, { type: "project.remove", id: action.drop }, newId) : book;
      const payers = { ...base.payers };
      for (const { key, payer } of action.payers) {
        if (!payer) delete payers[key];
        else payers[key] = { name: payer.name, projects: payer.projects.filter((p) => base.projects.some((x) => x.id === p)) };
      }
      return { ...base, payers };
    }
    case "rule.set":
      return { ...book, rules: { ...book.rules, [action.key]: { category: action.category, name: action.name } } };
    case "rule.remove": {
      const rules = { ...book.rules };
      delete rules[action.key];
      return { ...book, rules };
    }
    case "plan.save": {
      const { id: given, ...fields } = action.row;
      if (fields.project) known([fields.project]);
      const row = { id: given ?? newId(), ...fields };
      const exists = book.plan.some((r) => r.id === row.id);
      return { ...book, plan: exists ? book.plan.map((r) => (r.id === row.id ? row : r)) : [...book.plan, row] };
    }
    case "plan.remove":
      return { ...book, plan: book.plan.filter((r) => r.id !== action.id) };
  }
}

/** The plan as the ledger reads it: an empty recipient is the name. */
export const ledgerPlan = (book: Book): Plan => book.plan.map((r) => ({ ...r, recipient: r.recipient || r.name }));
export const ledgerRules = (book: Book): Rules => book.rules;

/* ---------- payers ---------- */

/** How a payer is remembered: by IBAN and ЄДРПОУ when the bank gives them, otherwise by name. */
export function payerKeys(op: Operation): string[] {
  const strong = [op.counterIban, op.counterEdrpou].filter((k): k is string => !!k);
  return strong.length ? strong : [op.counterName ?? op.description];
}
export const payerName = (op: Operation) => op.counterName ?? op.description;

/* ---------- typed-in payments ---------- */

/** Typed-in payments live on two made-up FOP accounts, so the ledger counts them as income. */
export const MANUAL_ACCOUNTS: Account[] = [
  { id: "manual-uah", type: "fop", iban: "", currency: "UAH" },
  { id: "manual-usd", type: "fop", iban: "", currency: "USD" },
];
const ENTRY = "entry:";

export function entryOps(book: Book): Operation[] {
  return book.entries.map((e) => ({
    id: ENTRY + e.id,
    account: e.currency === "USD" ? "manual-usd" : "manual-uah",
    // Kyiv noon of that day
    time: Date.UTC(Number(e.date.slice(0, 4)), Number(e.date.slice(5, 7)) - 1, Number(e.date.slice(8, 10)), 10) / 1000,
    description: e.cash ? "Готівка" : "Внесено вручну",
    mcc: 0,
    amount: e.spend ? -e.amount : e.amount,
    manual: e.cash ? "cash" : "bank",
    ...(e.spend ? { spend: e.spend } : {}),
  }));
}
export const entryIdOf = (op: Operation) => (op.id.startsWith(ENTRY) ? op.id.slice(ENTRY.length) : undefined);

/** The remembered payer of an incoming payment, if any (by its first known key). */
export const payerOf = (book: Book, op: Operation): Payer | undefined => payerKeys(op).map((k) => book.payers[k]).find(Boolean);

/** Which projects an incoming payment is for: typed in with it, or the remembered payer's. */
export function projectsOf(book: Book): ProjectsOf {
  const typed = new Map(book.entries.map((e) => [ENTRY + e.id, e.projects]));
  return (op) => typed.get(op.id) ?? payerOf(book, op)?.projects ?? [];
}

/** Sasha has said what this incoming payment is: typed in, or its payer is remembered (a project or «Інше»). */
export const sortedIncome = (book: Book, op: Operation) => !!entryIdOf(op) || !!payerOf(book, op);

/** Bank statement + typed-in payments, and the accounts that hold them. */
export function everything(book: Book, bankOps: Operation[], bankAccounts: Account[]) {
  return { ops: [...bankOps, ...entryOps(book)], accounts: [...bankAccounts, ...MANUAL_ACCOUNTS] };
}

/* ---------- projects in a month ---------- */

export function paused(p: Project, m: string): boolean {
  if (!p.pausedFrom && !p.pausedUntil) return false;
  return (!p.pausedFrom || p.pausedFrom <= m) && (!p.pausedUntil || m < p.pausedUntil);
}

export interface Payment {
  op: Operation;
  /** the other projects the same payment was for */
  with: string[];
}
export interface ProjectRow {
  project: Project;
  paused: boolean;
  payments: Payment[];
}
export interface ProjectsMonth {
  /** paying projects first (unpaid on top), the paused ones last; a project with sum 0 is owed nothing */
  rows: ProjectRow[];
  /** incoming payments Sasha put into «Інше»: income, for no project */
  other: Operation[];
  paid: number;
  total: number;
  /** incoming payments nobody has said what they are for */
  toSort: Operation[];
}

export function projectsMonth(book: Book, ops: Operation[], accounts: Account[], m: string): ProjectsMonth {
  const of = projectsOf(book);
  const incoming = ops.filter((o) => monthOf(o.time) === m && classify(o, accounts, {}) === "income");
  const rows = book.projects.map((project) => ({
    project,
    paused: paused(project, m),
    payments: incoming.filter((o) => of(o).includes(project.id)).map((op) => ({ op, with: of(op).filter((p) => p !== project.id) })),
  }));
  // a project with sum 0 (made right from «Розібрати») is not a debt until Sasha gives it a sum
  const owed = rows.filter((r) => !r.paused && r.project.amount > 0);
  const rank = (r: ProjectRow) => (r.paused ? 3 : r.payments.length ? 1 : r.project.amount > 0 ? 0 : 2);
  const newest = (a: Operation, b: Operation) => b.time - a.time;
  return {
    rows: rows.sort((a, b) => rank(a) - rank(b)),
    other: incoming.filter((o) => sortedIncome(book, o) && of(o).length === 0).sort(newest),
    paid: owed.filter((r) => r.payments.length).length,
    total: owed.length,
    toSort: incoming.filter((o) => !sortedIncome(book, o)).sort(newest),
  };
}
