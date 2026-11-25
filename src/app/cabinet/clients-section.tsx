import { accessOf, monoToken, price, type Access } from "@/lib/billing/mono";

/** What the table needs from monobank's side, read once by the page (async). */
export interface ClientsBilling {
  live: boolean;
  testOn: boolean;
  access: Map<string, Access>;
}

export async function clientsBilling(clients: Client[] | null): Promise<ClientsBilling> {
  const [live, testOn] = await Promise.all([monoToken(false), monoToken(true)]);
  const access = new Map(await Promise.all((clients ?? []).map(async (client) => [client.id, await accessOf(client)] as const)));
  return { live: live !== null, testOn: testOn !== null, access };
}
import type { Client } from "@/lib/client/clients";

/* Clients of the bot subscription: who they are, whether they pay, and the
   things the owner does with them — create, new link, key for the bot,
   upload results, delete. The results themselves are NOT shown here: they open only in the
   client's own cabinet. */

const MESSAGES: Record<string, string> = {
  name: "Введите название клиента (до 80 символов).",
  bad: "Запрос не разобран. Обновите страницу и попробуйте ещё раз.",
  gone: "Такого клиента уже нет.",
  down: "Хранилище не ответило — ничего не изменилось. Попробуйте позже.",
  uploaded: "Файл загружен — клиент увидит таблицу в своём кабинете.",
  deleted: "Клиент удалён вместе с его результатами.",
  no_secret: "Ключ бота не выпущен: на сайте не задан CABINET_HMAC_SECRET.",
  paying: "У клиента действует подписка. Сначала её нужно отменить (кнопка «Скасувати» в его кабинете), потом удалять.",
  file_empty: "Файл пустой или не выбран.",
  file_too_big: "Файл больше 2 МБ.",
  file_too_many_rows: "В файле больше 5000 строк.",
  file_bad_format: "Файл не читается. Нужен .csv или .xlsx.",
};

const input = "mt-1 block w-full rounded border border-ink-500 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-500";
const th = "border-b border-paper-200 px-2 py-1 text-left font-medium text-ink-700";
const td = "border-b border-paper-100 px-2 py-2 align-top";
const small = "rounded border border-ink-500 px-2 py-1 text-sm hover:bg-paper-100";

const day = (ms: number) => new Date(ms).toLocaleDateString("ru-RU", { timeZone: "Europe/Kyiv" });

function payment(client: Client, on: boolean, access: Access): string {
  if (!on) return "оплата не включена";
  const { billing } = client;
  if (billing.status === "pending") return "ждёт первой оплаты";
  if (billing.status === "none") return billing.lastPaidAt ? "подписки нет" : "не оформлял";
  if (billing.status === "cancelled") return access.open && access.state === "paid" ? `отменена, оплачено до ${day(access.paidUntil)}` : "отменена";
  if (access.state === "paid") return `платит, след. списание ${billing.nextChargeAt ? day(billing.nextChargeAt) : day(access.paidUntil)}`;
  if (access.state === "grace") return `списание не прошло, доступ до ${day(access.closesAt)}`;
  return "списание не прошло, доступ закрыт";
}

export function ClientsSection({ clients, c, billing }: { clients: Client[] | null; c: string | undefined; billing: ClientsBilling }) {
  const message = c ? MESSAGES[c] : undefined;
  const { live, testOn, access: accesses } = billing;
  return (
    <section id="clients" className="mt-10">
      <h2 className="font-display text-xl">Клиенты ботов</h2>
      <p className="mt-2 max-w-xl text-sm text-ink-700">
        Подписка {price().label} в месяц через monobank.{" "}
        {live ? "Оплата включена." : "Оплата ещё не включена (нет токена monobank): клиенты видят «Оплата скоро», результаты открыты."}
      </p>
      {message ? (
        <p role="status" className="mt-2 text-sm font-medium">
          {message}
        </p>
      ) : null}

      {clients === null ? (
        <p className="mt-4 text-sm text-cherry-600">Список клиентов временно недоступен.</p>
      ) : clients.length === 0 ? (
        <p className="mt-4 text-sm text-ink-700">Клиентов пока нет.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Клиент</th>
                <th className={th}>Вход</th>
                <th className={th}>Оплата</th>
                <th className={th}>Последняя оплата</th>
                <th className={th}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className={td}>
                    <a href={`/client/${client.id}`} className="font-medium underline">
                      {client.name}
                    </a>
                    {client.test ? <span className="ml-2 rounded bg-paper-200 px-1 text-xs">тест</span> : null}
                    <div className="text-xs text-ink-500">с {day(client.createdAt)}</div>
                  </td>
                  <td className={td}>{client.auth.password ? "пароль задан" : client.auth.setup ? "ждёт ссылку" : "нет пароля"}</td>
                  <td className={td}>{payment(client, client.test ? testOn : live, accesses.get(client.id)!)}</td>
                  <td className={td}>{client.billing.lastPaidAt ? day(client.billing.lastPaidAt) : "—"}</td>
                  <td className={td}>
                    <div className="flex flex-wrap items-center gap-2">
                      <form method="post" action="/api/cabinet/clients">
                        <input type="hidden" name="action" value="link" />
                        <input type="hidden" name="id" value={client.id} />
                        <button type="submit" className={small}>
                          Новая ссылка
                        </button>
                      </form>
                      <form method="post" action="/api/cabinet/clients">
                        <input type="hidden" name="action" value="key" />
                        <input type="hidden" name="id" value={client.id} />
                        <button type="submit" className={small}>
                          {client.ingest ? "Новый ключ бота" : "Ключ бота"}
                        </button>
                      </form>
                      <form method="post" action="/api/cabinet/clients" encType="multipart/form-data" className="flex items-center gap-1">
                        <input type="hidden" name="action" value="upload" />
                        <input type="hidden" name="id" value={client.id} />
                        <input type="file" name="file" accept=".csv,.xlsx" required className="max-w-44 text-xs" />
                        <button type="submit" className={small}>
                          Загрузить
                        </button>
                      </form>
                      <details>
                        <summary className="cursor-pointer text-sm text-cherry-600">Удалить…</summary>
                        <form method="post" action="/api/cabinet/clients" className="mt-1">
                          <input type="hidden" name="action" value="delete" />
                          <input type="hidden" name="id" value={client.id} />
                          <button type="submit" className={small}>
                            Удалить клиента и его результаты
                          </button>
                        </form>
                      </details>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form method="post" action="/api/cabinet/clients" className="mt-6 max-w-xl space-y-3">
        <input type="hidden" name="action" value="create" />
        <label className="block">
          <span className="text-sm text-ink-700">Новый клиент — название</span>
          <input type="text" name="name" required maxLength={80} autoComplete="off" className={input} />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" name="test" />
          Тестовый клиент (оплата только в тестовой среде monobank, настоящие деньги не списываются)
        </label>
        <button type="submit" className="rounded bg-cherry-deep px-4 py-3 font-semibold text-cream-type shadow-sm hover:bg-cherry-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cherry-deep">
          Создать и получить ссылку
        </button>
        <p className="text-sm text-ink-700">
          После создания откроется страница с одноразовой ссылкой — её нужно отправить клиенту. По ней он задаёт свой пароль.
        </p>
      </form>
    </section>
  );
}
