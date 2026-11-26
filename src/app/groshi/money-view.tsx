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
  monthOf,
  monthsOf,
  nextPayout,
  payouts,
  recipientKey,
  recipientName,
  SPENDS,
  summarize,
  type Account,
  type Operation,
  type Spend,
} from "@/lib/money/ledger";
import { dropUnsaved, keepUnsaved, problemText, readUnsaved, retryable } from "@/lib/money/pending";

/* One column, phone first. Big numbers, almost no words: «прийшло / пішло /
   залишилось», then who of the projects paid. Empty blocks are not shown.
   Two settings only, folded at the bottom: projects and the payout plan.
   The same screen for the demo (memory only) and the cabinet (Blob). */

const LABEL: Record<Spend, string> = { team: "Команда", taxes: "Податки", ads: "Реклама і сервіси", other: "Інше" };
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

/** A tile number on one line: big digits, a small «грн». */
function Big({ kop }: { kop: number }) {
  return (
    <p className="mt-1 whitespace-nowrap font-display text-[1.3rem] tabular-nums">
      {Math.round(kop / 100).toLocaleString("uk-UA")}
      <span className="ml-1 font-body text-sm text-ink-500">грн</span>
    </p>
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

  /** The demo changes its memory; the cabinet saves first and shows what was saved. */
  async function run(action: Action): Promise<boolean> {
    setProblem("");
    if (demo) {
      setBook((b) => apply(b, action, () => Math.random().toString(36).slice(2, 10)));
      return true;
    }
    setBusy(true);
    let status = 0;
    let error = "";
    try {
      const res = await fetch("/api/cabinet/groshi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
      status = res.status;
      if (res.status === 401) {
        keepUnsaved(local(), action);
        window.location.href = "/cabinet/login";
        return false;
      }
      const answer = await res.json();
      if (answer.ok) {
        setBook(answer.book);
        setUnsaved(null);
        dropUnsaved(local());
        return true;
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
    return false;
  }

  const { ops, accounts } = useMemo(() => everything(book, bankOps, bankAccounts), [book, bankOps, bankAccounts]);
  const current = monthOf(now);
  const months = useMemo(() => [...new Set([...monthsOf(ops), current])].sort(), [ops, current]);
  const [month, setMonth] = useState(current);
  const plan = ledgerPlan(book);
  const of = projectsOf(book);
  const names = new Map(book.projects.map((p) => [p.id, p.name]));
  const currencyOf = (op: Operation) => accounts.find((a) => a.id === op.account)?.currency ?? "UAH";

  const m = summarize(ops, accounts, book.rules, month, plan);
  const pm = projectsMonth(book, ops, accounts, month);
  const history = months.slice(-6).reverse().map((mo) => summarize(ops, accounts, book.rules, mo, plan));
  const top = Math.max(1, ...history.map((h) => h.income));
  const team = payouts(ops, accounts, plan, month, of);
  const planned = new Set(plan.map((r) => r.name));
  const extraTeam = m.team.filter((t) => !planned.has(t.name));
  const next = nextPayout(ops, accounts, plan, now);
  const i = months.indexOf(month);

  return (
    <div className="space-y-4">
      {demo ? <p className="rounded-full bg-amber-100 px-3 py-1 text-center text-xs font-semibold text-amber-900">Демо · дані вигадані</p> : null}
      {bank === "off" ? <p className="rounded-full bg-paper-100 px-3 py-1 text-center text-xs text-ink-700">Банк ще не підключено · приходи додавай вручну</p> : null}
      {bank === "stale" ? <p className="rounded-full bg-paper-100 px-3 py-1 text-center text-xs text-ink-700">Банк зараз не відповідає · показано збережене</p> : null}
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

      <div className="grid grid-cols-2 gap-3">
        <div className={card}>
          <p className={eyebrow}>Прийшло</p>
          <Big kop={m.income} />
          {m.incomeUsd > 0 ? <p className="whitespace-nowrap text-sm tabular-nums">+ {money(m.incomeUsd, "USD")}</p> : null}
          {m.cash > 0 ? <p className="whitespace-nowrap text-xs text-ink-500">💵 готівкою {grn(m.cash)}</p> : null}
        </div>
        <div className={card}>
          <p className={eyebrow}>Пішло</p>
          <Big kop={m.spent} />
        </div>
      </div>

      <section className="rounded-2xl bg-cherry-deep p-5 text-cream-type">
        <p className="text-xs font-medium uppercase tracking-widest text-cream-type/70">Залишилось тобі</p>
        <p className="mt-1 font-display text-4xl tabular-nums">{grn(m.left)}</p>
        {m.incomeUsd > 0 ? <p className="mt-1 text-sm text-cream-type/75">і ще {money(m.incomeUsd, "USD")}</p> : null}
        {m.self > 0 ? <p className="mt-1 text-sm text-cream-type/75">з них уже взяла собі {grn(m.self)}</p> : null}
      </section>

      {m.tax.setAside > 0 ? (
        <p className={`${card} flex items-baseline justify-between gap-3`}>
          <span className="text-sm">Відкласти на податки</span>
          <span className="text-right">
            <strong className="tabular-nums">{grn(m.tax.setAside)}</strong>
            <span className="block text-xs text-ink-500">до {dayMonth(m.tax.by)}</span>
          </span>
        </p>
      ) : null}

      {book.projects.length ? (
        <section className={card}>
          <h2 className={eyebrow}>Проекти</h2>
          <p className="mt-1 text-lg">
            Заплатили <strong className="tabular-nums">{pm.paid}</strong> з <span className="tabular-nums">{pm.total}</span>
          </p>
          <ul className="mt-2 divide-y divide-paper-100">
            {pm.rows.map((r) => (
              <ProjectLine key={r.project.id} row={r} month={month} names={names} currencyOf={currencyOf} busy={busy} onRemove={(id) => run({ type: "entry.remove", id })} />
            ))}
          </ul>
        </section>
      ) : null}

      <AddIncome projects={book.projects} today={kyivIso(now)} busy={busy} onAdd={(entry) => run({ type: "entry.add", entry })} />

      {pm.toSort.length && book.projects.length ? (
        <section className={card}>
          <h2 className={eyebrow}>Розібрати · прийшло</h2>
          <ul className="mt-2 space-y-5">
            {pm.toSort.map((op) => (
              <SortIncome key={op.id} op={op} money={money(op.amount, currencyOf(op))} projects={book.projects} busy={busy} onDone={(projects) => run({ type: "payer.assign", keys: payerKeys(op), name: payerName(op), projects })} />
            ))}
          </ul>
        </section>
      ) : null}

      {m.spent > 0 ? (
        <section className={card}>
          <h2 className={eyebrow}>Куди пішло</h2>
          <ul className="mt-2 divide-y divide-paper-100">
            {SPENDS.filter((s) => m.by[s] > 0).map((s) => (
              <li key={s} className="flex justify-between py-2">
                <span>{LABEL[s]}</span>
                <span className="tabular-nums">{grn(m.by[s])}</span>
              </li>
            ))}
            {m.toSort.length ? (
              <li className="flex justify-between py-2 text-cherry-juice">
                <a href="#sort">Розібрати</a>
                <span className="tabular-nums">{grn(m.toSort.reduce((s, o) => s - o.amount, 0))}</span>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {team.length || extraTeam.length ? (
        <section className={card}>
          <h2 className={eyebrow}>Команда</h2>
          {next && month === current ? (
            <p className="mt-2 rounded-xl bg-paper-100 px-3 py-2 text-sm">
              Найближча виплата: <strong>{when(next.date, now)}</strong>, {next.items.map((it) => `${it.name} ${grn(it.amount)}`).join(", ")}
              {next.items.length > 1 ? ` · разом ${grn(next.total)}` : ""}
            </p>
          ) : null}
          <ul className="mt-2 divide-y divide-paper-100">
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
                      {p.paidOn ? `виплачено ${p.paidOn}-го` : month < current ? "не виплачено" : `виплата ${p.day}-го`}
                    </span>
                  </span>
                </li>
              );
            })}
            {extraTeam.map((t) => (
              <li key={t.name} className="flex justify-between gap-3 py-2">
                <span>{t.name}</span>
                <span className="tabular-nums">{grn(t.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {m.toSort.length ? (
        <section id="sort" className={`${card} scroll-mt-4`}>
          <h2 className={eyebrow}>Розібрати · пішло</h2>
          <ul className="mt-2 space-y-4">
            {m.toSort.map((op) => (
              <li key={op.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate">{recipientName(op)}</span>
                  <span className="shrink-0 tabular-nums">{grn(-op.amount)}</span>
                </div>
                <p className="text-xs text-ink-500">{opDay(op)}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {SPENDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy}
                      onClick={() => run({ type: "rule.set", key: recipientKey(op), name: recipientName(op), category: s })}
                      className="rounded-full border border-paper-200 px-3 py-2 text-sm hover:border-cherry-juice active:bg-paper-100"
                    >
                      {LABEL[s]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {history.length > 1 ? (
        <section className={card}>
          <h2 className={eyebrow}>По місяцях</h2>
          <ul className="mt-2 space-y-1">
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
          <p className="mt-2 text-xs text-ink-500">прийшло / пішло / тобі, тис. грн</p>
        </section>
      ) : null}

      <Settings book={book} busy={busy} run={run} />
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

function SortIncome({ op, money: sum, projects, busy, onDone }: { op: Operation; money: string; projects: Project[]; busy: boolean; onDone: (ids: string[]) => void }) {
  const [chosen, setChosen] = useState<string[]>([]);
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate">{payerName(op)}</span>
        <span className="shrink-0 tabular-nums">{sum}</span>
      </div>
      <p className="text-xs text-ink-500">{opDay(op)} · За який проект? Можна кілька.</p>
      <div className="mt-2">
        <Chips projects={projects} chosen={chosen} onChange={setChosen} />
      </div>
      <button type="button" disabled={busy || !chosen.length} onClick={() => onDone(chosen)} className={`mt-2 ${primary}`}>
        Готово
      </button>
    </li>
  );
}

function AddIncome({ projects, today, busy, onAdd }: { projects: Project[]; today: string; busy: boolean; onAdd: (e: { date: string; amount: number; currency: Currency; projects: string[]; cash: boolean }) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [sum, setSum] = useState("");
  const [currency, setCurrency] = useState<Currency>("UAH");
  const [cash, setCash] = useState(true);
  const [chosen, setChosen] = useState<string[]>([]);
  const [date, setDate] = useState(today);
  const amount = toMinor(sum);
  const ok = amount > 0 && chosen.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);

  if (!projects.length) return null;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-2xl border-2 border-dashed border-paper-200 py-3 font-semibold text-cherry-deep">
        + Додати прихід
        <span className="block text-xs font-normal text-ink-500">готівка або на рахунок</span>
      </button>
    );
  }
  return (
    <form
      className={`${card} space-y-3`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok) return;
        if (await onAdd({ date, amount, currency, projects: chosen, cash })) {
          setSum("");
          setChosen([]);
          setOpen(false);
        }
      }}
    >
      <h2 className={eyebrow}>Новий прихід</h2>
      <div className="flex gap-2">
        <button type="button" aria-pressed={cash} onClick={() => setCash(true)} className={chip(cash)}>
          💵 Готівка
        </button>
        <button type="button" aria-pressed={!cash} onClick={() => setCash(false)} className={chip(!cash)}>
          На рахунок
        </button>
      </div>
      <div className="flex gap-2">
        <input inputMode="decimal" aria-label="Сума" placeholder="Сума" value={sum} onChange={(e) => setSum(e.target.value)} className={input} />
        <button type="button" aria-label="Валюта" onClick={() => setCurrency(currency === "UAH" ? "USD" : "UAH")} className={`${chip(false)} shrink-0`}>
          {currency === "UAH" ? "грн" : "$"}
        </button>
      </div>
      <Chips projects={projects} chosen={chosen} onChange={setChosen} />
      <input type="date" aria-label="Дата" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !ok} className={primary}>
          Додати
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 text-sm text-ink-500">
          Скасувати
        </button>
      </div>
    </form>
  );
}

/* ---------- the two settings ---------- */

function Settings({ book, busy, run }: { book: Book; busy: boolean; run: (a: Action) => Promise<boolean> }) {
  return (
    <details className={card} open={!book.projects.length}>
      <summary className="cursor-pointer font-medium">Налаштування: проекти й виплати</summary>
      <ProjectsEditor projects={book.projects} busy={busy} run={run} />
      <PlanEditor book={book} busy={busy} run={run} />
    </details>
  );
}

const emptyProject = { name: "", sum: "", currency: "UAH" as Currency, pausedFrom: "", pausedUntil: "" };

function ProjectsEditor({ projects, busy, run }: { projects: Project[]; busy: boolean; run: (a: Action) => Promise<boolean> }) {
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

function PlanEditor({ book, busy, run }: { book: Book; busy: boolean; run: (a: Action) => Promise<boolean> }) {
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
