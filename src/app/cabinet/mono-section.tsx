import type { MonoStatus, Offer } from "@/lib/billing/settings";

/* «Оплата monobank»: she pastes the acquiring token, the site checks it with
   monobank and switches the 15 € subscription on. The token never comes back
   to the page — only its last four characters. Below: the seller's details
   that the public offer (/uk/oferta) shows instead of its placeholder. */

const MESSAGES: Record<string, string> = {
  saved: "Токен принят monobank и сохранён.",
  off: "Оплата выключена, сохранённый токен стёрт.",
  token_format: "Это не похоже на токен monobank. Скопируйте его целиком из кабинета web.monobank.ua → «Інтернет-еквайринг».",
  refused: "monobank не принял этот токен — ничего не сохранено, оплата не включена. Проверьте, что это токен эквайринга (не личный), скопированный целиком.",
  bank_down: "monobank сейчас не ответил — ничего не сохранено. Попробуйте через пару минут.",
  down: "Хранилище не ответило — ничего не изменилось. Попробуйте позже.",
  bad: "Запрос не разобран. Обновите страницу и попробуйте ещё раз.",
  offer_saved: "Реквизиты сохранены — они уже на странице оферты.",
  offer_format: "Реквизиты не сохранены: РНОКПП — 8–10 цифр, ПІБ до 160 символов, адрес до 300.",
};

const input = "mt-1 block w-full rounded border border-ink-500 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-500";
const primary =
  "w-full rounded bg-cherry-deep px-4 py-3 font-semibold text-cream-type shadow-sm hover:bg-cherry-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cherry-deep";
const secondary = "rounded border border-ink-500 px-3 py-2 text-sm hover:bg-paper-100";

export function MonoSection({ status, offer, b }: { status: MonoStatus | null; offer: Offer | null; b: string | undefined }) {
  const message = b ? MESSAGES[b] : undefined;
  const on = status?.source != null;
  return (
    <section id="mono" className="mt-10 max-w-xl">
      <h2 className="font-display text-xl">Оплата monobank</h2>
      {status === null ? (
        <p className="mt-2 text-sm text-cherry-600">Состояние оплаты сейчас не читается. Обновите страницу позже.</p>
      ) : on ? (
        <p role="status" className="mt-2 font-medium">
          Оплата включена
          {status.merchant ? ` — ${status.merchant}` : ""}
          {status.last4 ? <span className="font-normal text-ink-700"> (токен …{status.last4})</span> : null}
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink-700">
          Оплата ещё не включена: клиенты видят «Оплата скоро». Вставьте токен интернет-эквайринга из кабинета web.monobank.ua — и подписка заработает.
        </p>
      )}
      {status?.blockedAt ? (
        <p role="alert" className="mt-2 text-sm text-cherry-600">
          Ежемесячные списания остановлены: monobank {new Date(status.blockedAt).toLocaleDateString("ru-RU", { timeZone: "Europe/Kyiv" })} отказал в списании по сохранённой карте (h2h — не включено для этого ФОП). Попросите
          monobank включить оплату по токену карты (wallet/payment), затем{" "}
          {status.source === "env" ? "напишите Игорю — он запустит списания снова." : "сохраните токен заново — списания пойдут со следующего дня."}
        </p>
      ) : null}
      {message ? (
        <p role={b === "saved" || b === "off" || b === "offer_saved" ? "status" : "alert"} className={`mt-2 text-sm ${b === "saved" || b === "off" || b === "offer_saved" ? "" : "text-cherry-600"}`}>
          {message}
        </p>
      ) : null}

      {status?.source === "env" ? (
        <p className="mt-4 text-sm text-ink-700">Токен задан в настройках сервера — он главнее этой формы. Чтобы сменить его, напишите Игорю.</p>
      ) : (
        <form method="post" action="/api/cabinet/mono" className="mt-4 space-y-4">
          <input type="hidden" name="action" value="save" />
          <label className="block text-sm font-medium">
            Токен
            <input name="token" type="password" required autoComplete="off" spellCheck={false} className={input} placeholder={status?.last4 ? `сохранён …${status.last4}` : "вставьте токен monobank"} />
          </label>
          <button type="submit" className={primary}>
            Перевірити і зберегти
          </button>
        </form>
      )}
      {status?.source === "cabinet" ? (
        <form method="post" action="/api/cabinet/mono" className="mt-3">
          <input type="hidden" name="action" value="off" />
          <button type="submit" className={secondary}>
            Вимкнути оплату
          </button>
        </form>
      ) : null}

      <form method="post" action="/api/cabinet/mono" className="mt-8 space-y-3">
        <input type="hidden" name="action" value="offer" />
        <p className="text-sm font-medium">Реквизиты для оферты</p>
        <p className="text-sm text-ink-700">Показываются клиентам на странице публичной оферты. Пусто — там остаётся «[реквізити ФОП]».</p>
        <label className="block text-sm">
          ПІБ ФОП
          <input name="name" maxLength={160} defaultValue={offer?.name ?? ""} className={input} placeholder="ФОП Іваненко Олександра Петрівна" />
        </label>
        <label className="block text-sm">
          РНОКПП
          <input name="code" inputMode="numeric" maxLength={10} defaultValue={offer?.code ?? ""} className={input} />
        </label>
        <label className="block text-sm">
          Адреса / контакт
          <input name="contact" maxLength={300} defaultValue={offer?.contact ?? ""} className={input} placeholder="м. Київ, вул. …, e-mail" />
        </label>
        <button type="submit" className={secondary}>
          Зберегти реквізити
        </button>
      </form>
    </section>
  );
}
