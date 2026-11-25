#!/usr/bin/env node
// Проверки оплаты подписки на живом сайте — подписанные вызовы /api/cabinet/billing-test.
//
// ТЕСТОВАЯ среда monobank, клиент с пометкой «тестовый» (нужен MONO_TEST_TOKEN на сайте):
//   node ops/billing/test-cycle.mjs --id <id>            шаг 1: счёт с сохранением карты, напечатать ссылку на оплату
//   node ops/billing/test-cycle.mjs --id <id> --check    шаг 2: после оплаты — что ответил monobank и что мы поняли
//   node ops/billing/test-cycle.mjs --id <id> --charge   шаг 3: ежемесячное списание по сохранённой карте — сейчас
//
// БОЕВОЙ токен, без клиента и без денег:
//   node ops/billing/test-cycle.mjs --probe              счёт ровно как от кнопки: ссылка на страницу monobank и сумма
//   node ops/billing/test-cycle.mjs --remove <invoiceId> погасить этот счёт (invoice/remove) — платить его не нужно
//   node ops/billing/test-cycle.mjs --unblock            снять остановку списаний после отказа h2h (когда monobank включил)
//
// Скрипт сам в monobank не ходит и токенов не читает: он подписанно
// (CABINET_HMAC_SECRET) просит сайт — так проверяется ровно тот код, что
// стоит за кнопкой. Значений из ответа банка (кроме ссылки на оплату) в выводе нет.

import { parseArgs } from "node:util";
import { config, postSigned } from "../cabinet/lib.mjs";

const { values } = parseArgs({
  options: { id: { type: "string" }, check: { type: "boolean" }, charge: { type: "boolean" }, probe: { type: "boolean" }, remove: { type: "string" }, unblock: { type: "boolean" } },
});

let body;
if (values.probe) body = { action: "probe" };
else if (values.remove) body = { action: "probe_remove", invoice_id: values.remove };
else if (values.unblock) body = { action: "unblock" };
else if (values.id) body = { action: values.check ? "check" : values.charge ? "charge" : "start", client_id: values.id };
else {
  console.error("нужно: --id <id тестового клиента> [--check|--charge] | --probe | --remove <invoiceId> | --unblock");
  process.exit(2);
}

const WHY = {
  no_test_token: "На сайте нет MONO_TEST_TOKEN. Положите тестовый токен (api.monobank.ua) в секреты GitHub, запустите Actions → Billing setup → Deploy и повторите.",
  no_live_token: "На сайте нет боевого токена monobank.",
  not_a_test_client: "Этот клиент не помечен как тестовый — проход идёт только на тестовом клиенте.",
  no_client: "Клиента с таким id нет.",
  no_invoice: "У клиента нет счёта: сначала шаг 1 (без --check).",
  already_active: "Подписка уже оплачена: запустите с --check / --charge или отмените её в кабинете клиента.",
};

const { secret, site } = config();
const { status, answer } = await postSigned(`${site}/api/cabinet/billing-test`, secret, body);
if (status !== 200 || !answer?.ok) {
  const code = answer?.error ?? "";
  console.error(WHY[code] ?? `сайт отказал: HTTP ${status} ${code}`);
  process.exit(1);
}

const show = (title, value) => console.log(`${title}:\n${JSON.stringify(value, null, 2)}\n`);
switch (body.action) {
  case "probe":
    console.log(`Счёт создан боевым токеном: ccy=${answer.ccy}, amount=${answer.amount} (в минимальных единицах). НЕ ОПЛАЧИВАТЬ.`);
    console.log(`Страница monobank:\n${answer.page_url}`);
    console.log(`Погасить: node ops/billing/test-cycle.mjs --remove ${answer.invoice_id}`);
    break;
  case "probe_remove":
    console.log("Счёт погашен (invoice/remove).");
    break;
  case "unblock":
    console.log("Остановка списаний снята: следующий ежедневный прогон попробует списать снова.");
    break;
  case "start":
    console.log(`Счёт создан: ccy=${answer.ccy}, amount=${answer.amount} (в минимальных единицах).`);
    console.log(`Страница оплаты (тестовая среда, тестовая карта):\n${answer.page_url}`);
    console.log(`После оплаты: node ops/billing/test-cycle.mjs --id ${values.id} --check`);
    break;
  case "charge":
    show("Итог списания", answer.outcome);
    show("Сохранённое состояние", answer.stored);
    show("Итог accessOf", answer.access);
    break;
  default:
    show("Ключи ответа invoice/status (значения — типы)", answer.keys);
    show("Что прочитал наш разбор", answer.read);
    show("Сохранённое состояние", answer.stored);
    show("Итог accessOf", answer.access);
    console.log(
      answer.access?.open && answer.access?.state === "paid"
        ? answer.stored?.card_saved
          ? "Итог: оплата прочитана, карта сохранена, кабинет открыт. Дальше: --charge."
          : "Итог: оплата прочитана, кабинет открыт, но токена карты в ответе нет — ежемесячного списания не будет."
        : "Итог: оплата НЕ прочитана как успешная — кабинет закрыт. Если оплата прошла, пришлите этот вывод.",
    );
}
