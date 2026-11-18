#!/usr/bin/env node
// Один проход подписки в ТЕСТОВОЙ среде monobank — для клиента с пометкой «тестовый».
//
//   node ops/billing/test-cycle.mjs --id <id клиента>           шаг 1: создать подписку, напечатать ссылку на оплату
//   node ops/billing/test-cycle.mjs --id <id клиента> --check   шаг 2: после оплаты — что ответил monobank и что мы поняли
//
// Скрипт сам в monobank не ходит и токена не читает: он подписанно
// (CABINET_HMAC_SECRET) просит сайт, а сайт работает своим MONO_TEST_TOKEN —
// так проверяется ровно тот код, что стоит за кнопкой в кабинете, вместе с
// вебхуком. Боевой токен недостижим: сайт принимает только тестового клиента.
//
// --check печатает ИМЕНА ключей ответов status и payments (значения — только
// их типы), что из них прочитал наш разбор, сохранённое состояние и итог
// accessOf. Значений из ответа банка в выводе нет.

import { parseArgs } from "node:util";
import { config, postSigned } from "../cabinet/lib.mjs";

const { values } = parseArgs({ options: { id: { type: "string" }, check: { type: "boolean" } } });
if (!values.id) {
  console.error("нужно: --id <id тестового клиента> [--check]");
  process.exit(2);
}

const WHY = {
  no_test_token: "На сайте нет MONO_TEST_TOKEN. Положите тестовый токен (api.monobank.ua) в секреты GitHub, запустите Actions → Billing setup → Deploy и повторите.",
  not_a_test_client: "Этот клиент не помечен как тестовый — проход идёт только на тестовом клиенте.",
  no_client: "Клиента с таким id нет.",
  no_subscription: "У клиента нет подписки: сначала шаг 1 (без --check).",
  already_active: "Подписка уже оплачена: запустите с --check или отмените её в кабинете клиента.",
};

const { secret, site } = config();
const { status, answer } = await postSigned(`${site}/api/cabinet/billing-test`, secret, { action: values.check ? "check" : "start", client_id: values.id });
if (status !== 200 || !answer?.ok) {
  const code = answer?.error ?? "";
  console.error(WHY[code] ?? `сайт отказал: HTTP ${status} ${code}`);
  process.exit(1);
}

if (!values.check) {
  console.log(`Подписка создана: ccy=${answer.ccy}, amount=${answer.amount} (в минимальных единицах).`);
  console.log(`Страница оплаты (тестовая среда, тестовая карта):\n${answer.page_url}`);
  console.log(`После оплаты: node ops/billing/test-cycle.mjs --id ${values.id} --check`);
  process.exit(0);
}

const show = (title, value) => console.log(`${title}:\n${JSON.stringify(value, null, 2)}\n`);
show("Ключи ответа status (значения — типы)", answer.status_keys);
show("Ключи ответа payments (значения — типы)", answer.payments_keys);
show("Что прочитал наш разбор", answer.read);
show("Сохранённое состояние подписки", answer.stored);
show("Итог accessOf", answer.access);
if (answer.read?.not_understood?.length) {
  console.log("ВНИМАНИЕ: часть ответа не понята — см. not_understood; разбор в src/lib/billing/mono.ts нужно поправить.");
  process.exit(3);
}
console.log(answer.access?.open && answer.access?.state === "paid" ? "Итог: оплата прочитана, кабинет открыт." : "Итог: оплата НЕ прочитана как успешная — кабинет закрыт. Если оплата прошла, пришлите этот вывод.");
