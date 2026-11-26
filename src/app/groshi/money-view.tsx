"use client";

import { useEffect, useMemo, useState } from "react";
import {
  apply,
  everything,
  ledgerPlan,
  payerKeys,
  payerName,
  projectsMonth,
  projectsOf,
  entryIdOf,
  type Action,
  type Book,
  type Currency,
  type Project,
  type ProjectRow,
} from "@/lib/money/book";
import {
  accountLabel,
  BUSINESS,
  classify,
  monthOf,
  monthsOf,
  nextPayout,
  payouts,
  planRowOf,
  recipientKey,
  recipientName,
  SPENDS,
  summarize,
  type Account,
  type Category,
  type Operation,
  type Payout,
  type Reminder,
  type Rule,
  type Spend,
} from "@/lib/money/ledger";
import { AddMoney } from "./add-money";
import { dropUnsaved, keepUnsaved, problemText, readUnsaved, retryable } from "@/lib/money/pending";

/* One column, phone first, the way monobank does it. On top the month and
   three numbers: прийшло / пішло / залишилось. Below, cards that open:
   «Розібрати» (one operation per screen), «Куди пішло» (categories, each
   opens to its operations), «Проекти», «Дивіденди», then the months and the
   two settings. Every operation carries the account it went from. The same
   screen for the demo (memory only) and the cabinet (Blob). */

const LABEL: Record<Spend, string> = { team: "Команда", taxes: "Податки", ads: "Реклама і сервіси", other: "Інше", dividends: "Дивіденди" };
const ICON: Record<Spend, string> = { team: "👥", taxes: "🏛", ads: "📣", other: "🧾", dividends: "🍒" };
const MONTH = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
const MONTH_TO = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];

const grn = (kop: number) => `${Math.round(kop / 100).toLocaleString("uk-UA")} грн`;
const money = (minor: number, currency: Currency = "UAH") => (currency === "USD" ? `$${Math.round(minor / 100).toLocaleString("uk-UA")}` : grn(minor));
const monthName = (month: string) => `${MONTH[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
const monthTo = (month: string) => MONTH_TO[Number(month.slice(5)) - 1];
const dayMonth = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
const opDay = (op: Operation) => new Date(op.time * 1000).toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit" });
const kyivIso = (unix: number) => new Date(unix * 1000).toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv" });
/** «1 500,50» or «1500» → minor units; nothing sensible → NaN. */
const toMinor = (text: string) => Math.round(Number(text.replace(/\s/g, "").replace(",", ".")) * 100);

const card = "rounded-2xl border border-paper-200 bg-cream-type p-4 shadow-[0_1px_0_rgba(74,13,20,0.04),0_8px_24px_-16px_rgba(74,13,20,0.25)]";
const eyebrow = "text-xs font-medium uppercase tracking-widest text-ink-500";
const chip = (on: boolean) => `rounded-full border px-3 py-2 text-sm ${on ? "border-cherry-deep bg-cherry-deep text-cream-type" : "border-paper-200 hover:border-cherry-juice"}`;
const input = "w-full rounded-xl border border-paper-200 bg-white px-3 py-2";
const primary = "rounded-full bg-cherry-deep px-4 py-2 text-sm font-semibold text-cream-type disabled:opacity-40";

/** The account an operation went from, as a small tag: «ФОП», «Біла», «Рожева», «Вручну». */
function AccountTag({ label }: { label: string }) {
  const tone =
    label === "Рожева" ? "bg-pink-100 text-pink-900" : label === "Біла" ? "border border-paper-200 bg-white text-ink-700" : label === "Вручну" ? "bg-amber-50 text-amber-900" : "bg-paper-100 text-ink-700";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ${tone}`}>{label}</span>;
}

/** A card that opens: a title and a number on one line, the rest inside. */
function Group({ title, right, open, children, id }: { title: string; right?: React.ReactNode; open?: boolean; children: React.ReactNode; id?: string }) {
  return (
    <details id={id} open={open} className={`${card} group scroll-mt-4`}>
      <summary className="-m-1 flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-1 [&::-webkit-details-marker]:hidden">
        <span className="font-display text-lg">{title}</span>
        <span className="flex items-center gap-2 tabular-nums">
          {right}
          <span aria-hidden className="text-xl text-ink-500 transition-transform group-open:rotate-90">
            ›
          </span>
        </span>
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

/** The five categories as big buttons: one tap sorts the recipient for good. */
function CategoryButtons({ current, busy, onPick }: { current?: Spend; busy: boolean; onPick: (s: Spend) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {SPENDS.map((s) => (
        <button
          key={s}
          type="button"
          disabled={busy || s === current}
          onClick={() => onPick(s)}
          className={`min-h-12 rounded-2xl border px-3 text-left text-sm font-medium disabled:opacity-50 ${s === "dividends" ? "col-span-2 border-pink-200 bg-pink-50" : "border-paper-200 bg-white"} ${s === current ? "ring-2 ring-cherry-deep" : "active:bg-paper-100"}`}
        >
          <span className="mr-1">{ICON[s]}</span>
          {LABEL[s]}
          {s === "dividends" ? <span className="ml-1 font-normal text-ink-500">· на себе</span> : null}
        </button>
      ))}
    </div>
  );
}

/** One operation in a list: who, account and day under it, the sum on the right; a tap lets her change the category. */
function OpLine({ op, tag, current, busy, onPick }: { op: Operation; tag: string; current?: Spend; busy: boolean; onPick?: (s: Spend) => void }) {
  const [open, setOpen] = useState(false);
  const body = (
    <>
      <span className="min-w-0">
        <span className="block truncate">{recipientName(op)}</span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
          <AccountTag label={tag} />
          {opDay(op)}
        </span>
      </span>
      <span className="shrink-0 tabular-nums">{grn(Math.abs(op.amount))}</span>
    </>
  );
  if (!onPick) return <li className="flex items-start justify-between gap-3 py-2">{body}</li>;
  return (
    <li className="py-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-start justify-between gap-3 text-left">
        {body}
      </button>
      {open ? (
        <div className="mt-2">
          <CategoryButtons
            current={current}
            busy={busy}
            onPick={(s) => {
              setOpen(false);
              onPick(s);
            }}
          />
        </div>
      ) : null}
    </li>
  );
}

function when(iso: string, now: number): string {
  const today = kyivIso(now);
  const tomorrow = kyivIso(now + 86_400);
  return iso === today ? "сьогодні" : iso === tomorrow ? "завтра" : dayMonth(iso);
}

function Chips({ projects, chosen, onChange }: { projects: Project[]; chosen: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {projects.map((p) => {
        const on = chosen.includes(p.id);
        return (
          <button key={p.id} type="button" aria-pressed={on} onClick={() => onChange(on ? chosen.filter((x) => x !== p.id) : [...chosen, p.id])} className={chip(on)}>
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

export type BankState = "off" | "ok" | "stale";

/** What the last tap changed, so «Скасувати» can put the book back exactly. */
interface LastPick {
  key: string;
  name: string;
  category: Spend;
  before?: Rule;
}

export function MoneyView({
  initial,
  bankOps,
  bankAccounts,
  now,
  demo,
  bank,
}: {
  initial: Book;
  bankOps: Operation[];
  bankAccounts: Account[];
  now: number;
  demo?: boolean;
  bank?: BankState;
}) {
  const [book, setBook] = useState(initial);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  /** What she typed and the server did not take: kept in this browser until saved. */
  const [unsaved, setUnsaved] = useState<Action | null>(null);
  const [last, setLast] = useState<LastPick | null>(null);
  const [at, setAt] = useState(0);
  const local = () => (typeof window === "undefined" ? undefined : window.localStorage);

  useEffect(() => {
    if (demo) return;
    const left = readUnsaved(local());
    if (left) {
      // localStorage exists only after hydration; reading it in render would mismatch the server's HTML
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnsaved(left);
      setProblem("Минулого разу запис не зберігся. Введене на місці.");
    }
  }, [demo]);

  useEffect(() => {
    if (!last) return;
    const t = setTimeout(() => setLast(null), 8000);
    return () => clearTimeout(t);
  }, [last]);

  /** The demo changes its memory; the cabinet saves first and shows what was saved. */
  async function run(action: Action): Promise<Book | null> {
    setProblem("");
    if (demo) {
      const next = apply(book, action, () => Math.random().toString(36).slice(2, 10));
      setBook(next);
      return next;
    }
    setBusy(true);
    let status = 0;
    let error = "";
    try {
      const res = await fetch("/api/cabinet/groshi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
      status = res.status;
      if (res.status === 401) {
        keepUnsaved(local(), action);
        window.location.assign("/login");
        return null;
      }
      const answer = await res.json();
      if (answer.ok) {
        setBook(answer.book);
        setUnsaved(null);
        dropUnsaved(local());
        return answer.book as Book;
      }
      error = String(answer.error ?? "");
    } catch {
      /* no answer at all: status stays 0 */
    } finally {
      setBusy(false);
    }
    setProblem(problemText(error, status));
    if (retryable(status)) {
      setUnsaved(action);
      keepUnsaved(local(), action);
    } else {
      setUnsaved(null);
      dropUnsaved(local());
    }
    return null;
  }

  /** Put the recipient of this operation into a category, remembering what was there for «Скасувати». */
  async function pick(op: Operation, category: Spend) {
    const key = recipientKey(op);
    const name = recipientName(op);
    const before = book.rules[key];
    if (await run({ type: "rule.set", key, name, category })) setLast({ key, name, category, before });
  }
  async function undo() {
    if (!last) return;
    const { key, before } = last;
    setLast(null);
    await run(before ? { type: "rule.set", key, name: before.name, category: before.category } : { type: "rule.remove", key });
  }

  const { ops, accounts } = useMemo(() => everything(book, bankOps, bankAccounts), [book, bankOps, bankAccounts]);
  const current = monthOf(now);
  const months = useMemo(() => [...new Set([...monthsOf(ops), current])].sort(), [ops, current]);
  const [month, setMonth] = useState(current);
  const plan = ledgerPlan(book);
  const of = projectsOf(book);
  const names = new Map(book.projects.map((p) => [p.id, p.name]));
  const currencyOf = (op: Operation) => accounts.find((a) => a.id === op.account)?.currency ?? "UAH";
  const tag = (op: Operation) => accountLabel(op, accounts);

  const m = summarize(ops, accounts, book.rules, month, plan);
  const pm = projectsMonth(book, ops, accounts, month);
  const history = months.slice(-6).reverse().map((mo) => summarize(ops, accounts, book.rules, mo, plan));
  const top = Math.max(1, ...history.map((h) => h.income));
  const team = payouts(ops, accounts, plan, month, of);
  const planned = new Set(plan.map((r) => r.name));
  const extraTeam = m.team.filter((t) => !planned.has(t.name));
  const next = nextPayout(ops, accounts, plan, now);
  const i = months.indexOf(month);

  /** This month's operations by category, newest first. */
  const byCategory = new Map<Category, Operation[]>();
  for (const op of ops) {
    if (monthOf(op.time) !== month) continue;
    const c = classify(op, accounts, book.rules, plan);
    byCategory.set(c, [...(byCategory.get(c) ?? []), op]);
  }
  for (const list of byCategory.values()) list.sort((a, b) => b.time - a.time);
  /** A category can be changed only where a remembered recipient decides it. */
  const changeable = (op: Operation) => !op.spend && !planRowOf(op, accounts, plan);
  const onPick = (op: Operation) => (changeable(op) ? (s: Spend) => pick(op, s) : undefined);

  const toSortIn = book.projects.length ? pm.toSort : [];
  const toSortCount = m.toSort.length + toSortIn.length;
  const toSortSum = m.toSort.reduce((s, o) => s - o.amount, 0);
  const onSelf = m.self + m.dividends;
  const selfOps = byCategory.get("self") ?? [];
  const dividendOps = byCategory.get("dividends") ?? [];

  return (
    <div className="space-y-3">
      {demo ? <p className="rounded-full bg-amber-100 px-3 py-1 text-center text-xs font-semibold text-amber-900">Демо · дані вигадані</p> : null}
      {bank === "off" ? <p className="rounded-full bg-paper-100 px-3 py-1 text-center text-xs text-ink-700">Банк не підключено · приходи вносиш вручну</p> : null}
      {bank === "stale" ? <p className="rounded-full bg-paper-100 px-3 py-1 text-center text-xs text-ink-700">Банк не відповідає · показано збережене</p> : null}
      {problem ? (
        <div role="alert" className="rounded-xl bg-cherry-juice px-3 py-2 text-center text-sm text-cream-type">
          <p>{problem}</p>
          {unsaved ? (
            <button type="button" disabled={busy} onClick={() => run(unsaved)} className="mt-2 min-h-11 w-full rounded-full bg-cream-type px-4 font-semibold text-cherry-deep disabled:opacity-50">
              {busy ? "Зберігаю…" : "Зберегти ще раз"}
            </button>
          ) : null}
        </div>
      ) : null}

      <header className="flex items-center justify-between gap-2">
        <button type="button" aria-label="Попередній місяць" disabled={i <= 0} onClick={() => setMonth(months[i - 1])} className="size-11 rounded-full text-2xl text-cherry-deep disabled:opacity-25">
          ‹
        </button>
        <h1 className="font-display text-xl">{monthName(month)}</h1>
        <button type="button" aria-label="Наступний місяць" disabled={i >= months.length - 1} onClick={() => setMonth(months[i + 1])} className="size-11 rounded-full text-2xl text-cherry-deep disabled:opacity-25">
          ›
        </button>
      </header>

      <section className="rounded-3xl bg-cherry-deep p-5 text-cream-type" aria-label="Підсумок місяця">
        <p className="text-xs font-medium uppercase tracking-widest text-cream-type/70">Залишилось</p>
        <p className="mt-1 font-display text-4xl tabular-nums">{grn(m.left)}</p>
        {m.incomeUsd > 0 ? <p className="text-sm text-cream-type/75">і ще {money(m.incomeUsd, "USD")}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-cream-type/20 pt-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-cream-type/70">Прийшло</p>
            <p className="whitespace-nowrap text-xl tabular-nums">{grn(m.income)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-cream-type/70">Пішло</p>
            <p className="whitespace-nowrap text-xl tabular-nums">{grn(m.spent)}</p>
          </div>
        </div>
        {m.tax.setAside > 0 || onSelf > 0 ? (
          <ul className="mt-3 space-y-1 border-t border-cream-type/20 pt-3 text-sm text-cream-type/85">
            {m.tax.setAside > 0 ? (
              <li className="flex justify-between gap-3">
                <span>На податки, до {dayMonth(m.tax.by)}</span>
                <span className="tabular-nums">{grn(m.tax.setAside)}</span>
              </li>
            ) : null}
            {onSelf > 0 ? (
              <li className="flex justify-between gap-3">
                <a href="#dividends">Дивіденди, на себе</a>
                <span className="tabular-nums">{grn(onSelf)}</span>
              </li>
            ) : null}
          </ul>
        ) : null}
      </section>

      {toSortCount ? (
        <Group id="sort" title={`Розібрати (${toSortCount})`} open right={toSortSum ? <span className="text-cherry-juice">{grn(toSortSum)}</span> : null}>
          <SortOne
            spend={m.toSort}
            income={toSortIn}
            at={at}
            setAt={setAt}
            tag={tag}
            money={(op) => money(op.amount, currencyOf(op))}
            projects={book.projects}
            busy={busy}
            onSpend={pick}
            onIncome={(op, projects) => run({ type: "payer.assign", keys: payerKeys(op), name: payerName(op), projects })}
          />
        </Group>
      ) : null}

      {m.spent > 0 ? (
        <Group title="Куди пішло" right={grn(m.spent)}>
          <ul className="divide-y divide-paper-100">
            {BUSINESS.filter((s) => m.by[s] > 0).map((s) => (
              <li key={s}>
                <details>
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-1 [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="mr-2">{ICON[s]}</span>
                      {LABEL[s]}
                    </span>
                    <span className="tabular-nums">{grn(m.by[s])}</span>
                  </summary>
                  {s === "team" && (team.length || extraTeam.length) ? (
                    <TeamList team={team} extra={extraTeam} names={names} month={month} current={current} next={month === current ? next : undefined} now={now} />
                  ) : null}
                  <ul className="mb-2 divide-y divide-paper-100 rounded-xl bg-white/60 px-3">
                    {(byCategory.get(s) ?? []).map((op) => (
                      <OpLine key={op.id} op={op} tag={tag(op)} current={s} busy={busy} onPick={onPick(op)} />
                    ))}
                  </ul>
                </details>
              </li>
            ))}
            {m.toSort.length ? (
              <li className="flex min-h-11 items-center justify-between gap-3 py-1 text-cherry-juice">
                <a href="#sort">❓ Не розібрано</a>
                <span className="tabular-nums">{grn(toSortSum)}</span>
              </li>
            ) : null}
          </ul>
        </Group>
      ) : null}

      {book.projects.length ? (
        <Group title="Проекти" right={<span className="text-sm text-ink-700">заплатили {pm.paid} з {pm.total}</span>}>
          <ul className="divide-y divide-paper-100">
            {pm.rows.map((r) => (
              <ProjectLine key={r.project.id} row={r} month={month} names={names} currencyOf={currencyOf} busy={busy} onRemove={(id) => run({ type: "entry.remove", id })} />
            ))}
          </ul>
        </Group>
      ) : null}

      {onSelf > 0 ? (
        <Group id="dividends" title="Дивіденди" right={grn(onSelf)}>
          <p className="text-xs text-ink-500">Не входять у «Пішло»</p>
          <ul className="divide-y divide-paper-100">
            {selfOps.map((op) => (
              <li key={op.id} className="flex items-start justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block">На рожеву картку</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
                    <AccountTag label={tag(op)} />
                    {opDay(op)}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{grn(-op.amount)}</span>
              </li>
            ))}
            {dividendOps.map((op) => (
              <OpLine key={op.id} op={op} tag={tag(op)} current="dividends" busy={busy} onPick={onPick(op)} />
            ))}
          </ul>
        </Group>
      ) : null}

      {history.length > 1 ? (
        <Group title="По місяцях">
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h.month}>
                <button type="button" onClick={() => setMonth(h.month)} aria-current={h.month === month} className={`w-full rounded-xl px-2 py-2 text-left ${h.month === month ? "bg-paper-100" : ""}`}>
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{monthName(h.month).split(" ")[0]}</span>
                    <span className="tabular-nums text-ink-500">
                      {Math.round(h.income / 100_000)}к / {Math.round(h.spent / 100_000)}к / <strong className="text-ink-900">{Math.round(h.left / 100_000)}к</strong>
                    </span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-paper-200" style={{ width: `${(h.income / top) * 100}%` }}>
                    <span className="block h-full rounded-full bg-cherry-juice/70" style={{ width: `${h.income ? Math.min(100, (h.spent / h.income) * 100) : 0}%` }} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-500">прийшло / пішло / залишилось, тис. грн</p>
        </Group>
      ) : null}

      <AddMoney
        projects={pm.rows.map((r) => r.project)}
        today={kyivIso(now)}
        yesterday={kyivIso(now - 86_400)}
        busy={busy}
        problem={problem}
        onSave={async (entry) => {
          const saved = await run({ type: "entry.add", entry });
          return saved?.entries.at(-1)?.id ?? null;
        }}
        onUndo={async (id) => !!(await run({ type: "entry.remove", id }))}
      />

      <Settings book={book} busy={busy} run={run} />

      {last ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-ink-900 px-4 py-2 text-sm text-cream-type shadow-lg"
        >
          <span className="min-w-0 truncate">
            {ICON[last.category]} {last.name} → {LABEL[last.category]}
          </span>
          <button type="button" disabled={busy} onClick={undo} className="min-h-11 shrink-0 px-2 font-semibold text-amber-200">
            Скасувати
          </button>
        </div>
      ) : null}
      {/* room under the floating «＋ Внести» */}
      <div className="h-20" aria-hidden />
    </div>
  );
}

/* ---------- «Розібрати»: one operation per screen ---------- */

function SortOne({
  spend,
  income,
  at,
  setAt,
  tag,
  money: sum,
  projects,
  busy,
  onSpend,
  onIncome,
}: {
  spend: Operation[];
  income: Operation[];
  at: number;
  setAt: (n: number) => void;
  tag: (op: Operation) => string;
  money: (op: Operation) => string;
  projects: Project[];
  busy: boolean;
  onSpend: (op: Operation, s: Spend) => void;
  onIncome: (op: Operation, projects: string[]) => void;
}) {
  const all = [...spend, ...income];
  const k = all.length ? at % all.length : 0;
  const op = all[k];
  if (!op) return null;
  const isIncome = op.amount > 0;
  return (
    <div>
      <div className="rounded-2xl bg-white/70 p-4 text-center">
        <p className={`font-display text-3xl tabular-nums ${isIncome ? "text-emerald-700" : ""}`}>
          {isIncome ? "+" : "−"}
          {sum({ ...op, amount: Math.abs(op.amount) })}
        </p>
        <p className="mt-1 break-words text-lg">{isIncome ? payerName(op) : recipientName(op)}</p>
        <p className="mt-1 flex items-center justify-center gap-2 text-sm text-ink-500">
          <AccountTag label={tag(op)} />
          {opDay(op)}
        </p>
      </div>
      <p className="mb-2 mt-3 text-sm text-ink-700">{isIncome ? "За який проект? Можна кілька" : "Куди це?"}</p>
      {isIncome ? <SortIncome key={op.id} busy={busy} projects={projects} onDone={(ids) => onIncome(op, ids)} /> : <CategoryButtons busy={busy} onPick={(s) => onSpend(op, s)} />}
      {all.length > 1 ? (
        <div className="mt-3 flex items-center justify-between text-sm text-ink-500">
          <span className="tabular-nums">
            {k + 1} з {all.length}
          </span>
          <button type="button" onClick={() => setAt(k + 1)} className="min-h-11 px-2 font-medium text-cherry-deep">
            Пропустити ›
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SortIncome({ projects, busy, onDone }: { projects: Project[]; busy: boolean; onDone: (ids: string[]) => void }) {
  const [chosen, setChosen] = useState<string[]>([]);
  return (
    <div>
      <Chips projects={projects} chosen={chosen} onChange={setChosen} />
      <button type="button" disabled={busy || !chosen.length} onClick={() => onDone(chosen)} className={`mt-3 ${primary}`}>
        Готово
      </button>
    </div>
  );
}

/* ---------- the team, inside «Куди пішло» ---------- */

function TeamList({
  team,
  extra,
  names,
  month,
  current,
  next,
  now,
}: {
  team: Payout[];
  extra: { name: string; amount: number }[];
  names: Map<string, string>;
  month: string;
  current: string;
  next?: Reminder;
  now: number;
}) {
  return (
    <div className="mb-2">
      {next ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm">
          Виплата <strong>{when(next.date, now)}</strong>: {next.items.map((it) => `${it.name} ${grn(it.amount)}`).join(", ")}
        </p>
      ) : null}
      <ul className="divide-y divide-paper-100">
        {team.map((p) => {
          const project = names.get(p.forClient ?? p.row.project ?? "");
          return (
            <li key={p.row.id} className="flex items-start justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block">{p.row.name}</span>
                {project ? <span className="block text-xs text-ink-500">за {project}</span> : null}
              </span>
              <span className="shrink-0 text-right">
                <span className="block tabular-nums">{grn(p.row.amount)}</span>
                <span className={`block text-xs ${p.paidOn ? "text-emerald-700" : month < current ? "text-cherry-juice" : "text-ink-500"}`}>
                  {p.paidOn ? `✓ ${p.paidOn}-го` : month < current ? "не виплачено" : `${p.day}-го`}
                </span>
              </span>
            </li>
          );
        })}
        {extra.map((t) => (
          <li key={t.name} className="flex justify-between gap-3 py-2">
            <span>{t.name}</span>
            <span className="tabular-nums">{grn(t.amount)}</span>
          </li>
        ))}
      </ul>
      <p className={`${eyebrow} mt-2`}>Усі перекази</p>
    </div>
  );
}

/* ---------- projects ---------- */

function ProjectLine({
  row,
  month,
  names,
  currencyOf,
  busy,
  onRemove,
}: {
  row: ProjectRow;
  month: string;
  names: Map<string, string>;
  currencyOf: (op: Operation) => Currency;
  busy: boolean;
  onRemove: (entryId: string) => void;
}) {
  const { project, payments } = row;
  if (row.paused && !payments.length) {
    return (
      <li className="flex justify-between gap-3 py-2 text-ink-500">
        <span className="min-w-0 truncate">{project.name}</span>
        <span className="shrink-0 text-xs">{project.pausedUntil ? `пауза до ${monthTo(project.pausedUntil)}` : "пауза"}</span>
      </li>
    );
  }
  if (!payments.length) {
    return (
      <li className="flex justify-between gap-3 py-2">
        <span className="min-w-0 truncate">{project.name}</span>
        <span className="shrink-0 text-right">
          <span className="block tabular-nums text-ink-500">{money(project.amount, project.currency)}</span>
          <span className="block text-xs text-ink-500">ще ні</span>
        </span>
      </li>
    );
  }
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block">
          <span className="text-emerald-700" aria-label="заплатив">
            ✓
          </span>{" "}
          {project.name}
        </span>
        {payments.some((p) => p.with.length) ? (
          <span className="block text-xs text-ink-500">разом з {[...new Set(payments.flatMap((p) => p.with))].map((id) => names.get(id)).join(", ")}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-right">
        {payments.map(({ op }) => {
          const entry = entryIdOf(op);
          return (
            <span key={op.id} className="block tabular-nums">
              {op.manual === "cash" ? "💵 " : ""}
              {money(op.amount, currencyOf(op))}
              <span className="ml-1 text-xs text-ink-500">{opDay(op)}</span>
              {entry && monthOf(op.time) === month ? (
                <button
                  type="button"
                  aria-label="Видалити запис"
                  disabled={busy}
                  onClick={() => window.confirm("Видалити цей запис?") && onRemove(entry)}
                  className="ml-1 px-1 text-ink-500 hover:text-cherry-juice"
                >
                  ×
                </button>
              ) : null}
            </span>
          );
        })}
      </span>
    </li>
  );
}

/* ---------- the two settings ---------- */

function Settings({ book, busy, run }: { book: Book; busy: boolean; run: (a: Action) => Promise<unknown> }) {
  return (
    <details className={card} open={!book.projects.length}>
      <summary className="cursor-pointer font-medium">Налаштування: проекти й виплати</summary>
      <ProjectsEditor projects={book.projects} busy={busy} run={run} />
      <PlanEditor book={book} busy={busy} run={run} />
    </details>
  );
}

const emptyProject = { name: "", sum: "", currency: "UAH" as Currency, pausedFrom: "", pausedUntil: "" };

function ProjectsEditor({ projects, busy, run }: { projects: Project[]; busy: boolean; run: (a: Action) => Promise<unknown> }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [f, setF] = useState(emptyProject);
  const amount = toMinor(f.sum);
  const ok = f.name.trim().length > 0 && amount >= 0 && !Number.isNaN(amount);
  const edit = (p: Project) => {
    setEditing(p.id);
    setF({ name: p.name, sum: String(p.amount / 100), currency: p.currency, pausedFrom: p.pausedFrom ?? "", pausedUntil: p.pausedUntil ?? "" });
  };
  const reset = () => {
    setEditing(null);
    setF(emptyProject);
  };

  return (
    <div className="mt-4">
      <h3 className={eyebrow}>Проекти</h3>
      <ul className="mt-2 divide-y divide-paper-100">
        {projects.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => edit(p)} className="flex w-full justify-between gap-3 py-2 text-left">
              <span className="min-w-0 truncate">{p.name}</span>
              <span className="shrink-0 tabular-nums text-ink-500">
                {money(p.amount, p.currency)}
                {p.pausedFrom || p.pausedUntil ? " · пауза" : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ok) return;
          const saved = await run({
            type: "project.save",
            project: {
              ...(editing ? { id: editing } : {}),
              name: f.name.trim(),
              amount,
              currency: f.currency,
              ...(f.pausedFrom ? { pausedFrom: f.pausedFrom } : {}),
              ...(f.pausedUntil ? { pausedUntil: f.pausedUntil } : {}),
            },
          });
          if (saved) reset();
        }}
      >
        <p className="text-sm font-medium">{editing ? "Змінити проект" : "Новий проект"}</p>
        <input aria-label="Назва" placeholder="Назва" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} />
        <div className="flex gap-2">
          <input inputMode="decimal" aria-label="Сума в місяць" placeholder="Сума в місяць" value={f.sum} onChange={(e) => setF({ ...f, sum: e.target.value })} className={input} />
          <button type="button" aria-label="Валюта" onClick={() => setF({ ...f, currency: f.currency === "UAH" ? "USD" : "UAH" })} className={`${chip(false)} shrink-0`}>
            {f.currency === "UAH" ? "грн" : "$"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-ink-500">
          <label>
            Пауза з місяця
            <input type="month" value={f.pausedFrom} onChange={(e) => setF({ ...f, pausedFrom: e.target.value })} className={input} />
          </label>
          <label>
            Знову платить з
            <input type="month" value={f.pausedUntil} onChange={(e) => setF({ ...f, pausedUntil: e.target.value })} className={input} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || !ok} className={primary}>
            Зберегти
          </button>
          {editing ? (
            <>
              <button type="button" onClick={reset} className="px-3 text-sm text-ink-500">
                Скасувати
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => window.confirm("Видалити проект? Його приходи залишаться в «Прийшло».") && (await run({ type: "project.remove", id: editing })) && reset()}
                className="ml-auto px-3 text-sm text-cherry-juice"
              >
                Видалити
              </button>
            </>
          ) : null}
        </div>
      </form>
    </div>
  );
}

const emptyRow = { name: "", recipient: "", sum: "", day: "", project: "" };

function PlanEditor({ book, busy, run }: { book: Book; busy: boolean; run: (a: Action) => Promise<unknown> }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [f, setF] = useState(emptyRow);
  const amount = toMinor(f.sum);
  const day = Number(f.day);
  const ok = f.name.trim().length > 0 && amount > 0 && Number.isInteger(day) && day >= 1 && day <= 31;
  const names = new Map(book.projects.map((p) => [p.id, p.name]));
  const reset = () => {
    setEditing(null);
    setF(emptyRow);
  };

  return (
    <div className="mt-6">
      <h3 className={eyebrow}>План виплат</h3>
      <ul className="mt-2 divide-y divide-paper-100">
        {[...book.plan]
          .sort((a, b) => a.day - b.day)
          .map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  setEditing(r.id);
                  setF({ name: r.name, recipient: r.recipient, sum: String(r.amount / 100), day: String(r.day), project: r.project ?? "" });
                }}
                className="flex w-full justify-between gap-3 py-2 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate">{r.name}</span>
                  {r.project ? <span className="block text-xs text-ink-500">за {names.get(r.project)}</span> : null}
                </span>
                <span className="shrink-0 text-right tabular-nums text-ink-500">
                  {grn(r.amount)}
                  <span className="block text-xs">{r.day}-го</span>
                </span>
              </button>
            </li>
          ))}
      </ul>
      <form
        className="mt-3 space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ok) return;
          const saved = await run({
            type: "plan.save",
            row: { ...(editing ? { id: editing } : {}), name: f.name.trim(), recipient: f.recipient.trim(), amount, day, ...(f.project ? { project: f.project } : {}) },
          });
          if (saved) reset();
        }}
      >
        <p className="text-sm font-medium">{editing ? "Змінити виплату" : "Нова виплата"}</p>
        <input aria-label="Кому" placeholder="Кому" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} />
        <input
          aria-label="Як у виписці"
          placeholder="Як у виписці банку (якщо інакше)"
          value={f.recipient}
          onChange={(e) => setF({ ...f, recipient: e.target.value })}
          className={input}
        />
        <div className="flex gap-2">
          <input inputMode="decimal" aria-label="Скільки, грн" placeholder="Скільки, грн" value={f.sum} onChange={(e) => setF({ ...f, sum: e.target.value })} className={input} />
          <input inputMode="numeric" aria-label="Якого числа" placeholder="Число" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} className={`${input} w-24`} />
        </div>
        <select aria-label="За який проект" value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })} className={input}>
          <option value="">Без проекту</option>
          {book.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || !ok} className={primary}>
            Зберегти
          </button>
          {editing ? (
            <>
              <button type="button" onClick={reset} className="px-3 text-sm text-ink-500">
                Скасувати
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => window.confirm("Видалити виплату з плану?") && (await run({ type: "plan.remove", id: editing })) && reset()}
                className="ml-auto px-3 text-sm text-cherry-juice"
              >
                Видалити
              </button>
            </>
          ) : null}
        </div>
      </form>
    </div>
  );
}
