import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { price } from "@/lib/billing/mono";
import { offerLine, readOffer, type Offer } from "@/lib/billing/settings";
import { site } from "@/lib/site";
import { Logo } from "@/components/ui/Logo";

/**
 * The public offer for the bot subscription — the terms a client accepts by
 * paying, and the page monobank acquiring expects a merchant to publish:
 * price, period, cancellation, refunds, contacts. Ukrainian only: the
 * subscription is sold in Ukraine and charged through a Ukrainian bank.
 *
 * «[реквізити ФОП]» is a placeholder ON PURPOSE: the seller's legal details
 * are not invented here. Sasha fills them in her cabinet («Оплата monobank»),
 * the page reads them on each request; empty or unreadable → the placeholder.
 */

type PageParams = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return [{ locale: "uk" }];
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Публічна оферта — підписка на бота SHUR-SHUR",
  description: "Умови підписки на чат-бота SHUR-SHUR: ціна, періодичність списання, скасування, повернення коштів, контакти.",
  alternates: { canonical: "/uk/oferta" },
};

const PLACEHOLDER = "[реквізити ФОП]";

async function seller(): Promise<Offer | null> {
  try {
    return await readOffer();
  } catch {
    return null;
  }
}

const h2 = "mt-10 font-display text-xl font-bold leading-snug text-cherry-deep sm:text-2xl";
const para = "mt-3 text-[17px] leading-relaxed text-ink-900 sm:text-lg";
const list = "mt-3 list-disc space-y-2 ps-5 text-[17px] leading-relaxed text-ink-900 marker:text-cherry-juice sm:text-lg";

/** Seller details, or the placeholder — shown as a quiet tag, not as broken text. */
function Details({ text }: { text: string }) {
  if (text !== PLACEHOLDER) return <>{text}</>;
  return <span className="rounded-md border border-dashed border-ink-500/60 bg-paper-100 px-1.5 py-0.5 text-ink-700">{PLACEHOLDER}</span>;
}

export default async function OfertaPage({ params }: PageParams) {
  const { locale } = await params;
  if (locale !== "uk") notFound();
  const cost = price().label;
  const offer = await seller();
  const party = offer?.name ? [offer.name, offer.code ? `РНОКПП ${offer.code}` : ""].filter(Boolean).join(", ") : PLACEHOLDER;
  const requisites = offerLine(offer) ?? PLACEHOLDER;
  const domain = site.siteUrl.replace(/^https?:\/\//, "");

  /* Its own paper field and ink text: the locale layout's body is the dark
     cherry landing field, and this page used to inherit it — dark cherry
     letters on dark cherry (owner, iPhone, 26.11.2026). Same look as the
     client cabinet the offer is linked from. */
  return (
    <div className="min-h-screen bg-paper-50 text-ink-900">
      <header className="bg-cherry-deep text-cream-type">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/uk" className="text-xl hover:opacity-80" aria-label="SHUR-SHUR — на головну">
            <Logo />
          </Link>
          <span className="text-xs uppercase tracking-widest text-cream-type/70">оферта</span>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <h1 className="font-display text-3xl font-black leading-tight text-cherry-deep sm:text-4xl">Публічна оферта</h1>
        <p className="mt-2 text-base text-ink-700">Підписка на чат-бота SHUR-SHUR</p>
        <p className={para}>
          Це публічна пропозиція (оферта) за статтями 633 і 641 Цивільного кодексу України. Оплата підписки означає
          згоду з цими умовами.
        </p>

        <h2 className={h2}>1. Сторони</h2>
        <p className={para}>
          Виконавець: <Details text={party} />, торгова назва SHUR-SHUR.
        </p>
        <p className={para}>Замовник — особа, яка оформила підписку в кабінеті клієнта на сайті {domain}.</p>

        <h2 className={h2}>2. Послуга</h2>
        <p className={para}>
          Виконавець забезпечує роботу чат-бота Замовника і доступ до особистого кабінету з результатами цього бота.
        </p>
        <p className={para}>Послуга надається дистанційно, помісячно, доки діє підписка.</p>

        <h2 className={h2}>3. Ціна та оплата</h2>
        <p className={para}>
          Вартість — <strong className="font-semibold">{cost} на місяць</strong>. Точну суму й валюту видно на
          платіжній сторінці перед оплатою.
        </p>
        <p className={para}>
          Оплата — карткою через інтернет-еквайринг monobank (АТ «Універсал Банк»). Дані картки вводяться на сторінці
          банку; Виконавець їх не отримує і не зберігає.
        </p>
        <p className={para}>
          Перше списання — під час оформлення, далі — автоматично раз на місяць, доки підписку не скасовано. Дата
          наступного списання завжди є в кабінеті.
        </p>
        <p className={para}>
          Про зміну ціни Виконавець повідомляє щонайменше за 14 днів. Якщо Замовник не згоден, він скасовує підписку до
          цієї дати.
        </p>

        <h2 className={h2}>4. Скасування</h2>
        <p className={para}>
          Скасувати можна будь-коли й без пояснень: кнопкою «Скасувати підписку» в кабінеті або написавши Виконавцю.
        </p>
        <p className={para}>
          Після скасування нових списань немає. Обслуговування триває до кінця вже оплаченого місяця. Результати в
          кабінеті залишаються доступними.
        </p>

        <h2 className={h2}>5. Якщо списання не пройшло</h2>
        <p className={para}>
          Наприклад, на картці бракує коштів або минув строк її дії. Тоді обслуговування триває ще 3 дні після кінця
          оплаченого місяця.
        </p>
        <p className={para}>
          Якщо за цей час оплата не надійшла, обслуговування зупиняється. Результати в кабінеті залишаються доступними й
          не видаляються.
        </p>

        <h2 className={h2}>6. Повернення коштів</h2>
        <ul className={list}>
          <li>Помилкове або повторне списання повертаємо повністю.</li>
          <li>Якщо послуга не надавалася з вини Виконавця — повертаємо суму за цей період.</li>
          <li>
            Місяць, протягом якого послуга надавалася, не повертається, якщо інше не передбачає закон про захист прав
            споживачів.
          </li>
        </ul>
        <p className={para}>
          Щоб повернути кошти, напишіть або зателефонуйте за контактами нижче. Відповідаємо до 5 робочих днів. Гроші
          повертаються на ту саму картку; строк зарахування залежить від банку.
        </p>

        <h2 className={h2}>7. Персональні дані</h2>
        <p className={para}>
          Результати бота можуть містити персональні дані людей, які з ним спілкувалися. Володілець цих даних — Замовник.
        </p>
        <p className={para}>
          Виконавець обробляє їх лише за його дорученням, щоб показати в кабінеті: не передає третім особам і не
          використовує для реклами. Кабінет відкривається тільки за паролем Замовника.
        </p>

        <h2 className={h2}>8. Контакти та реквізити</h2>
        <div className="mt-4 rounded-2xl border border-paper-200 bg-cream-type p-5 text-[17px] leading-relaxed shadow-[0_8px_24px_-16px_rgba(74,13,20,0.25)] sm:text-lg">
          <p>
            <Details text={requisites} />
          </p>
          <p className="mt-3">
            Телефон:{" "}
            <a href={site.phone.tel} className="font-medium text-cherry-700 underline underline-offset-4">
              <span dir="ltr">{site.phone.display}</span>
            </a>
          </p>
          <p className="mt-1">Сайт: {domain}</p>
        </div>
      </main>
    </div>
  );
}
