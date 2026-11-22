"use client";

import { useMemo, useState } from "react";
import {
  monthOf,
  monthsOf,
  nextPayout,
  payouts,
  recipientName,
  remember,
  SPENDS,
  summarize,
  type Account,
  type Operation,
  type Plan,
  type Rules,
  type Spend,
} from "@/lib/money/ledger";

/* One column, phone first. Big numbers, almost no words: «прийшло / пішло /
   залишилось». Empty blocks are not shown. No tables, filters, settings. */

const LABEL: Record<Spend, string> = { team: "Команда", taxes: "Податки", ads: "Реклама і сервіси", other: "Інше" };
const MONTH = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];

const grn = (kop: number) => `${Math.round(kop / 100).toLocaleString("uk-UA")} грн`;
const monthName = (month: string) => `${MONTH[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
const dayMonth = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
const opDay = (op: Operation) => new Date(op.time * 1000).toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit" });
const kyivIso = (unix: number) => new Date(unix * 1000).toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv" });

const card = "rounded-2xl border border-paper-200 bg-cream-type p-4 shadow-[0_1px_0_rgba(74,13,20,0.04),0_8px_24px_-16px_rgba(74,13,20,0.25)]";
const eyebrow = "text-xs font-medium uppercase tracking-widest text-ink-500";

function when(iso: string, now: number): string {
  const today = kyivIso(now);
  const tomorrow = kyivIso(now + 86_400);
  return iso === today ? "сьогодні" : iso === tomorrow ? "завтра" : dayMonth(iso);
}

export function MoneyView({ ops, accounts, plan, now, demo }: { ops: Operation[]; accounts: Account[]; plan: Plan; now: number; demo?: boolean }) {
  const months = useMemo(() => monthsOf(ops), [ops]);
  const [month, setMonth] = useState(months[months.length - 1]);
  // In the demo a sorted recipient lives in the page's memory only.
  const [rules, setRules] = useState<Rules>({});

  const m = summarize(ops, accounts, rules, month, plan);
  const history = months.slice(-6).reverse().map((mo) => summarize(ops, accounts, rules, mo, plan));
  const top = Math.max(1, ...history.map((h) => h.income));
  const team = payouts(ops, accounts, plan, month);
  const planned = new Set(plan.map((r) => r.name));
  const extraTeam = m.team.filter((t) => !planned.has(t.name));
  const next = nextPayout(ops, accounts, plan, now);
  const current = monthOf(now);
  const i = months.indexOf(month);

  return (
    <div className="space-y-4">
      {demo ? <p className="rounded-full bg-amber-100 px-3 py-1 text-center text-xs font-semibold text-amber-900">Демо · дані вигадані</p> : null}

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
          <p className="mt-1 font-display text-2xl tabular-nums">{grn(m.income)}</p>
        </div>
        <div className={card}>
          <p className={eyebrow}>Пішло</p>
          <p className="mt-1 font-display text-2xl tabular-nums">{grn(m.spent)}</p>
        </div>
      </div>

      <section className="rounded-2xl bg-cherry-deep p-5 text-cream-type">
        <p className="text-xs font-medium uppercase tracking-widest text-cream-type/70">Залишилось тобі</p>
        <p className="mt-1 font-display text-4xl tabular-nums">{grn(m.left)}</p>
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
            {team.map((p) => (
              <li key={p.row.id} className="flex items-start justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block">{p.row.name}</span>
                  {p.forClient ?? p.row.client ? <span className="block text-xs text-ink-500">за {p.forClient ?? p.row.client}</span> : null}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block tabular-nums">{grn(p.row.amount)}</span>
                  <span className={`block text-xs ${p.paidOn ? "text-emerald-700" : month < current ? "text-cherry-juice" : "text-ink-500"}`}>
                    {p.paidOn ? `виплачено ${p.paidOn}-го` : month < current ? "не виплачено" : `виплата ${p.day}-го`}
                  </span>
                </span>
              </li>
            ))}
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
          <h2 className={eyebrow}>Розібрати</h2>
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
                      onClick={() => setRules((r) => remember(r, op, s))}
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
    </div>
  );
}
