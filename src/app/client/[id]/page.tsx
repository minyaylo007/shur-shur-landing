import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { accessOf, monoToken, price, syncBilling, type Access } from "@/lib/billing/mono";
import { readAttempts, SHOWN_ATTEMPTS, summarize, type Attempt } from "@/lib/client/attempts";
import { CLIENT_COOKIE, isClientId, signedInClient, type Client } from "@/lib/client/clients";
import { readResults, SHOWN_ROWS, splitByDay, type Results } from "@/lib/client/results";
import { site } from "@/lib/site";

/* One client's cabinet: the subscription and the bot's results. Everything
   here is read for the client named by the SESSION — a cookie of another
   client, or none, lands on the login form and reads nothing. */

const STALE_MS = 6 * 60 * 60 * 1000;
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

const button = "rounded bg-cherry-deep px-4 py-3 font-semibold text-cream-type shadow-sm hover:bg-cherry-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cherry-deep";
const quiet = "rounded border border-ink-500 px-3 py-2 text-sm hover:bg-paper-100";
const th = "border-b border-paper-200 px-2 py-1 text-left font-medium text-ink-700";
const td = "border-b border-paper-100 px-2 py-1 align-top";

const day = (ms: number) => new Date(ms).toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv" });
const moment = (ms: number) => new Date(ms).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" });

function Plate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-paper-200 bg-paper-100 p-4">
      <p className="font-medium">{title}</p>
      <div className="mt-1 text-sm text-ink-700">{children}</div>
    </div>
  );
}

function Subscribe({ label }: { label: string }) {
  return (
    <form method="post" action="/api/client/subscribe" className="mt-3">
      <button type="submit" className={button}>
        {label}
      </button>
      <p className="mt-2 text-sm text-ink-700">
        Оплата карткою на захищеній сторінці monobank; дані картки ми не бачимо й не зберігаємо. Списання раз на місяць,
        скасувати можна будь-коли в цьому кабінеті. Натискаючи кнопку, ви приймаєте{" "}
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
    <form method="post" action="/api/client/cancel" className="mt-3">
      <button type="submit" className={quiet}>
        {label}
      </button>
    </form>
  );
}

function Subscription({ client, access }: { client: Client; access: Access }) {
  const { billing } = client;
  const cost = price().label;
  const subscribe = `Оформити підписку — ${cost} / міс`;

  if (access.state === "no_billing") {
    return (
      <Plate title="Оплата скоро">
        Підписка {cost} на місяць. Онлайн-оплату ще не ввімкнено — поки що результати відкриті без оплати. Коли оплата
        запрацює, тут з’явиться кнопка.
      </Plate>
    );
  }
  if (billing.status === "pending") {
    return (
      <Plate title="Очікуємо першу оплату">
        Підписку створено, але оплата ще не надійшла. Якщо ви щойно заплатили — оновіть сторінку за хвилину.
        <Subscribe label={`Перейти до оплати — ${cost} / міс`} />
        <Cancel label="Скасувати" />
      </Plate>
    );
  }
  if (billing.status === "active") {
    if (access.state === "paid") {
      return (
        <Plate title="Підписка активна">
          {cost} на місяць. Наступне списання: {day(billing.nextChargeAt ?? access.paidUntil)}.
          <Cancel />
        </Plate>
      );
    }
    return (
      <Plate title="Списання не пройшло">
        {access.state === "grace"
          ? `Чергова оплата не надійшла. Перевірте картку: результати залишаються відкритими до ${day(access.closesAt)}, monobank спробує списати ще раз.`
          : "Чергова оплата не надійшла, тому результати закрито. Перевірте картку або скасуйте підписку й оформіть її знову з іншою карткою."}
        <Cancel />
      </Plate>
    );
  }
  if (billing.status === "cancelled" && access.state === "paid") {
    return (
      <Plate title="Підписку скасовано">
        Нових списань не буде. Результати відкриті до {day(access.paidUntil)}.
        <Subscribe label={subscribe} />
      </Plate>
    );
  }
  return (
    <Plate title={billing.lastPaidAt ? "Підписка не діє" : "Підписка"}>
      Щоб бачити результати свого бота, оформіть підписку: {cost} на місяць.
      <Subscribe label={subscribe} />
    </Plate>
  );
}

const isoDay = (d: string) => d.split("-").reverse().join(".");
const number = (n: number) => n.toLocaleString("uk-UA", { maximumFractionDigits: 1 });
const share = (count: number, total: number) => `${Math.round((count / total) * 100)}%`;

function Counts({ rows, total }: { rows: { label: string; count: number }[]; total?: number }) {
  return (
    <table className="mt-1 w-full text-sm">
      <tbody>
        {rows.map(({ label, count }) => (
          <tr key={label}>
            <td className={td}>{label}</td>
            <td className={`${td} w-16 text-right tabular-nums`}>{count}</td>
            {total ? <td className={`${td} w-16 text-right tabular-nums text-ink-500`}>{share(count, total)}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* Statistics of the quiz attempts the bot pushed. No person is named here:
   the bot sends none (the intake refuses such fields). */
function AttemptsView({ attempts, updatedAt }: { attempts: Attempt[]; updatedAt: number }) {
  const tests = summarize(attempts);
  const latest = [...attempts].sort((a, b) => b.at - a.at).slice(0, SHOWN_ATTEMPTS);
  return (
    <div>
      <p className="text-sm text-ink-700">
        Проходжень: <strong className="tabular-nums text-ink-900">{attempts.length}</strong> · оновлено {moment(updatedAt)} (Київ)
      </p>
      {tests.map((t) => (
        <section key={t.test} className="mt-6 rounded border border-paper-200 p-4">
          <h3 className="font-display text-lg">{t.test}</h3>
          <p className="mt-1 text-sm text-ink-700">
            Проходжень: <strong className="tabular-nums text-ink-900">{t.count}</strong>
            {t.people !== null ? ` · унікальних учасників: ${t.people}` : ""} · середній бал:{" "}
            <strong className="tabular-nums text-ink-900">{number(t.average)}</strong>
            {t.max !== null ? ` з ${number(t.max)}` : ""}
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {t.ranges.length > 0 ? (
              <div>
                <h4 className="font-medium">За результатом</h4>
                <Counts rows={t.ranges.map((r) => ({ label: r.label, count: r.count }))} total={t.count} />
              </div>
            ) : null}
            <div>
              <h4 className="font-medium">За днями</h4>
              <Counts rows={t.days.slice(0, 31).map((d) => ({ label: isoDay(d.day), count: d.count }))} />
            </div>
          </div>
          {t.questions.length > 0 ? (
            <details className="mt-4">
              <summary className="cursor-pointer font-medium">Відповіді на питання ({t.questions.length})</summary>
              {t.questions.map((q, i) => (
                <div key={i} className="mt-3">
                  <p className="text-sm font-medium">
                    {i + 1}. {q.q}
                  </p>
                  <Counts rows={q.answers.map((a) => ({ label: a.a || "—", count: a.count }))} total={q.answers.reduce((sum, a) => sum + a.count, 0)} />
                </div>
              ))}
            </details>
          ) : null}
        </section>
      ))}
      <h3 className="mt-8 font-medium">Останні проходження</h3>
      <div className="mt-1 overflow-x-auto">
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
                <td className={`${td} whitespace-nowrap`}>{moment(a.at)}</td>
                <td className={td}>{a.test}</td>
                <td className={`${td} whitespace-nowrap tabular-nums`}>
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
        <p className="mt-2 text-sm text-ink-500">
          Показано останні {latest.length} з {attempts.length}.
        </p>
      ) : null}
    </div>
  );
}

function ResultsView({ results }: { results: Results }) {
  const split = splitByDay(results);
  const shown = results.rows.slice(0, SHOWN_ROWS);
  return (
    <div>
      <p className="text-sm text-ink-700">
        Рядків: <strong className="tabular-nums text-ink-900">{results.rows.length}</strong> · оновлено {moment(results.updatedAt)} (Київ)
      </p>
      {split ? (
        <div className="mt-4 max-w-sm">
          <h3 className="font-medium">За днями («{split.column}»)</h3>
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
        <p className="mt-2 text-sm text-ink-500">
          Показано перші {shown.length} з {results.rows.length} рядків.
        </p>
      ) : null}
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
  if (monoToken(client.test) && billing.subscriptionId && (paid || billing.status === "pending" || stale(billing.syncedAt))) {
    try {
      client = (await syncBilling(client)) ?? client;
    } catch {
      // The stored state stands; the webhook or the next visit will catch up.
    }
  }

  const access = accessOf(client);
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
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-2xl">{client.name}</h1>
        <form method="post" action="/api/client/logout">
          <input type="hidden" name="id" value={client.id} />
          <button type="submit" className="text-sm underline">
            Вийти
          </button>
        </form>
      </header>
      <p className="mt-1 text-sm text-ink-500">Кабінет клієнта SHUR-SHUR{client.test ? " · тестовий" : ""}</p>
      {note ? (
        <p role="status" className="mt-4 text-sm font-medium">
          {note}
        </p>
      ) : null}

      <section className="mt-6 max-w-xl">
        <Subscription client={client} access={access} />
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl">Результати бота</h2>
        <div className="mt-3">
          {!access.open ? (
            <Plate title="Результати закрито">Вони збережені й відкриються одразу після оплати підписки.</Plate>
          ) : down ? (
            <Plate title="Дані тимчасово недоступні">Сховище не відповіло. Спробуйте оновити сторінку пізніше.</Plate>
          ) : !results && !attempts ? (
            <Plate title="Результатів поки немає">Вони з’являться тут, щойно бот їх надішле або ви завантажите файл.</Plate>
          ) : (
            <>
              {attempts ? <AttemptsView attempts={attempts.attempts} updatedAt={attempts.updatedAt} /> : null}
              {results ? (
                <div className={attempts ? "mt-10" : undefined}>
                  {attempts ? <h3 className="mb-2 font-medium">Завантажена таблиця</h3> : null}
                  <ResultsView results={results} />
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      <section className="mt-10 max-w-xl">
        <h2 className="font-display text-xl">Завантажити файл</h2>
        <p className="mt-2 text-sm text-ink-700">
          .csv або .xlsx, до 2 МБ і 5000 рядків; перший рядок — назви колонок. Файл із колонками test, score,
          finished_at (за бажанням max_score, range_label, а далі — по колонці на питання) додається до статистики
          проходжень. Будь-яка інша таблиця показується як є і замінює попередню.
        </p>
        <form method="post" action="/api/client/upload" encType="multipart/form-data" className="mt-3 flex flex-wrap items-center gap-3">
          <input type="file" name="file" accept=".csv,.xlsx" required className="text-sm" />
          <button type="submit" className={quiet}>
            Завантажити
          </button>
        </form>
      </section>

      <p className="mt-10 text-sm text-ink-700">
        Питання щодо бота чи оплати — <a href={site.phone.tel} className="underline">{site.phone.display}</a>.
      </p>
    </div>
  );
}
