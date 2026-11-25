import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { accessOf, monoToken, price, syncBilling, type Access } from "@/lib/billing/mono";
import { readAttempts, summarize, type Attempt } from "@/lib/client/attempts";
import { CherryIcon } from "@/components/ui/icons";
import { CLIENT_COOKIE, isClientId, signedInClient, type Client } from "@/lib/client/clients";
import { readResults, SHOWN_ROWS, splitByDay, type Results } from "@/lib/client/results";
import { site } from "@/lib/site";

/* One client's cabinet: the subscription and the bot's results. Everything
   here is read for the client named by the SESSION — a cookie of another
   client, or none, lands on the login form and reads nothing. */

const STALE_MS = 6 * 60 * 60 * 1000;
/** How many of the newest attempts the cabinet lists; the charts count all of them. */
const LATEST = 12;
const stale = (syncedAt: number | null) => Date.now() - (syncedAt ?? 0) > STALE_MS;

const UPLOAD: Record<string, string> = {
  ok: "Файл завантажено.",
  empty: "Файл порожній або не вибраний.",
  too_big: "Файл більший за 2 МБ.",
  too_many_rows: "У файлі понад 5000 рядків.",
  bad_format: "Файл не читається. Потрібен .csv або .xlsx.",
  limit: "Забагато завантажень поспіль. Зачекайте трохи.",
  down: "Не вдалося зберегти файл. Спробуйте пізніше.",
};

const BILLING: Record<string, string> = {
  soon: "Оплата ще не ввімкнена.",
  limit: "Забагато спроб. Зачекайте трохи.",
  down: "Не вдалося відкрити сторінку оплати. Спробуйте пізніше — гроші не списано.",
  cancelled: "Підписку скасовано. Нових списань не буде.",
  cancel_failed: "Не вдалося скасувати підписку. Спробуйте ще раз або напишіть нам — ми скасуємо вручну.",
};

const button =
  "inline-flex w-full items-center justify-center rounded-full bg-cherry-juice px-6 py-3.5 text-base font-semibold text-cream-type shadow-sm transition-colors hover:bg-juice-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cherry-juice sm:w-auto";
const quiet = "rounded-full border border-ink-500/50 px-4 py-2 text-sm text-ink-700 transition-colors hover:border-ink-700 hover:bg-paper-100";
const card = "rounded-2xl border border-paper-200 bg-cream-type p-5 shadow-[0_1px_0_rgba(74,13,20,0.04),0_8px_24px_-16px_rgba(74,13,20,0.25)] sm:p-6";
const th = "border-b border-paper-200 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-ink-500";
const td = "border-b border-paper-100 px-3 py-2 align-top";
const eyebrow = "text-xs font-medium uppercase tracking-widest text-ink-500";

const day = (ms: number) => new Date(ms).toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv" });
const moment = (ms: number) => new Date(ms).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", dateStyle: "short", timeStyle: "short" });
const kyivDay = (ms: number) => new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv" });
const isoDay = (d: string) => d.split("-").reverse().join(".");
const shortDay = (d: string) => isoDay(d).slice(0, 5);
const number = (n: number) => n.toLocaleString("uk-UA", { maximumFractionDigits: 1 });
const percent = (count: number, total: number) => Math.round((count / total) * 100);

/** The last `span` Kyiv days, oldest first, ending today. */
function lastDays(span: number): string[] {
  const now = Date.now();
  return Array.from({ length: span }, (_, i) => kyivDay(now - (span - 1 - i) * 86_400_000));
}

function Plate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={card}>
      <p className="font-display text-lg">{title}</p>
      <div className="mt-2 text-sm leading-relaxed text-ink-700">{children}</div>
    </div>
  );
}

/* ---------- subscription ---------- */

type Tone = "ok" | "wait" | "bad" | "idle";
const TONE: Record<Tone, { pill: string; dot: string }> = {
  ok: { pill: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  wait: { pill: "bg-amber-50 text-amber-900 ring-amber-200", dot: "bg-amber-500" },
  bad: { pill: "bg-red-50 text-cherry-600 ring-red-200", dot: "bg-cherry-juice" },
  idle: { pill: "bg-paper-100 text-ink-700 ring-paper-200", dot: "bg-ink-500" },
};

function Subscribe({ label }: { label: string }) {
  return (
    <form method="post" action="/api/client/subscribe" className="mt-5">
      <button type="submit" className={button}>
        {label}
      </button>
      <ol className="mt-5 grid gap-3 text-sm text-ink-700 sm:grid-cols-3">
        {["Натискаєте кнопку — відкриється захищена сторінка monobank.", "Оплачуєте карткою. Дані картки ми не бачимо й не зберігаємо.", "Результати відкрито. Далі — списання раз на місяць, скасувати можна тут будь-коли."].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-cherry-deep text-xs font-semibold text-cream-type">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-ink-500">
        Натискаючи кнопку, ви приймаєте{" "}
        <Link href="/uk/oferta" prefetch={false} className="underline">
          публічну оферту
        </Link>
        .
      </p>
    </form>
  );
}

function Cancel({ label = "Скасувати підписку" }: { label?: string }) {
  return (
    <form method="post" action="/api/client/cancel" className="mt-4">
      <button type="submit" className={quiet}>
        {label}
      </button>
    </form>
  );
}

function Status({ tone, title, facts, children }: { tone: Tone; title: string; facts?: [string, string][]; children: React.ReactNode }) {
  const cost = price().label;
  return (
    <section aria-label="Підписка" className={card}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <p className={eyebrow}>Підписка</p>
          <p className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${TONE[tone].pill}`}>
            <span aria-hidden="true" className={`size-2 rounded-full ${TONE[tone].dot}`} />
            {title}
          </p>
        </div>
        <p className="text-right">
          <span className="font-display text-2xl sm:text-3xl">{cost}</span>
          <span className="block text-xs text-ink-500">на місяць</span>
        </p>
      </div>
      {facts ? (
        <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-2">
          {facts.map(([name, value]) => (
            <div key={name}>
              <dt className="text-xs text-ink-500">{name}</dt>
              <dd className="font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-4 text-sm leading-relaxed text-ink-700">{children}</div>
    </section>
  );
}

function Subscription({ client, access }: { client: Client; access: Access }) {
  const { billing } = client;
  const cost = price().label;
  const subscribe = `Оформити підписку — ${cost} / міс`;
  const lastPaid: [string, string][] = billing.lastPaidAt ? [["Остання оплата", day(billing.lastPaidAt)]] : [];

  if (access.state === "no_billing") {
    return (
      <Status tone="idle" title="Оплата скоро">
        Онлайн-оплату ще не ввімкнено — поки що результати відкриті без оплати. Коли оплата запрацює, тут з’явиться кнопка
        й ми вас попередимо.
      </Status>
    );
  }
  if (billing.status === "pending") {
    return (
      <Status tone="wait" title="Очікуємо першу оплату">
        Підписку створено, але оплата ще не надійшла. Якщо ви щойно заплатили — оновіть сторінку за хвилину.
        <Subscribe label={`Перейти до оплати — ${cost} / міс`} />
        <Cancel label="Скасувати" />
      </Status>
    );
  }
  if (billing.status === "active") {
    if (access.state === "paid") {
      return (
        <Status tone="ok" title="Підписка активна" facts={[["Наступне списання", day(billing.nextChargeAt ?? access.paidUntil)], ...lastPaid]}>
          Гроші списуються з картки автоматично раз на місяць. Скасувати можна будь-коли — результати залишаться
          відкритими до кінця оплаченого місяця.
          <Cancel />
        </Status>
      );
    }
    return (
      <Status tone="bad" title="Списання не пройшло" facts={access.state === "grace" ? [["Результати відкриті до", day(access.closesAt)], ...lastPaid] : lastPaid}>
        {access.state === "grace"
          ? "Чергова оплата не надійшла. Перевірте картку: monobank спробує списати ще раз, а результати поки залишаються відкритими."
          : "Чергова оплата не надійшла, тому результати закрито. Перевірте картку або скасуйте підписку й оформіть її знову з іншою карткою."}
        <Cancel />
      </Status>
    );
  }
  if (billing.status === "cancelled" && access.state === "paid") {
    return (
      <Status tone="wait" title="Підписку скасовано" facts={[["Результати відкриті до", day(access.paidUntil)]]}>
        Нових списань не буде. Передумали — оформіть підписку знову.
        <Subscribe label={subscribe} />
      </Status>
    );
  }
  return (
    <Status tone="idle" title={billing.lastPaidAt ? "Підписка не діє" : "Підписку не оформлено"} facts={lastPaid.length ? lastPaid : undefined}>
      Щоб бачити результати свого бота, оформіть підписку.
      <Subscribe label={subscribe} />
    </Status>
  );
}

/* ---------- charts: plain markup, no script ---------- */

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-paper-200 bg-cream-type p-4">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

/** Attempts per day: one column per day, empty days included. */
function DayChart({ days, span }: { days: { day: string; count: number }[]; span: string[] }) {
  const counts = new Map(days.map((d) => [d.day, d.count]));
  const top = Math.max(1, ...span.map((d) => counts.get(d) ?? 0));
  const total = span.reduce((sum, d) => sum + (counts.get(d) ?? 0), 0);
  return (
    <figure>
      <figcaption className="flex flex-col gap-x-3 gap-y-1 sm:flex-row sm:items-baseline sm:justify-between">
        <span className="font-semibold">За днями</span>
        <span className="text-xs text-ink-500">
          {span.length} днів · {total} проходжень · максимум {top} за день
        </span>
      </figcaption>
      <div className="mt-3 flex h-32 items-end gap-[2px] border-b border-paper-200 sm:gap-1" role="img" aria-label={`Проходження за днями, останні ${span.length} днів`}>
        {span.map((d) => {
          const count = counts.get(d) ?? 0;
          return (
            <div key={d} title={`${isoDay(d)}: ${count}`} className="group relative flex h-full flex-1 items-end">
              <div className={`w-full rounded-t-sm ${count ? "bg-cherry-juice group-hover:bg-cherry-deep" : "bg-paper-200"}`} style={{ height: count ? `${Math.max(6, (count / top) * 100)}%` : "2px" }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs tabular-nums text-ink-500">
        <span>{shortDay(span[0])}</span>
        <span>{shortDay(span[Math.floor(span.length / 2)])}</span>
        <span>сьогодні</span>
      </div>
    </figure>
  );
}

/** Horizontal bars: a label, its share and its count. */
function Bars({ rows, total, tone = "bg-cherry-juice" }: { rows: { label: string; count: number }[]; total: number; tone?: string }) {
  return (
    <ul className="mt-3 space-y-3">
      {rows.map(({ label, count }) => (
        <li key={label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{label}</span>
            <span className="shrink-0 tabular-nums text-ink-500">
              <strong className="text-ink-900">{percent(count, total)}%</strong> · {count}
            </span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-paper-100">
            <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, percent(count, total))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const byLabel = (rows: { label: string; count: number }[]) => [...rows].sort((x, y) => x.label.localeCompare(y.label, "uk", { numeric: true }));

/* Statistics of the quiz attempts the bot pushed. No person is named here:
   the bot sends none (the intake refuses such fields). */
function AttemptsView({ attempts, updatedAt }: { attempts: Attempt[]; updatedAt: number }) {
  const tests = summarize(attempts);
  const latest = [...attempts].sort((a, b) => b.at - a.at).slice(0, LATEST);
  const span = lastDays(30);
  const week = new Set(span.slice(-7));
  const thisWeek = attempts.filter((a) => week.has(kyivDay(a.at))).length;
  const people = new Set(attempts.map((a) => a.participant).filter(Boolean)).size;
  const allDays = new Map<string, number>();
  for (const a of attempts) allDays.set(kyivDay(a.at), (allDays.get(kyivDay(a.at)) ?? 0) + 1);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Проходжень усього" value={String(attempts.length)} />
        <Tile label="За останні 7 днів" value={String(thisWeek)} />
        <Tile label="Учасників" value={people ? String(people) : "—"} hint={people ? "унікальних людей" : "бот не передає"} />
        <Tile label="Тестів" value={String(tests.length)} />
      </div>
      <p className="mt-3 text-xs text-ink-500">Оновлено {moment(updatedAt)} (Київ). Імен і контактів тут немає: бот передає лише відповіді.</p>

      {tests.length > 1 ? (
        <>
          <div className={`${card} mt-6`}>
            <DayChart days={[...allDays].map(([d, count]) => ({ day: d, count }))} span={span} />
          </div>
          <nav aria-label="Тести" className="mt-6 flex flex-wrap gap-2">
            {tests.map((t, i) => (
              <a key={t.test} href={`#test-${i + 1}`} className="rounded-full border border-paper-200 bg-cream-type px-4 py-2 text-sm hover:border-cherry-juice">
                {t.test} <span className="tabular-nums text-ink-500">· {t.count}</span>
              </a>
            ))}
          </nav>
        </>
      ) : null}

      {tests.map((t, i) => (
        <section key={t.test} id={`test-${i + 1}`} className={`${card} mt-6 scroll-mt-4`}>
          <p className={eyebrow}>Тест {tests.length > 1 ? i + 1 : ""}</p>
          <h3 className="mt-1 font-display text-xl leading-snug">{t.test}</h3>
          <p className="mt-2 text-sm text-ink-700">
            Проходжень: <strong className="tabular-nums text-ink-900">{t.count}</strong>
            {t.people !== null ? ` · унікальних учасників: ${t.people}` : ""} · середній бал:{" "}
            <strong className="tabular-nums text-ink-900">{number(t.average)}</strong>
            {t.max !== null ? ` з ${number(t.max)}` : ""}
          </p>
          {t.max ? (
            <div className="mt-3 h-2.5 max-w-md overflow-hidden rounded-full bg-paper-100" role="img" aria-label={`Середній бал ${number(t.average)} з ${number(t.max)}`}>
              <div className="h-full rounded-full bg-cherry-deep" style={{ width: `${Math.min(100, (t.average / t.max) * 100)}%` }} />
            </div>
          ) : null}

          <div className="mt-6 grid gap-8 md:grid-cols-2">
            {t.ranges.length > 0 ? (
              <div>
                <h4 className="font-semibold">За результатом</h4>
                <Bars rows={byLabel(t.ranges)} total={t.count} />
              </div>
            ) : null}
            <DayChart days={t.days} span={span} />
          </div>

          {t.questions.length > 0 ? (
            <details className="group mt-6 border-t border-paper-200 pt-4" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
                <span>Відповіді на питання ({t.questions.length})</span>
                <span aria-hidden="true" className="text-cherry-juice transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <ol className="mt-2 grid gap-x-10 gap-y-6 md:grid-cols-2">
                {t.questions.map((q, n) => (
                  <li key={n} className="pt-3">
                    <p className="text-sm font-semibold">
                      <span className="text-cherry-juice">{n + 1}.</span> {q.q}
                    </p>
                    <Bars rows={q.answers.map((a) => ({ label: a.a || "—", count: a.count }))} total={q.answers.reduce((sum, a) => sum + a.count, 0)} tone="bg-cherry-700" />
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </section>
      ))}

      <section className={`${card} mt-6`}>
        <h3 className="font-display text-lg">Останні проходження</h3>
        <ul className="mt-3 divide-y divide-paper-100 sm:hidden">
          {latest.map((a) => (
            <li key={a.id} className="py-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold tabular-nums">
                  {number(a.score)}
                  {a.max !== null ? ` / ${number(a.max)}` : ""}
                </span>
                <span className="text-xs tabular-nums text-ink-500">{moment(a.at)}</span>
              </div>
              <p className="mt-1 text-ink-700">{a.test}</p>
              {a.range ? <p className="text-xs text-ink-500">{a.range}</p> : null}
            </li>
          ))}
        </ul>
        <div className="mt-3 hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Коли (Київ)</th>
                <th className={th}>Тест</th>
                <th className={th}>Бал</th>
                <th className={th}>Результат</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((a) => (
                <tr key={a.id}>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{moment(a.at)}</td>
                  <td className={td}>{a.test}</td>
                  <td className={`${td} whitespace-nowrap font-semibold tabular-nums`}>
                    {number(a.score)}
                    {a.max !== null ? ` / ${number(a.max)}` : ""}
                  </td>
                  <td className={td}>{a.range ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {attempts.length > latest.length ? (
          <p className="mt-3 text-xs text-ink-500">
            Показано останні {latest.length} з {attempts.length}.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function ResultsView({ results }: { results: Results }) {
  const split = splitByDay(results);
  const shown = results.rows.slice(0, SHOWN_ROWS);
  return (
    <div className={card}>
      <p className="text-sm text-ink-700">
        Рядків: <strong className="tabular-nums text-ink-900">{results.rows.length}</strong> · оновлено {moment(results.updatedAt)} (Київ)
      </p>
      {split ? (
        <div className="mt-4 max-w-sm">
          <h3 className="font-semibold">За днями («{split.column}»)</h3>
          <table className="mt-1 w-full text-sm">
            <tbody>
              {split.days.slice(0, 60).map(({ day: d, count }) => (
                <tr key={d}>
                  <td className={td}>{isoDay(d)}</td>
                  <td className={`${td} text-right tabular-nums`}>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {results.columns.map((column, i) => (
                <th key={i} className={th}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, r) => (
              <tr key={r}>
                {row.map((value, i) => (
                  <td key={i} className={td}>
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {results.rows.length > shown.length ? (
        <p className="mt-2 text-xs text-ink-500">
          Показано перші {shown.length} з {results.rows.length} рядків.
        </p>
      ) : null}
    </div>
  );
}

/** Nothing has arrived yet: say what will, and show its outline. */
function Empty() {
  const ghost = [28, 44, 36, 62, 50, 78, 58, 88, 70, 96, 74, 84];
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="grid items-center gap-8 md:grid-cols-2">
        <div>
          <CherryIcon className="size-12 text-cherry-juice" />
          <p className="mt-3 font-display text-xl leading-snug">Результатів поки немає — бот чекає на перших учасників</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            Щойно хтось пройде тест у вашому боті, результат з’явиться тут сам — нічого вмикати не треба. Ви побачите:
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {["скільки людей пройшли тест — по днях", "як розподілилися результати за діапазонами", "що відповідали на кожне питання"].map((line) => (
              <li key={line} className="flex gap-3">
                <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-cherry-juice" />
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-500">Імена й контакти учасників сюди не потрапляють — лише відповіді.</p>
        </div>
        <div aria-hidden="true" className="rounded-xl border border-dashed border-paper-200 bg-paper-50 p-5">
          <div className="flex h-28 items-end gap-1.5">
            {ghost.map((h, i) => (
              <div key={i} className="flex-1 rounded-t-sm bg-paper-200" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {[82, 56, 34].map((w) => (
              <div key={w} className="h-2.5 rounded-full bg-paper-100">
                <div className="h-full rounded-full bg-paper-200" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function ClientCabinet({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ u?: string; b?: string; paid?: string }> }) {
  const { id } = await params;
  if (!isClientId(id)) redirect("/");
  const { u, b, paid } = await searchParams;
  const jar = await cookies();
  let client: Client | null = null;
  try {
    client = await signedInClient(jar.get(CLIENT_COOKIE)?.value, id);
  } catch {
    redirect(`/client/${id}/login?e=down`);
  }
  if (!client) redirect(`/client/${id}/login`);

  // Back from monobank, still waiting, or not looked at for a while: ask monobank.
  const { billing } = client;
  if ((await monoToken(client.test)) && billing.subscriptionId && (paid || billing.status === "pending" || stale(billing.syncedAt))) {
    try {
      client = (await syncBilling(client)) ?? client;
    } catch {
      // The stored state stands; the webhook or the next visit will catch up.
    }
  }

  const access = await accessOf(client);
  let results: Results | null = null;
  let attempts: Awaited<ReturnType<typeof readAttempts>> = null;
  let down = false;
  if (access.open) {
    try {
      [results, attempts] = await Promise.all([readResults(client.id), readAttempts(client.id)]);
    } catch {
      down = true;
    }
  }

  const note = (b && BILLING[b]) || (u && UPLOAD[u]) || undefined;
  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <p className={eyebrow}>Ваш бот</p>
          <h1 className="mt-1 font-display text-2xl leading-tight sm:text-4xl">{client.name}</h1>
        </div>
        <form method="post" action="/api/client/logout">
          <input type="hidden" name="id" value={client.id} />
          <button type="submit" className={quiet}>
            Вийти
          </button>
        </form>
      </header>
      {client.test ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-900 ring-1 ring-amber-200">
          <span aria-hidden="true" className="size-2 rounded-full bg-amber-500" />
          Демо · тестовий кабінет: дані вигадані, оплата тестова
        </p>
      ) : null}
      {note ? (
        <p role="status" className="mt-4 rounded-xl border border-paper-200 bg-paper-100 px-4 py-3 text-sm font-medium">
          {note}
        </p>
      ) : null}

      <div className="mt-6">
        <Subscription client={client} access={access} />
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl sm:text-2xl">Результати бота</h2>
        <div className="mt-4">
          {!access.open ? (
            <Plate title="Результати закрито">
              Вони збережені, бот і далі їх збирає. Усе відкриється одразу після оплати підписки — кнопка вище.
            </Plate>
          ) : down ? (
            <Plate title="Дані тимчасово недоступні">Сховище не відповіло. Спробуйте оновити сторінку пізніше.</Plate>
          ) : !results && !attempts ? (
            <Empty />
          ) : (
            <>
              {attempts ? <AttemptsView attempts={attempts.attempts} updatedAt={attempts.updatedAt} /> : null}
              {results ? (
                <div className={attempts ? "mt-10" : undefined}>
                  {attempts ? <h3 className="mb-3 font-display text-lg">Завантажена таблиця</h3> : null}
                  <ResultsView results={results} />
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      <details className="mt-10 rounded-2xl border border-paper-200 px-5 py-4">
        <summary className="cursor-pointer font-semibold">Завантажити результати файлом</summary>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-700">
          Зазвичай це не потрібно: бот надсилає результати сам. Файл — .csv або .xlsx, до 2 МБ і 5000 рядків; перший
          рядок — назви колонок. Файл із колонками test, score, finished_at (за бажанням max_score, range_label, а далі —
          по колонці на питання) додається до статистики проходжень. Будь-яка інша таблиця показується як є і замінює
          попередню.
        </p>
        <form method="post" action="/api/client/upload" encType="multipart/form-data" className="mt-3 flex flex-wrap items-center gap-3">
          <input type="file" name="file" accept=".csv,.xlsx" required className="max-w-full text-sm" />
          <button type="submit" className={quiet}>
            Завантажити
          </button>
        </form>
      </details>

      <p className="mt-8 text-sm text-ink-700">
        Питання щодо бота чи оплати — <a href={site.phone.tel} className="underline">{site.phone.display}</a>.
      </p>
    </div>
  );
}
