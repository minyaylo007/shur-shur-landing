# monobank: подписка через сохранённую карту — выжимка

Источник: документация эквайринга monobank (monobank.ua/api-docs/acquiring), разделы
«Інвойси» и «Токенізація карток». Код: `src/lib/billing/mono.ts`; кнопки —
`src/app/api/client/{subscribe,cancel}`; вебхук — `src/app/api/billing/mono/route.ts`;
ежедневное списание — `src/app/api/billing/charge/route.ts` + `vercel.json` (cron).

**Почему не API подписок.** 25.11.2026 боевой токен ФОП Саши на `subscription/create`
получил 400, errCode 1001 «h2h not allowed». monobank включил этому мерчанту сохранение
карты (`saveCardData`) и оплату по токену карты, а не регулярные платежи. Код подписок
удалён; схема ниже.

## Схема

1. «Оформити підписку» → `POST /api/merchant/invoice/create`: 15 € (`amount` 1500,
   `ccy` 978; при `MONO_PRICE_UAH` — гривна, 980), `saveCardData: {saveCard: true,
   walletId: <id клиента>}`, `validity` 24 ч, `redirectUrl` `/client/<id>?paid=1`,
   `webHookUrl` `/api/billing/mono?c=<id>`. Клиент оплачивает на странице monobank.
2. Оплачено → `GET /api/merchant/invoice/status` даёт `status: success` и
   `walletData.cardToken` (при `walletData.status: created`). Месяц открыт от
   `modifiedDate`; токен карты хранится в записи клиента зашифрованным (AES-256-GCM, ключ из
   `CABINET_HMAC_SECRET`, метка `shur-card-token-v1`). Номера карты у нас нет.
3. Каждый день в 07:00 UTC Vercel cron зовёт `GET /api/billing/charge` с
   `Authorization: Bearer $CRON_SECRET`. Клиентам с `active`, у кого оплаченный месяц
   кончился и есть карта, — `POST /api/merchant/wallet/payment` `{cardToken, amount, ccy,
   initiationKind: "merchant", reference: <id>-<дата периода>}`.
4. «Скасувати» — только у нас: `status: cancelled`, списаний больше нет, оплаченный месяц
   открыт. В monobank ничего не отменяется (подписки там нет). До первой оплаты — ещё и
   `invoice/remove`, чтобы страница оплаты погасла. Повторное «Оформити» внутри
   оплаченного месяца — снова `active` без оплаты сейчас.

## Одно списание за период

Идемпотентного ключа у `wallet/payment` нет. Поэтому перед вызовом в запись клиента
(условной записью по etag) ставится `charge: {period, status: "started"}`; второй прогон
или параллельный вызов видит тот же период и не идёт в банк. Исход пишется туда же:
`success` (месяц продлён от даты периода), `processing` (дочитывается вебхуком или
следующим прогоном), `failure` / `error` с пометкой: `3ds` (банк просит 3-D Secure —
без клиента не завершить), `refused <код>`, `no_answer` (500 / нет ответа — проверить
выписку руками). Неудача в том же периоде НЕ повторяется.

## Доступ

| что видит клиент | условие |
|---|---|
| результаты открыты, «Підписка активна» | месяц от последней оплаты не истёк |
| открыты ещё 3 дня («Списання не пройшло» + кнопка оплатить карткою) | месяц истёк, `active`, списание не прошло |
| закрыты | 3 дня прошли; отменена и месяц кончился; оплат не было |
| открыты, «Оплата скоро» | токена нет — оплата выключена |

Оплатить заново в льготные дни — новый счёт той же кнопкой; карта, если новая,
сохраняется вместо старой.

## h2h: monobank не разрешил списание по карте

Если `wallet/payment` ответит отказом с текстом про h2h, прогон останавливается: одна
строка в журнале `[billing] … h2h …`, метка `cabinet/mono-charge.json`, в кабинете Саши в
блоке «Оплата monobank» строка об этом. Больше никого не списываем и не повторяем.
Снять: Саша сохраняет токен заново (если токен в кабинете), иначе
`node ops/billing/test-cycle.mjs --unblock`.

## Вебхук

- `X-Sign` — base64 ECDSA-подписи (DER) над SHA-256 сырого тела; ключ — `GET
  /api/merchant/pubkey`, кэшируется, при неверной подписи перечитывается (не чаще 30 с).
- Телу не верим: подпись верна → читаем `invoice/status` того счёта, что в записи клиента
  (первый счёт или текущее списание). Чужой `invoiceId` — 200 без действий; повтор того
  же тела — 200 без действий. Вебхук пришёл раньше, чем записан ответ списания, — 503,
  monobank повторит.
- Страховка от потерянного вебхука: кабинет клиента сам спрашивает monobank, пока счёт
  `pending` или списание в обработке, и если состояние старше 6 часов.

## Фискальный чек (Checkbox через monobank)

Источник: архив документации monobank для ИИ (monobank.ua/api-docs/acquiring/dev/ai-tools/docs--ai-skills,
«Завантажити архів»; файлы `SKILL.md` — MerchantPaymInfoItem / BasketOrderItem, `payment.md`,
`fiscal.md`), 27.11.2026.

- `merchantPaymInfo.basketOrder` обязателен, когда у мерчанта включена связка с ПРРО
  (делается в web.monobank.ua); без связки — безвреден. `wallet/payment` принимает тот же
  `MerchantPaymInfoItem`, что и `invoice/create`.
- `BasketOrderItem`: обязательные `name` (string), `qty` (number), `sum` (integer — цена
  ЗА ЕДИНИЦУ в минорных единицах), `code` (string, код товара — для фискализации).
  Необязательные: `unit`, `total`, `tax` ([]integer — ставки из кабинета Checkbox), `uktzed`,
  `barcode`, `header`, `footer`, `icon`, `discounts`.
- Шлём в обоих вызовах одну строку: `{name: "Підписка SHUR-SHUR, 1 місяць", qty: 1, sum: amount,
  code: "shur-sub-1m"}` (`paymInfo()` в `mono.ts`). `code` не менять: это товар в Checkbox.
  `tax` не шлём (необязательное поле); если Checkbox Саши потребует ставку — её номер из кабинета Checkbox.
- После успешной оплаты (вебхук, кабинет или ежедневное списание) — один `GET
  /api/merchant/invoice/fiscal-checks?invoiceId=`: `checks[]` с `status` new / process / done /
  failed, `type` sale / return, `fiscalizationSource` checkbox / monopay, `taxUrl`. В запись
  клиента идёт `billing.receipts[]`: статус и `taxUrl` (только https, только у done). Пустой
  список (нет связки) — `none`, оплата как раньше. Чек ещё в пути — кабинет перечитывает
  последний не чаще раза в час, 3 дня. `failed` — одна строка `[billing] fiscal check failed:
  source=…` без данных клиента; оплате это не мешает. Ошибка чтения — тоже не ошибка оплаты.
- В кабинете клиента под блоком подписки: «Оплата дд.мм.рррр · Чек» (ссылка на налоговую) для
  трёх последних оплат с готовым чеком.

⚠ **Евро.** Ни архив, ни страницы monobank не говорят, пробивает ли Checkbox чек по оплате в
евро (`ccy` 978); в примерах только 980. Не проверено. Валюту сами не переключаем; если после
включения связки чеки будут `failed` или не появятся — вариант `MONO_PRICE_UAH` (оплата в гривне).

## Ключи

- `MONO_TOKEN` (env) или токен, сохранённый Сашей в `/cabinet` (env главнее).
- `MONO_TEST_TOKEN` — тестовая среда, только для клиентов с пометкой «тестовый».
- `CRON_SECRET` — Actions → **Billing setup** создаёт его сам, если в Vercel нет.
- Токен, токен карты и `CRON_SECRET` не попадают ни в журнал, ни в ответы, ни в страницы
  (это проверяет `tests/client-billing.test.ts`).

## Проверки

```
node ops/billing/test-cycle.mjs --probe              # боевой токен: счёт как от кнопки, ссылка и сумма. НЕ ПЛАТИТЬ
node ops/billing/test-cycle.mjs --remove <invoiceId> # погасить этот счёт
node ops/billing/test-cycle.mjs --id <id> [--check|--charge]  # тестовая среда (нужен MONO_TEST_TOKEN)
node ops/billing/test-cycle.mjs --unblock            # снять остановку после h2h
```

Скрипт подписанно (`CABINET_HMAC_SECRET`) просит сайт, сам в monobank не ходит.

⚠ Не проверено вживую: `wallet/payment` настоящей картой (первое настоящее списание —
только по слову владельца), ответ на него этого мерчанта (может оказаться тот же h2h).

## Выключить

Саша — «Вимкнути оплату» в `/cabinet`; env — `vercel env rm MONO_TOKEN production` и
выкат. Сохранённые карты остаются зашифрованными в записях, но без токена мерчанта
списаний нет.
