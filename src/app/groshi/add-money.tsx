"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Currency, Project } from "@/lib/money/book";
import type { Spend } from "@/lib/money/ledger";

/* Typing money in, one thing per screen, phone first — the way monobank,
   Monefy and Wallet do it: the sum big, then where it goes, then save.
     1. Сума — «Прийшло / Пішло» on top, the number large, the keyboard up;
     2. Куди — income: which project (unpaid first); spending: one of four tiles;
     3. Коли — today / yesterday / another day (+ cash or account for income);
     4. ✓ — saved, «Ще один» or back to the month; one tap undoes it.
   On a failed save the screen stays as it is, with «Зберегти ще раз». */

export interface NewEntry {
  date: string;
  amount: number;
  currency: Currency;
  projects: string[];
  cash: boolean;
  spend?: Spend;
}

const SPEND_TILES: { key: Spend; label: string; icon: string }[] = [
  { key: "team", label: "Команда", icon: "👥" },
  { key: "ads", label: "Реклама і сервіси", icon: "📣" },
  { key: "taxes", label: "Податки", icon: "🏛" },
  { key: "other", label: "Інше", icon: "🧾" },
];

/** «1 500,50» or «1500» → minor units; nothing sensible → NaN. */
const toMinor = (text: string) =>
  Math.round(Number(text.replace(/\s/g, "").replace(",", ".")) * 100);
const shown = (minor: number, currency: Currency) => {
  const n = (minor / 100).toLocaleString("uk-UA", { maximumFractionDigits: 2 });
  return currency === "USD" ? `$${n}` : `${n} грн`;
};

type Step = "sum" | "where" | "when" | "done";

const big = "min-h-14 w-full rounded-2xl px-4 text-lg font-semibold";
const primaryBig = `${big} bg-cherry-deep text-cream-type disabled:opacity-40`;
const quiet = "min-h-11 rounded-full px-4 text-sm text-ink-700";
const toggle = (on: boolean) =>
  `min-h-11 flex-1 rounded-full text-base font-semibold ${on ? "bg-cherry-deep text-cream-type" : "text-ink-700"}`;

export function AddMoney({
  projects,
  today,
  yesterday,
  busy,
  problem,
  onSave,
  onUndo,
}: {
  /** in the order to offer them: unpaid this month first */
  projects: Project[];
  today: string;
  yesterday: string;
  busy: boolean;
  /** what went wrong with the last save, shown on the screen it happened on */
  problem: string;
  /** saves; the new entry's id, or null when it did not save */
  onSave: (entry: NewEntry) => Promise<string | null>;
  onUndo: (entryId: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("sum");
  const [income, setIncome] = useState(true);
  const [sum, setSum] = useState("");
  const [currency, setCurrency] = useState<Currency>("UAH");
  const [chosen, setChosen] = useState<string[]>([]);
  const [spend, setSpend] = useState<Spend | null>(null);
  const [date, setDate] = useState(today);
  const [cash, setCash] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const sumInput = useRef<HTMLInputElement>(null);

  const amount = toMinor(sum);
  const sumOk = amount > 0 && amount <= 100_000_000_00;
  const cur: Currency = income ? currency : "UAH";

  const start = () => {
    setStep("sum");
    setSum("");
    setChosen([]);
    setSpend(null);
    setDate(today);
    setSaved(null);
    setOpen(true);
  };
  const close = () => setOpen(false);
  const back = () => setStep(step === "when" ? "where" : "sum");

  useEffect(() => {
    if (open && step === "sum") sumInput.current?.focus();
  }, [open, step]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  async function save() {
    const id = await onSave({
      date,
      amount,
      currency: cur,
      projects: income ? chosen : [],
      cash: income ? cash : false,
      ...(income ? {} : { spend: spend ?? "other" }),
    });
    if (id) {
      setSaved(id);
      setStep("done");
    }
  }

  const where = income
    ? chosen
        .map((p) => projects.find((x) => x.id === p)?.name)
        .filter(Boolean)
        .join(", ")
    : (SPEND_TILES.find((t) => t.key === spend)?.label ?? "");

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={start}
          className="pointer-events-auto min-h-14 rounded-full bg-cherry-deep px-8 text-lg font-semibold text-cream-type shadow-lg"
        >
          ＋ Внести
        </button>
      </div>

      {open
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Внести гроші"
              className="fixed inset-0 z-40 overflow-y-auto bg-cream-type"
            >
              <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                <div className="flex items-center justify-between">
                  {step === "where" || step === "when" ? (
                    <button
                      type="button"
                      onClick={back}
                      aria-label="Назад"
                      className="size-11 text-2xl text-cherry-deep"
                    >
                      ‹
                    </button>
                  ) : (
                    <span className="size-11" />
                  )}
                  <p className="text-sm text-ink-500">
                    {step === "sum"
                      ? "1 з 3"
                      : step === "where"
                        ? "2 з 3"
                        : step === "when"
                          ? "3 з 3"
                          : ""}
                  </p>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Закрити"
                    className="size-11 text-2xl text-ink-500"
                  >
                    ×
                  </button>
                </div>

                {step === "sum" ? (
                  <form
                    className="flex flex-1 flex-col"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (sumOk) setStep("where");
                    }}
                  >
                    <div
                      className="mt-2 flex rounded-full bg-paper-100 p-1"
                      role="group"
                      aria-label="Прийшло чи пішло"
                    >
                      <button
                        type="button"
                        aria-pressed={income}
                        onClick={() => setIncome(true)}
                        className={toggle(income)}
                      >
                        Прийшло
                      </button>
                      <button
                        type="button"
                        aria-pressed={!income}
                        onClick={() => setIncome(false)}
                        className={toggle(!income)}
                      >
                        Пішло
                      </button>
                    </div>
                    <label
                      className="mt-10 block text-center text-sm text-ink-500"
                      htmlFor="money-sum"
                    >
                      {income ? "Скільки прийшло?" : "Скільки пішло?"}
                    </label>
                    <div className="mt-2 flex items-baseline justify-center gap-2">
                      <input
                        id="money-sum"
                        ref={sumInput}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0"
                        value={sum}
                        onChange={(e) =>
                          setSum(e.target.value.replace(/[^\d\s,.]/g, ""))
                        }
                        className="w-full min-w-0 bg-transparent text-center font-display text-5xl tabular-nums outline-none placeholder:text-paper-200"
                      />
                    </div>
                    {income ? (
                      <button
                        type="button"
                        onClick={() =>
                          setCurrency(currency === "UAH" ? "USD" : "UAH")
                        }
                        className={`${quiet} mx-auto mt-2 border border-paper-200`}
                      >
                        {currency === "UAH"
                          ? "грн · змінити на $"
                          : "$ · змінити на грн"}
                      </button>
                    ) : (
                      <p className="mt-2 text-center text-sm text-ink-500">
                        грн
                      </p>
                    )}
                    <div className="flex-1" />
                    <button
                      type="submit"
                      disabled={!sumOk}
                      className={`${primaryBig} mt-6`}
                    >
                      Далі
                    </button>
                  </form>
                ) : null}

                {step === "where" && income ? (
                  <div className="flex flex-1 flex-col">
                    <p className="mt-2 text-center font-display text-2xl tabular-nums">
                      {shown(amount, cur)}
                    </p>
                    <h2 className="mt-4 text-lg font-semibold">
                      За який проект?
                    </h2>
                    <p className="text-sm text-ink-500">
                      Можна кілька, якщо одна оплата за кілька.
                    </p>
                    <ul className="mt-3 space-y-2">
                      {projects.map((p) => {
                        const on = chosen.includes(p.id);
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              aria-pressed={on}
                              onClick={() =>
                                setChosen(
                                  on
                                    ? chosen.filter((x) => x !== p.id)
                                    : [...chosen, p.id],
                                )
                              }
                              className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-left ${on ? "border-cherry-deep bg-cherry-deep text-cream-type" : "border-paper-200"}`}
                            >
                              <span className="min-w-0 truncate">{p.name}</span>
                              <span className="shrink-0">{on ? "✓" : ""}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="flex-1" />
                    <div className="sticky bottom-0 bg-cream-type pt-3">
                      <button
                        type="button"
                        disabled={!chosen.length}
                        onClick={() => setStep("when")}
                        className={primaryBig}
                      >
                        Далі
                      </button>
                    </div>
                  </div>
                ) : null}

                {step === "where" && !income ? (
                  <div className="flex flex-1 flex-col">
                    <p className="mt-2 text-center font-display text-2xl tabular-nums">
                      {shown(amount, cur)}
                    </p>
                    <h2 className="mt-4 text-lg font-semibold">На що пішло?</h2>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {SPEND_TILES.map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => {
                            setSpend(t.key);
                            setStep("when");
                          }}
                          className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center ${spend === t.key ? "border-cherry-deep" : "border-paper-200"}`}
                        >
                          <span className="text-3xl" aria-hidden>
                            {t.icon}
                          </span>
                          <span className="text-sm font-medium">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {step === "when" ? (
                  <div className="flex flex-1 flex-col">
                    <p className="mt-2 text-center font-display text-4xl tabular-nums">
                      {shown(amount, cur)}
                    </p>
                    <p className="mt-1 text-center text-ink-700">
                      {income ? "прийшло · " : "пішло · "}
                      {where}
                    </p>
                    <h2 className="mt-6 text-lg font-semibold">Коли?</h2>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        aria-pressed={date === today}
                        onClick={() => setDate(today)}
                        className={
                          toggle(date === today) + " border border-paper-200"
                        }
                      >
                        Сьогодні
                      </button>
                      <button
                        type="button"
                        aria-pressed={date === yesterday}
                        onClick={() => setDate(yesterday)}
                        className={
                          toggle(date === yesterday) +
                          " border border-paper-200"
                        }
                      >
                        Вчора
                      </button>
                    </div>
                    <label className="mt-2 flex items-center justify-between gap-3 text-sm text-ink-700">
                      Інший день
                      <input
                        type="date"
                        value={date}
                        max={today}
                        onChange={(e) =>
                          e.target.value && setDate(e.target.value)
                        }
                        className="rounded-xl border border-paper-200 bg-white px-3 py-2"
                      />
                    </label>
                    {income ? (
                      <>
                        <h2 className="mt-6 text-lg font-semibold">Як?</h2>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            aria-pressed={cash}
                            onClick={() => setCash(true)}
                            className={
                              toggle(cash) + " border border-paper-200"
                            }
                          >
                            💵 Готівка
                          </button>
                          <button
                            type="button"
                            aria-pressed={!cash}
                            onClick={() => setCash(false)}
                            className={
                              toggle(!cash) + " border border-paper-200"
                            }
                          >
                            На рахунок
                          </button>
                        </div>
                      </>
                    ) : null}
                    <div className="flex-1" />
                    {problem ? (
                      <p
                        role="alert"
                        className="mt-4 rounded-xl bg-cherry-juice px-3 py-2 text-center text-sm text-cream-type"
                      >
                        {problem}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={save}
                      className={`${primaryBig} mt-4`}
                    >
                      {busy
                        ? "Зберігаю…"
                        : problem
                          ? "Зберегти ще раз"
                          : "Зберегти"}
                    </button>
                  </div>
                ) : null}

                {step === "done" ? (
                  <div className="flex flex-1 flex-col items-center text-center">
                    <p className="mt-16 text-6xl text-emerald-700" aria-hidden>
                      ✓
                    </p>
                    <p className="mt-4 text-xl font-semibold">Збережено</p>
                    <p className="mt-1 text-ink-700">
                      {shown(amount, cur)} · {where}
                    </p>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={start}
                      className={`${big} border border-paper-200`}
                    >
                      Ще один
                    </button>
                    <button
                      type="button"
                      onClick={close}
                      className={`${primaryBig} mt-3`}
                    >
                      Готово
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        if (saved && (await onUndo(saved))) close();
                      }}
                      className={`${quiet} mt-2`}
                    >
                      Скасувати запис
                    </button>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
