import { describe, expect, it } from "vitest";
import { DEMO_ACCOUNTS, DEMO_NOW, DEMO_OPERATIONS, DEMO_PLAN } from "../src/lib/money/demo";
import { apply, bookSchema, emptyBook, everything, paused, payerKeys, payerName, projectsMonth, projectsOf, type Book } from "../src/lib/money/book";
import { accountLabel, classify, nextPayout, payouts, planRowOf, remember, remindTomorrow, summarize, taxes, type Operation, type Plan } from "../src/lib/money/ledger";

/*
 * «Гроші» — MONEY only (owner's rule 13.10.2026): how a statement line is
 * read (own transfers are not spending, the pink card is «Собі», a sorted
 * recipient stays sorted, the payout plan sorts the team) and the taxes.
 */

const accounts = DEMO_ACCOUNTS;
const [FOP, WHITE, PINK] = accounts;
/** Kyiv noon of a November 2026 day, unix seconds. */
const nov = (d: number) => Date.UTC(2026, 10, d, 10) / 1000;
let n = 0;
const op = (o: Partial<Operation> & Pick<Operation, "account" | "amount">): Operation => ({ id: `t${++n}`, time: nov(10), description: "x", mcc: 4829, ...o });

describe("classify", () => {
  it("a client paying the FOP is «Прийшло»", () => {
    expect(classify(op({ account: FOP.id, amount: 1_000_00, counterName: "ТОВ А", counterIban: "UA99" }), accounts, {})).toBe("income");
  });

  it("FOP ⇄ white is neither in nor out — on both sides", () => {
    expect(classify(op({ account: FOP.id, amount: -50_000_00, counterIban: WHITE.iban }), accounts, {})).toBe("skip");
    expect(classify(op({ account: WHITE.id, amount: 50_000_00, counterIban: FOP.iban }), accounts, {})).toBe("skip");
    expect(classify(op({ account: WHITE.id, amount: -5_000_00, counterIban: FOP.iban }), accounts, {})).toBe("skip");
  });

  it("FOP → pink and white → pink are «Собі»; the pink card itself is not counted at all", () => {
    expect(classify(op({ account: FOP.id, amount: -20_000_00, counterIban: PINK.iban }), accounts, {})).toBe("self");
    expect(classify(op({ account: WHITE.id, amount: -20_000_00, counterIban: PINK.iban }), accounts, {})).toBe("self");
    expect(classify(op({ account: PINK.id, amount: 20_000_00, counterIban: WHITE.iban }), accounts, {})).toBe("skip");
    expect(classify(op({ account: PINK.id, amount: -2_000_00, mcc: 5411, description: "Сільпо" }), accounts, {})).toBe("skip");
  });

  it("white → an unknown card is «Розібрати»; taxes, ads and the rest sort themselves", () => {
    expect(classify(op({ account: WHITE.id, amount: -3_000_00, description: "Невідома Особа" }), accounts, {})).toBe("sort");
    expect(classify(op({ account: FOP.id, amount: -1_902_34, counterName: "ГУ ДПС У М.КИЄВІ", counterIban: "UA17" }), accounts, {})).toBe("taxes");
    expect(classify(op({ account: WHITE.id, amount: -9_000_00, mcc: 7311, description: "Facebk *Ads" }), accounts, {})).toBe("ads");
    expect(classify(op({ account: WHITE.id, amount: -500_00, mcc: 4215, description: "Нова пошта" }), accounts, {})).toBe("other");
  });

  it("sorted once — sorted for every payment to that recipient", () => {
    const first = op({ account: WHITE.id, amount: -3_000_00, description: "Невідома Особа" });
    const rules = remember({}, first, "team");
    const later = op({ account: WHITE.id, amount: -7_000_00, description: "Невідома Особа", time: nov(25) });
    expect(classify(later, accounts, rules)).toBe("team");
    expect(classify(op({ account: WHITE.id, amount: -7_000_00, description: "Інша Особа" }), accounts, rules)).toBe("sort");
    // a remembered firm is matched by IBAN, whatever the description says
    const firm = remember({}, op({ account: FOP.id, amount: -6_000_00, counterName: "ФОП Б", counterIban: "UA55", description: "рах. 1" }), "ads");
    expect(classify(op({ account: FOP.id, amount: -1_00, counterName: "ФОП Б", counterIban: "UA55", description: "рах. 2" }), accounts, firm)).toBe("ads");
  });
});

describe("a recipient is sorted ONCE (owner 26.11: «Маша Данилюк — команда», not asked 50 times)", () => {
  it("the same person under the bank's other wrappings is already in her category", () => {
    const first = op({ account: WHITE.id, amount: -3_000_00, description: "Маша Данилюк" });
    const rules = remember({}, first, "team");
    for (const description of ["Переказ: Маша Данилюк", "МАША  ДАНИЛЮК", "Маша Данилюк *4321", "Переказ на картку «Маша Данилюк» 5375 **** **** 4321", "Від: маша данилюк"]) {
      expect(classify(op({ account: WHITE.id, amount: -5_000_00, description, time: nov(20) }), accounts, rules), description).toBe("team");
    }
    // another person stays a question
    expect(classify(op({ account: WHITE.id, amount: -5_000_00, description: "Маша Іваненко" }), accounts, rules)).toBe("sort");
  });

  it("rules saved under the old raw key are still read", () => {
    const old = { "Владислава Б": { category: "team" as const, name: "Владислава Б" } };
    expect(classify(op({ account: WHITE.id, amount: -1_000_00, description: "Владислава Б" }), accounts, old)).toBe("team");
  });
});

describe("the month", () => {
  it("own transfers and the pink card never reach «Пішло»; «Собі» stays inside «Залишилось»", () => {
    const ops = [
      op({ account: FOP.id, amount: 100_000_00, counterName: "ТОВ А", counterIban: "UA99" }),
      op({ account: FOP.id, amount: -60_000_00, counterIban: WHITE.iban }),
      op({ account: WHITE.id, amount: 60_000_00, counterIban: FOP.iban }),
      op({ account: WHITE.id, amount: -10_000_00, description: "Особа" }),
      op({ account: WHITE.id, amount: -20_000_00, counterIban: PINK.iban }),
      op({ account: PINK.id, amount: -5_000_00, mcc: 5411 }),
    ];
    const m = summarize(ops, accounts, remember({}, ops[3], "team"), "2026-11");
    expect(m.income).toBe(100_000_00);
    expect(m.spent).toBe(10_000_00);
    expect(m.self).toBe(20_000_00);
    expect(m.left).toBe(100_000_00 - 10_000_00 - m.tax.setAside);
    expect(m.team).toEqual([{ name: "Особа", amount: 10_000_00 }]);
  });

  it("the unsorted count in «Пішло» until sorted", () => {
    const ops = [op({ account: WHITE.id, amount: -4_000_00, description: "Особа" })];
    expect(summarize(ops, accounts, {}, "2026-11").spent).toBe(4_000_00);
    expect(summarize(ops, accounts, {}, "2026-11").toSort).toHaveLength(1);
    expect(summarize(ops, accounts, remember({}, ops[0], "other"), "2026-11").by.other).toBe(4_000_00);
  });
});

describe("«Дивіденди» and the account (owner 26.11: «отметить как для себе», «напиши хоть с какого счёта»)", () => {
  it("«Дивіденди» never reach «Пішло»; they stay inside «Залишилось» and show apart", () => {
    const ops = [
      op({ account: FOP.id, amount: 100_000_00, counterName: "ТОВ А", counterIban: "UA99" }),
      op({ account: WHITE.id, amount: -10_000_00, description: "Особа" }),
      op({ account: WHITE.id, amount: -3_000_00, mcc: 5812, description: "Ресторан" }),
    ];
    let rules = remember({}, ops[1], "team");
    rules = remember(rules, ops[2], "dividends");
    const m = summarize(ops, accounts, rules, "2026-11");
    expect(m.spent).toBe(10_000_00);
    expect(m.dividends).toBe(3_000_00);
    expect(m.by.dividends).toBe(3_000_00);
    expect(m.left).toBe(100_000_00 - 10_000_00 - m.tax.setAside);
    expect(m.toSort).toEqual([]);
  });

  it("«Дивіденди» is remembered by the recipient, like «Команда»: the next payment there is sorted by itself", () => {
    const rules = remember({}, op({ account: WHITE.id, amount: -2_000_00, description: "Маша Д." }), "dividends");
    expect(classify(op({ account: WHITE.id, amount: -900_00, description: "Переказ: МАША Д. *4321", time: nov(25) }), accounts, rules)).toBe("dividends");
    expect(classify(op({ account: FOP.id, amount: -900_00, description: "Маша Д." }), accounts, rules)).toBe("dividends");
    // a rule overrides the automatic guess (a restaurant by MCC is «Інше» until marked)
    const cafe = op({ account: WHITE.id, amount: -700_00, mcc: 5812, description: "Кафе" });
    expect(classify(cafe, accounts, {})).toBe("other");
    expect(classify(cafe, accounts, remember({}, cafe, "dividends"))).toBe("dividends");
  });

  it("the book stores it, «Скасувати» takes it back exactly, and a book saved before reads as is", () => {
    const old = bookSchema.parse({ version: 1, projects: [], plan: [], rules: { "маша д.": { category: "team", name: "Маша Д." } }, payers: {}, entries: [] });
    const set = apply(old, { type: "rule.set", key: "кафе", name: "Кафе", category: "dividends" }, () => "x");
    expect(bookSchema.parse(set).rules["кафе"].category).toBe("dividends");
    expect(apply(set, { type: "rule.remove", key: "кафе" }, () => "x")).toEqual(old);
  });

  it("each operation is labelled with its account; an unknown one by its last 4 digits only", () => {
    expect(accountLabel(op({ account: FOP.id, amount: -1 }), accounts)).toBe("ФОП");
    expect(accountLabel(op({ account: WHITE.id, amount: -1 }), accounts)).toBe("Біла");
    expect(accountLabel(op({ account: PINK.id, amount: -1 }), accounts)).toBe("Рожева");
    expect(accountLabel(op({ account: "manual-uah", amount: -1, manual: "bank" }), accounts)).toBe("Вручну");
    const label = accountLabel(op({ account: "x", amount: -1 }), [...accounts, { id: "x", type: "fop" as never, iban: "UA003220010000026200000009876" }].map((a) => (a.id === "x" ? { ...a, type: "eur" as never } : a)));
    expect(label).toBe("·9876");
    expect(label).not.toContain("UA00");
  });
});

describe("taxes 2026", () => {
  it("5 % + 1 % of «Прийшло» plus ЄСВ 1 902,34; paid taxes are subtracted", () => {
    const t = taxes("2026-11", 200_000_00, 0);
    expect(t.due).toBe(12_000_00 + 1_902_34);
    expect(taxes("2026-11", 200_000_00, 1_902_34).setAside).toBe(12_000_00);
    expect(taxes("2026-11", 0, 5_000_00).setAside).toBe(0);
  });

  it("deadline by quarter; Q4 rolls into next year", () => {
    expect(taxes("2026-02", 0, 0).by).toBe("2026-04-20");
    expect(taxes("2026-09", 0, 0).by).toBe("2026-10-20");
    expect(taxes("2026-11", 0, 0).by).toBe("2027-01-20");
  });

  it("a year without its config is refused, not guessed", () => {
    expect(() => taxes("2031-01", 1, 0)).toThrow();
  });
});

describe("the payout plan", () => {
  const plan: Plan = [
    { id: "a", name: "Тест Один", recipient: "Тест Один", amount: 10_000_00, day: 5, project: "pa" },
    { id: "b", name: "Тест Один", recipient: "Тест Один", amount: 10_000_00, day: 20 },
  ];
  const pay = (d: number, amount = 10_000_00) => op({ account: WHITE.id, amount: -amount, description: "Тест Один", time: nov(d) });

  it("recipient + sum + a few days around the planned day → «Команда» by itself", () => {
    expect(planRowOf(pay(7), accounts, plan)?.id).toBe("a");
    expect(planRowOf(pay(18), accounts, plan)?.id).toBe("b");
    expect(classify(pay(7), accounts, {}, plan)).toBe("team");
  });

  it("another sum, a far-off day or the FOP account do not match → «Розібрати»", () => {
    expect(classify(pay(7, 9_000_00), accounts, {}, plan)).toBe("sort");
    expect(classify(pay(13), accounts, {}, plan)).toBe("sort");
    expect(planRowOf({ ...pay(5), account: FOP.id }, accounts, plan)).toBeUndefined();
  });

  it("«за <проект>» only when that project paid a few days before", () => {
    const income = op({ account: FOP.id, amount: 30_000_00, counterName: "ТОВ \"КЛІЄНТ А\"", counterIban: "UA77", time: nov(3) });
    const projectsOf = (o: Operation) => (o.counterIban === "UA77" ? ["pa"] : []);
    expect(payouts([income, pay(5)], accounts, plan, "2026-11", projectsOf)[0].forClient).toBe("pa");
    expect(payouts([pay(5)], accounts, plan, "2026-11", projectsOf)[0].forClient).toBeUndefined();
    const longAgo = { ...income, time: Date.UTC(2026, 9, 20, 10) / 1000 };
    expect(payouts([longAgo, pay(5)], accounts, plan, "2026-11", projectsOf)[0].forClient).toBeUndefined();
  });

  it("each row of the month: paid and when, or still due", () => {
    const [a, b] = payouts([pay(6)], accounts, plan, "2026-11");
    expect(a).toMatchObject({ day: 5, paidOn: 6 });
    expect(b).toMatchObject({ day: 20, paidOn: undefined });
  });

  it("tomorrow's reminder: who, how much, total; nothing once paid", () => {
    const r = remindTomorrow([], accounts, plan, nov(19));
    expect(r).toEqual({ date: "2026-11-20", items: [{ name: "Тест Один", amount: 10_000_00 }], total: 10_000_00 });
    expect(remindTomorrow([pay(19)], accounts, plan, nov(19)).items).toEqual([]);
    expect(remindTomorrow([], accounts, plan, nov(10)).items).toEqual([]);
  });

  it("the nearest payout skips what is paid and crosses into next month", () => {
    expect(nextPayout([], accounts, plan, nov(10))?.date).toBe("2026-11-20");
    expect(nextPayout([pay(20)], accounts, plan, nov(20))?.date).toBe("2026-12-05");
  });

  it("the demo: team is sorted by the plan, tomorrow is a real payout, 3–4 to sort", () => {
    const m = summarize(DEMO_OPERATIONS, accounts, {}, "2026-11", DEMO_PLAN);
    expect(m.toSort.length).toBeGreaterThanOrEqual(3);
    expect(m.toSort.length).toBeLessThanOrEqual(4);
    expect(remindTomorrow(DEMO_OPERATIONS, accounts, DEMO_PLAN, DEMO_NOW).items.length).toBeGreaterThan(0);
    const sep = summarize(DEMO_OPERATIONS, accounts, {}, "2026-09", DEMO_PLAN);
    expect(sep.toSort).toEqual([]);
    expect(sep.income).toBeGreaterThan(150_000_00);
  });
});

describe("projects: who paid this month", () => {
  const book = (): Book => ({
    ...emptyBook(),
    projects: [
      { id: "a", name: "А", amount: 20_000_00, currency: "UAH" },
      { id: "b", name: "Б", amount: 10_000_00, currency: "UAH" },
      { id: "c", name: "В", amount: 500_00, currency: "USD" },
      { id: "z", name: "Пауза", amount: 9_000_00, currency: "UAH", pausedFrom: "2026-10", pausedUntil: "2027-01" },
    ],
  });
  let k = 0;
  const id = () => `n${++k}`;
  const fopIn = (amount: number, iban = "UA01", d = 10) =>
    op({ account: FOP.id, amount, counterName: "ФОП Хтось", counterIban: iban, counterEdrpou: "1234567890", time: nov(d) });

  it("one payment put on two projects: both paid, «Прийшло» counts it once", () => {
    const pay = fopIn(30_000_00);
    const b = apply(book(), { type: "payer.assign", keys: payerKeys(pay), name: payerName(pay), projects: ["a", "b"] }, id);
    const { ops, accounts: all } = everything(b, [pay], accounts);
    const pm = projectsMonth(b, ops, all, "2026-11");
    expect(pm.paid).toBe(2);
    expect(pm.total).toBe(3); // the paused one is not counted
    expect(summarize(ops, all, b.rules, "2026-11").income).toBe(30_000_00);
  });

  it("a remembered payer is put on its project by itself — by IBAN, by ЄДРПОУ; a project may have several payers", () => {
    const first = fopIn(20_000_00, "UA01", 3);
    const b = apply(book(), { type: "payer.assign", keys: payerKeys(first), name: payerName(first), projects: ["a"] }, id);
    const later = fopIn(20_000_00, "UA01", 25);
    const pm = projectsMonth(b, [later], accounts, "2026-11");
    expect(pm.rows.find((r) => r.project.id === "a")!.payments).toHaveLength(1);
    expect(pm.toSort).toEqual([]);
    expect(projectsOf(b)(fopIn(1_00, "UA02"))).toEqual(["a"]);
    const other = op({ account: FOP.id, amount: 5_00, counterName: "ФОП Інший" });
    expect(projectsMonth(b, [other], accounts, "2026-11").toSort).toHaveLength(1);
    const b2 = apply(b, { type: "payer.assign", keys: payerKeys(other), name: payerName(other), projects: ["a"] }, id);
    expect(projectsOf(b2)(other)).toEqual(["a"]);
    expect(projectsOf(b2)(later)).toEqual(["a"]);
  });

  it("cash goes into «Прийшло» and marks its project paid; dollars are counted apart, never converted", () => {
    let b = apply(book(), { type: "entry.add", entry: { date: "2026-11-12", amount: 6_000_00, currency: "UAH", projects: ["b"], cash: true } }, id);
    b = apply(b, { type: "entry.add", entry: { date: "2026-11-14", amount: 500_00, currency: "USD", projects: ["c"], cash: true } }, id);
    const { ops, accounts: all } = everything(b, [fopIn(20_000_00)], accounts);
    const m = summarize(ops, all, b.rules, "2026-11");
    expect(m.income).toBe(26_000_00);
    expect(m.cash).toBe(6_000_00);
    expect(m.incomeUsd).toBe(500_00);
    expect(projectsMonth(b, ops, all, "2026-11").paid).toBe(2);
    const gone = apply(b, { type: "entry.remove", id: b.entries[0].id }, id);
    const left = everything(gone, [], accounts);
    expect(summarize(left.ops, left.accounts, {}, "2026-11").income).toBe(0);
  });

  it("a spending typed in by hand lands in «Пішло» under its category, not in «Прийшло», and survives removing a project", () => {
    let b = apply(book(), { type: "entry.add", entry: { date: "2026-11-12", amount: 6_000_00, currency: "UAH", projects: ["b"], cash: true } }, id);
    b = apply(b, { type: "entry.add", entry: { date: "2026-11-13", amount: 1_500_00, currency: "UAH", projects: [], cash: false, spend: "ads" } }, id);
    const { ops, accounts: all } = everything(b, [], accounts);
    const m = summarize(ops, all, b.rules, "2026-11");
    expect(m.income).toBe(6_000_00);
    expect(m.by.ads).toBe(1_500_00);
    expect(m.spent).toBe(1_500_00);
    const before = everything(apply(book(), { type: "entry.add", entry: { date: "2026-11-12", amount: 6_000_00, currency: "UAH", projects: ["b"], cash: true } }, id), [], accounts);
    expect(summarize(before.ops, before.accounts, {}, "2026-11").left - m.left).toBe(1_500_00);
    expect(projectsMonth(b, ops, all, "2026-11").toSort).toEqual([]);
    expect(apply(b, { type: "project.remove", id: "b" }, id).entries).toHaveLength(1);
    // income still needs a project; a spending is hryvnias, with no project
    expect(() => apply(b, { type: "entry.add", entry: { date: "2026-11-13", amount: 1_00, currency: "UAH", projects: [], cash: true } }, id)).toThrow("no_project");
    expect(() => apply(b, { type: "entry.add", entry: { date: "2026-11-13", amount: 1_00, currency: "USD", projects: [], cash: false, spend: "other" } }, id)).toThrow("invalid");
  });

  it("a pause covers its months only; «до» is the month it pays again", () => {
    const z = book().projects[3];
    expect(paused(z, "2026-09")).toBe(false);
    expect(paused(z, "2026-12")).toBe(true);
    expect(paused(z, "2027-01")).toBe(false);
  });
});
