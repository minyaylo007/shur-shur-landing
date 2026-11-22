import type { Book } from "./book";
import type { Account, Operation, Plan } from "./ledger";

/**
 * Made-up data for the «Гроші» demo. Every name, firm, IBAN and sum here is
 * invented: none of Sasha's people, clients or numbers. Three months of an
 * agency around 200 000 грн in and 120 000 out, shaped like the monobank
 * personal API statement (kopecks, unix seconds, out is negative).
 */

export const DEMO_ACCOUNTS: Account[] = [
  { id: "fop", type: "fop", iban: "UA003220010000026000000000001" },
  { id: "white", type: "white", iban: "UA003220010000026200000000002" },
  { id: "pink", type: "platinum", iban: "UA003220010000026200000000003" },
];
const [FOP, WHITE, PINK] = DEMO_ACCOUNTS;

/** The demo stands still on this day (Kyiv noon), so «завтра» always has something to show. */
export const DEMO_NOW = Date.UTC(2026, 10, 22, 10) / 1000;

const uah = (n: number) => Math.round(n * 100);

/** The plan: three people, two of the rows tied to a project; «Кавова гавань» pays twice a month. */
export const DEMO_PLAN: Plan = [
  { id: "p1", name: "Оля Гречко", recipient: "Оля Гречко", amount: uah(14_000), day: 5, project: "kava" },
  { id: "p2", name: "Оля Гречко", recipient: "Оля Гречко", amount: uah(14_000), day: 20, project: "kava" },
  { id: "p3", name: "Марко Ткач", recipient: "Марко Ткач", amount: uah(18_000), day: 10, project: "sonyashnyk" },
  { id: "p4", name: "Марко Ткач", recipient: "Марко Ткач", amount: uah(9_000), day: 23 },
  { id: "p5", name: "Даша Лисенко", recipient: "Даша Лисенко", amount: uah(12_000), day: 12 },
  { id: "p6", name: "Даша Лисенко", recipient: "Даша Лисенко", amount: uah(8_000), day: 25 },
];

const CLIENTS = [
  { name: "ТОВ \"СОНЯШНИК ФУДС\"", iban: "UA113052990000026000000000101", sum: 48_000, days: [8], what: "SMM-супровід" },
  { name: "ФОП Бондар Ірина Олегівна", iban: "UA123220010000026000000000102", sum: 22_000, days: [4], what: "ведення Instagram" },
  { name: "ТОВ \"КАВОВА ГАВАНЬ\"", iban: "UA133005280000026000000000103", sum: 18_000, days: [3, 18], what: "SMM та таргет" },
  { name: "ТОВ \"ЗЕЛЕНИЙ КВАДРАТ\"", iban: "UA143510050000026000000000104", sum: 30_000, days: [11], what: "контент-план і зйомка" },
  { name: "ФОП Савчук Денис Петрович", iban: "UA153220010000026000000000105", sum: 18_500, days: [14], what: "налаштування реклами" },
  { name: "ТОВ \"БІЛА ВИШНЯ ДЕКОР\"", iban: "UA163348510000026000000000106", sum: 42_000, days: [16], what: "SMM-супровід" },
];

const MONTHS = [
  { y: 2026, m: 9, n: "вересень", k: 0.94, late: 1 },
  { y: 2026, m: 10, n: "жовтень", k: 1.03, late: 0 },
  { y: 2026, m: 11, n: "листопад", k: 1, late: 0 },
];

/** Kyiv daytime → unix seconds (UTC+2 is close enough: the day never shifts between 9 and 20 o'clock). */
const at = (y: number, m: number, d: number, h: number) => Date.UTC(y, m - 1, d, h - 2, 17) / 1000;

function month({ y, m, n, k, late }: (typeof MONTHS)[number]): Operation[] {
  const ops: Operation[] = [];
  let seq = 0;
  const add = (account: Account, d: number, h: number, amount: number, description: string, mcc: number, counter?: { name?: string; iban?: string }) =>
    ops.push({ id: `${y}${m}-${++seq}`, account: account.id, time: at(y, m, d, h), description, mcc, amount: uah(amount), counterName: counter?.name, counterIban: counter?.iban });
  const mm = String(m).padStart(2, "0");

  // In: clients pay the FOP account by invoice.
  CLIENTS.forEach((c, i) =>
    c.days.forEach((d, j) =>
      add(FOP, d, 11, Math.round((c.sum * k) / 100) * 100, `Оплата за ${c.what} згідно рахунку №${m}${i + 1}${j || ""} від 01.${mm}.${y}, без ПДВ`, 4829, { name: c.name, iban: c.iban }),
    ),
  );

  // FOP → white card twice a month: own money moving, neither in nor out.
  for (const [d, sum] of [[5, 70_000], [19, 55_000]]) {
    add(FOP, d, 9, -sum, "Переказ власних коштів на картку", 4829, { name: "Власний рахунок", iban: WHITE.iban });
    add(WHITE, d, 9, sum, "З рахунку ФОП", 4829, { iban: FOP.iban });
  }

  // The team by the plan, from the white card; in September a day or so late.
  for (const row of DEMO_PLAN) add(WHITE, row.day + late, 12, -row.amount / 100, row.recipient, 4829);

  // Ads and services.
  add(WHITE, 3, 9, -Math.round(12_000 * k), "Facebk *Ads", 7311);
  add(WHITE, 17, 9, -Math.round(9_000 * k), "Facebk *Ads", 7311);
  add(WHITE, 5, 10, -1_650, "Google *Workspace", 7372);
  add(WHITE, 12, 18, -520, "Canva", 5818);
  add(WHITE, 14, 18, -395, "CapCut", 5818);
  add(WHITE, 1, 10, -299, "Київстар", 4814);

  // Taxes: ЄСВ every month from the FOP account.
  add(FOP, 15, 10, -1_902.34, `*;101;0000000000;Єдиний внесок на загальнообов'язкове державне соціальне страхування за ${n} ${y}`, 4829, {
    name: "ГУ ДПС У М.КИЄВІ",
    iban: "UA178999980000355169201022000",
  });

  // Other.
  add(WHITE, 9, 14, -Math.round(1_180 * k), "Нова пошта", 4215);
  add(FOP, 28, 9, -95, "Комісія за обслуговування рахунку", 6011);

  // Her own: to the pink card. Purchases from the pink card are not the business's.
  add(WHITE, 10, 20, -25_000, "На платинову картку", 4829, { iban: PINK.iban });
  add(FOP, 21, 20, -20_000, "Переказ власних коштів на картку", 4829, { iban: PINK.iban });
  add(PINK, 10, 20, 25_000, "З білої картки", 4829, { iban: WHITE.iban });
  add(PINK, 11, 13, -2_340, "Сільпо", 5411);
  add(PINK, 13, 19, -890, "Uklon", 4121);
  return ops;
}

/** Recipients nobody has met yet: the «Розібрати» block (latest month). */
function unknown(): Operation[] {
  const { y, m } = MONTHS[MONTHS.length - 1];
  return [
    { id: "x1", account: WHITE.id, time: at(y, m, 18, 16), description: "Андрій Тарасюк", mcc: 4829, amount: uah(-4_500) },
    { id: "x2", account: WHITE.id, time: at(y, m, 16, 11), description: "Вікторія Семенко", mcc: 4829, amount: uah(-2_800) },
    {
      id: "x3",
      account: FOP.id,
      time: at(y, m, 13, 12),
      description: "Оплата за відеомонтаж згідно рахунку №17",
      mcc: 4829,
      amount: uah(-6_000),
      counterName: "ФОП Мельничук Тарас Ігорович",
      counterIban: "UA183052990000026000000000201",
    },
    { id: "x4", account: WHITE.id, time: at(y, m, 11, 15), description: "Ірина Вовк", mcc: 4829, amount: uah(-1_200) },
  ];
}

/**
 * Projects and what the page has learnt: who pays for what. «Біла вишня» has
 * two projects paid in one payment; «Савчук» is a payer nobody has met yet
 * («Розібрати»: за який проект?); one project pays in dollars, in cash; one
 * is on a pause.
 */
export const DEMO_BOOK: Book = {
  version: 1,
  projects: [
    { id: "sonyashnyk", name: "Соняшник фудс", amount: uah(48_000), currency: "UAH" },
    { id: "bondar", name: "Студія Бондар", amount: uah(22_000), currency: "UAH" },
    { id: "kava", name: "Кавова гавань", amount: uah(36_000), currency: "UAH" },
    { id: "kvadrat", name: "Зелений квадрат", amount: uah(30_000), currency: "UAH" },
    { id: "target", name: "Таргет для Савчука", amount: uah(18_500), currency: "UAH" },
    { id: "vyshnya", name: "Біла вишня · декор", amount: uah(26_000), currency: "UAH" },
    { id: "vyshnya-cafe", name: "Біла вишня · кав'ярня", amount: uah(16_000), currency: "UAH" },
    { id: "studio", name: "Йога-студія Лотос", amount: 500_00, currency: "USD" },
    { id: "nails", name: "Манікюр у Віри", amount: uah(6_000), currency: "UAH" },
    { id: "pekarnya", name: "Пекарня на розі", amount: uah(12_000), currency: "UAH", pausedFrom: "2026-10", pausedUntil: "2027-01" },
  ],
  plan: DEMO_PLAN,
  rules: {},
  payers: {
    [CLIENTS[0].iban]: { name: CLIENTS[0].name, projects: ["sonyashnyk"] },
    [CLIENTS[1].iban]: { name: CLIENTS[1].name, projects: ["bondar"] },
    [CLIENTS[2].iban]: { name: CLIENTS[2].name, projects: ["kava"] },
    [CLIENTS[3].iban]: { name: CLIENTS[3].name, projects: ["kvadrat"] },
    [CLIENTS[5].iban]: { name: CLIENTS[5].name, projects: ["vyshnya", "vyshnya-cafe"] },
  },
  entries: [
    { id: "cash-9", date: "2026-09-07", amount: 500_00, currency: "USD", projects: ["studio"], cash: true },
    { id: "cash-10", date: "2026-10-06", amount: 500_00, currency: "USD", projects: ["studio"], cash: true },
    { id: "cash-9b", date: "2026-09-09", amount: uah(6_000), currency: "UAH", projects: ["nails"], cash: true },
    { id: "cash-10b", date: "2026-10-09", amount: uah(6_000), currency: "UAH", projects: ["nails"], cash: true },
    { id: "cash-11", date: "2026-11-06", amount: 500_00, currency: "USD", projects: ["studio"], cash: true },
    { id: "cash-11b", date: "2026-11-09", amount: uah(6_000), currency: "UAH", projects: ["nails"], cash: true },
  ],
};

/** Everything up to the demo's «today»: the rest of November has not happened yet. */
export const DEMO_OPERATIONS: Operation[] = [...MONTHS.flatMap(month), ...unknown()].filter((o) => o.time <= DEMO_NOW);
