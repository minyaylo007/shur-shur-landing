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

const h2 = "mt-8 font-display text-xl font-bold text-cherry-900";
const p = "mt-3 leading-relaxed text-ink-700";

export default async function OfertaPage({ params }: PageParams) {
  const { locale } = await params;
  if (locale !== "uk") notFound();
  const cost = price().label;
  const offer = await seller();
  const party = offer?.name ? [offer.name, offer.code ? `РНОКПП ${offer.code}` : ""].filter(Boolean).join(", ") : PLACEHOLDER;
  const requisites = offerLine(offer) ?? PLACEHOLDER;

  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-10">
      <Link href="/uk" className="block w-fit text-2xl text-cherry-900 hover:opacity-80">
        <Logo />
      </Link>
      <h1 className="display-type mt-10 text-3xl font-black text-cherry-900 sm:text-4xl">Публічна оферта</h1>
      <p className={p}>
        Договір про надання послуг за підпискою. Цей документ є публічною пропозицією (офертою) у розумінні статей 633 і
        641 Цивільного кодексу України. Оплата підписки означає повне прийняття цих умов.
      </p>

      <h2 className={h2}>1. Сторони</h2>
      <p className={p}>
        Виконавець: {party}, що діє під торговою назвою SHUR-SHUR. Замовник — особа, яка оформила підписку в
        кабінеті клієнта на сайті {site.siteUrl.replace(/^https?:\/\//, "")}.
      </p>

      <h2 className={h2}>2. Послуга</h2>
      <p className={p}>
        Виконавець забезпечує роботу чат-бота Замовника та доступ до особистого кабінету, де показано результати
        роботи цього бота. Послуга надається дистанційно, помісячно, доки діє підписка.
      </p>

      <h2 className={h2}>3. Ціна та оплата</h2>
      <p className={p}>
        Вартість підписки — {cost} за один місяць. Точну суму й валюту списання показано на платіжній сторінці перед
        оплатою. Оплата — банківською карткою через інтернет-еквайринг monobank (АТ «Універсал Банк»). Дані картки
        вводяться на захищеній сторінці банку; Виконавець їх не отримує і не зберігає.
      </p>
      <p className={p}>
        Підписка є регулярним платежем: перше списання відбувається під час оформлення, наступні — автоматично раз на
        місяць, доки підписку не скасовано. Дата наступного списання завжди показана в кабінеті.
      </p>
      <p className={p}>
        Про зміну ціни Виконавець повідомляє Замовника щонайменше за 14 днів до списання за новою ціною. Якщо Замовник
        не згоден, він скасовує підписку до цієї дати.
      </p>

      <h2 className={h2}>4. Скасування підписки</h2>
      <p className={p}>
        Замовник може скасувати підписку будь-коли й без пояснень — кнопкою «Скасувати підписку» у своєму кабінеті або
        зверненням до Виконавця. Після скасування нових списань немає, а доступ до результатів зберігається до кінця
        вже оплаченого місяця.
      </p>

      <h2 className={h2}>5. Якщо списання не пройшло</h2>
      <p className={p}>
        Якщо чергове списання не вдалося (недостатньо коштів, картку заблоковано, строк дії минув), доступ до
        результатів зберігається ще 3 дні після кінця оплаченого місяця. Якщо за цей час оплата не надійшла, доступ
        закривається. Результати при цьому не видаляються і відкриваються знову після оплати.
      </p>

      <h2 className={h2}>6. Повернення коштів</h2>
      <p className={p}>
        Помилкове або повторне списання повертається повністю. Якщо послуга не надавалася з вини Виконавця,
        повертається сума за відповідний період. Щоб отримати повернення, напишіть або зателефонуйте за контактами
        нижче; звернення розглядається до 5 робочих днів. Кошти повертаються на ту саму картку, з якої було оплату;
        строк зарахування залежить від банку. Оплата за місяць, протягом якого послуга надавалася, не повертається,
        якщо інше не передбачено законодавством України про захист прав споживачів.
      </p>

      <h2 className={h2}>7. Персональні дані</h2>
      <p className={p}>
        Результати роботи бота можуть містити персональні дані людей, які з ним спілкувалися. Володільцем цих даних є
        Замовник; Виконавець обробляє їх лише за його дорученням, щоб показати в кабінеті, не передає третім особам і
        не використовує для реклами. Доступ до кабінету має тільки Замовник — за власним паролем.
      </p>

      <h2 className={h2}>8. Контакти та реквізити</h2>
      <p className={p}>
        {requisites}
        <br />
        Телефон:{" "}
        <a href={site.phone.tel} className="underline underline-offset-4">
          <span dir="ltr">{site.phone.display}</span>
        </a>
        <br />
        Сайт: {site.siteUrl.replace(/^https?:\/\//, "")}
      </p>
    </main>
  );
}
