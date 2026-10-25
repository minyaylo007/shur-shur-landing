import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSignedIn, SESSION_COOKIE } from "@/lib/cabinet/auth";
import { metaStatus, type MetaStatus } from "@/lib/cabinet/meta";
import { hasRealAds, snapshotSchema, type Snapshot } from "@/lib/cabinet/snapshot";
import { cabinetStore, SNAPSHOT_KEY } from "@/lib/cabinet/store";
import { MetaFields } from "./meta-fields";
import { MetaGuide } from "./meta-guide";
import { META_MESSAGES } from "./meta-messages";

/* The cabinet itself. No session → the login page. Numbers come from the
   last snapshot only; an empty or fixture snapshot shows an honest plate,
   never a row of zeros. */

async function loadSnapshot(): Promise<Snapshot | null> {
  const stored = await cabinetStore().read(SNAPSHOT_KEY);
  if (!stored) return null;
  const parsed = snapshotSchema.safeParse(JSON.parse(stored.text));
  return parsed.success ? parsed.data : null;
}

const int = new Intl.NumberFormat("ru-RU");
const dec = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("ru-RU", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 2 });

function money(value: number | null, currency: string | null): string {
  if (value === null) return "—";
  return currency ? `${dec.format(value)} ${currency}` : dec.format(value);
}
const maybe = (value: number | null) => (value === null ? "нет данных" : int.format(value));

interface Totals {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
}
const ratios = (t: Totals) => ({
  ctr: t.impressions > 0 ? t.clicks / t.impressions : null,
  cpc: t.clicks > 0 ? t.spend / t.clicks : null,
});

function sum<K extends string>(rows: Snapshot["ads"]["days"], key: (r: Snapshot["ads"]["days"][number]) => K) {
  const out = new Map<K, Totals>();
  for (const r of rows) {
    const t = out.get(key(r)) ?? { spend: 0, impressions: 0, clicks: 0, leads: 0 };
    t.spend += r.spend;
    t.impressions += r.impressions;
    t.clicks += r.clicks;
    t.leads += r.leads;
    out.set(key(r), t);
  }
  return out;
}

function Plate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-paper-200 bg-paper-100 p-4">
      <p className="font-medium">{title}</p>
      <div className="mt-1 text-sm text-ink-700">{children}</div>
    </div>
  );
}

const th = "border-b border-paper-200 px-2 py-1 text-left font-medium text-ink-700";
const td = "border-b border-paper-100 px-2 py-1 tabular-nums";

function AdsTable({ title, rows, currency }: { title: string; rows: [string, Totals][]; currency: string | null }) {
  return (
    <div className="mt-6 overflow-x-auto">
      <h3 className="font-medium">{title}</h3>
      <table className="mt-2 w-full min-w-[640px] text-sm">
        <thead>
          <tr>
            <th className={th}></th>
            <th className={th}>Расход</th>
            <th className={th}>Показы</th>
            <th className={th}>Клики</th>
            <th className={th}>CTR</th>
            <th className={th}>CPC</th>
            <th className={th}>Заявки</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, t]) => {
            const r = ratios(t);
            return (
              <tr key={label}>
                <td className={td}>{label}</td>
                <td className={td}>{money(t.spend, currency)}</td>
                <td className={td}>{int.format(t.impressions)}</td>
                <td className={td}>{int.format(t.clicks)}</td>
                <td className={td}>{r.ctr === null ? "—" : pct.format(r.ctr)}</td>
                <td className={td}>{money(r.cpc, currency)}</td>
                <td className={td}>{int.format(t.leads)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* A deliberately small markdown: headings, list items, paragraphs, **bold**.
   Rendered as React text — no HTML from the snapshot reaches the page. */
function Markdown({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
    );
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;
        const heading = /^#{1,6}\s+(.*)$/.exec(lines[0]);
        if (heading && lines.length === 1) {
          return (
            <h3 key={i} className="font-medium">
              {inline(heading[1])}
            </h3>
          );
        }
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                {inline(l.replace(/^#{1,6}\s+/, ""))}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

const kyiv = (ms: number) => new Date(ms).toLocaleString("ru-RU", { timeZone: "Europe/Kyiv" });

export default async function Cabinet({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const jar = await cookies();
  let signedIn = false;
  try {
    signedIn = await isSignedIn(jar.get(SESSION_COOKIE)?.value);
  } catch {
    redirect("/cabinet/login?e=down");
  }
  if (!signedIn) redirect("/cabinet/login");

  let snapshot: Snapshot | null = null;
  let down = false;
  try {
    snapshot = await loadSnapshot();
  } catch {
    down = true;
  }

  let meta: MetaStatus | null = null;
  try {
    meta = await metaStatus();
  } catch {
    meta = null;
  }
  const metaMessage = m && m !== "saved" ? META_MESSAGES[m] : undefined;

  const realAds = hasRealAds(snapshot);
  const days = realAds ? snapshot!.ads.days : [];
  const currency = snapshot?.currency ?? null;
  const byCampaign = [...sum(days, (r) => r.campaign)].sort((a, b) => b[1].spend - a[1].spend);
  const byDay = [...sum(days, (r) => r.date)].sort((a, b) => b[0].localeCompare(a[0]));
  const total = sum(days, () => "Всего").get("Всего");
  const siteDays = snapshot ? [...snapshot.site.days].sort((a, b) => b.date.localeCompare(a.date)) : [];
  const updated = snapshot ? new Date(snapshot.generated_at).toLocaleString("ru-RU", { timeZone: "Europe/Kyiv" }) : null;

  return (
    <div>
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-2xl">Кабинет SHUR-SHUR</h1>
        <form method="post" action="/api/cabinet/logout">
          <button type="submit" className="text-sm underline">
            Выйти
          </button>
        </form>
      </header>
      {updated ? <p className="mt-1 text-sm text-ink-500">Данные обновлены: {updated} (Киев)</p> : null}

      {down ? (
        <div className="mt-6">
          <Plate title="Данные временно недоступны">Хранилище не ответило. Попробуйте обновить страницу позже.</Plate>
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="font-display text-xl">Выводы</h2>
        <div className="mt-3">
          {snapshot?.insights ? (
            <div className="rounded border border-paper-200 bg-white p-4">
              <p className="text-sm text-ink-500">от {snapshot.insights.date}</p>
              <div className="mt-2">
                <Markdown text={snapshot.insights.markdown} />
              </div>
            </div>
          ) : (
            <Plate title="Выводов пока нет">Они появятся здесь вместе с первыми настоящими данными.</Plate>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl">Реклама</h2>
        <div className="mt-3">
          {realAds && total ? (
            <>
              <AdsTable title="Итого за период" rows={[["Всего", total]]} currency={currency} />
              <AdsTable title="По кампаниям" rows={byCampaign} currency={currency} />
              <AdsTable title="По дням" rows={byDay} currency={currency} />
              <p className="mt-2 text-xs text-ink-500">
                Заявки — те, что пришли на сайт по ссылке этой кампании. Расход — в валюте рекламного кабинета.
              </p>
            </>
          ) : (
            <Plate title="Реклама ещё не подключена">
              {snapshot?.test_data
                ? "Пока приходят только тестовые данные — их здесь не показываем. Цифры появятся после подключения рекламного кабинета."
                : "Цифры появятся здесь после подключения рекламного кабинета."}
            </Plate>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl">Сайт</h2>
        <div className="mt-3">
          {siteDays.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr>
                    <th className={th}>День</th>
                    <th className={th}>Посещения</th>
                    <th className={th}>Дошли до формы</th>
                    <th className={th}>Заявки</th>
                  </tr>
                </thead>
                <tbody>
                  {siteDays.map((d) => (
                    <tr key={d.date}>
                      <td className={td}>{d.date}</td>
                      <td className={td}>{maybe(d.visits)}</td>
                      <td className={td}>{maybe(d.form_reached)}</td>
                      <td className={td}>{int.format(d.leads)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-ink-500">Только счётчики — никаких данных о людях.</p>
            </div>
          ) : (
            <Plate title="Данных по сайту пока нет">Счётчики появятся после первого ежедневного отчёта.</Plate>
          )}
        </div>
      </section>

      <section className="mt-10 max-w-xl">
        <h2 className="font-display text-xl">Подключение Meta</h2>
        {m === "saved" && meta?.accountName ? (
          <p role="status" className="mt-2 font-medium">
            Подключено: {meta.accountName}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-ink-700">
          {meta?.pendingSince
            ? `Ключ проверен и передан ${kyiv(meta.pendingSince)} (Киев)${meta.accountName ? ` — аккаунт «${meta.accountName}»` : ""}; сервер рекламы заберёт его при ближайшем обновлении.`
            : meta?.takenAt
              ? `Ключ перенесён на сервер рекламы ${kyiv(meta.takenAt)} (Киев)${meta.accountName ? ` — аккаунт «${meta.accountName}»` : ""}; здесь его копии нет.`
              : "Ключ ещё не передан. Пройдите шаги по порядку — это займёт минут 15."}
        </p>
        {metaMessage ? (
          <p role="alert" className="mt-2 text-sm text-cherry-600">
            {metaMessage}
          </p>
        ) : null}
        <form method="post" action="/api/cabinet/meta" className="mt-4 space-y-4">
          {meta?.pendingSince || meta?.takenAt ? null : <MetaGuide />}
          <MetaFields required />
          <button type="submit" className="w-full rounded bg-cherry-deep px-4 py-2 text-cream-type">
            Проверить и сохранить
          </button>
        </form>
        <p className="mt-4 text-sm text-ink-700">Если застряли — напишите Игорю.</p>
      </section>
    </div>
  );
}
