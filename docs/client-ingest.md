# Приём результатов бота в кабинет клиента

Бот клиента шлёт каждое законченное прохождение теста на сайт; кабинет клиента
(`/client/<id>`) показывает по ним статистику. Один бот = один клиент.
Код: `src/app/api/client/ingest/route.ts`, `src/lib/client/attempts.ts`.

## Ключ

В `/cabinet` → «Клиенты ботов» → **Ключ бота**. Страница один раз показывает три строки:

```
SHUR_INGEST_URL=https://shur-shur.com/api/client/ingest
SHUR_CLIENT_ID=<12 символов>
SHUR_CLIENT_SECRET=<секрет>
```

Без браузера, с ace-main (те же три строки — сразу в файл с правами 640, в консоль секрет
не печатается; клиента с таким названием нет — будет создан, рядом ляжет `<файл>.setup` со
ссылкой для его пароля):

```
node ops/cabinet/client-key.mjs --name "Марина · тести для підприємців" --out <файл>
```

Секрет — файлом рядом с ботом, читаемым только ботом; в git, чат и логи не кладётся. На сайте он
хранится зашифрованным. «Новый ключ бота» выпускает другой секрет, прежний перестаёт
действовать сразу.

## Запрос

`POST https://shur-shur.com/api/client/ingest`, тело — JSON в UTF-8.

| заголовок | значение |
|---|---|
| `Content-Type` | `application/json` |
| `X-Shur-Client` | `SHUR_CLIENT_ID` |
| `X-Shur-Timestamp` | время отправки, unix-секунды; сайт принимает ±300 с |
| `X-Shur-Signature` | `sha256=` + hex от HMAC-SHA256(секрет, `<timestamp>.<тело>`) |

Подписываются ровно те байты, что уходят телом: сначала сериализовать, потом подписать и
отправить эту же строку.

### Тело: одно прохождение

| поле | тип | |
|---|---|---|
| `attempt_id` | строка ≤ 100 | обязательно; уникален для прохождения, по нему отсекаются повторы |
| `test` | строка ≤ 120 | обязательно; название теста |
| `score` | число | обязательно; набранные баллы |
| `max_score` | число | максимум баллов |
| `range_label` | строка ≤ 300 | текст диапазона, в который попал результат |
| `finished_at` | строка | обязательно; ISO 8601 с часовым поясом |
| `answers` | массив ≤ 100 | `{q: текст вопроса, a: текст ответа, points: баллы}` |
| `participant` | строка | необязательно: непрозрачный хэш, 8–128 символов `A-Z a-z 0-9 _ -` |

Пачка (догрузка истории) — `{"attempts": [ … ]}`, до 500 прохождений и до 2 МБ в запросе.

**Персональные данные не принимаются.** Схема строгая: любое лишнее поле (`name`,
`username`, `tg_id` …) — отказ 400 всему запросу. `participant` нужен только чтобы
считать уникальных людей; это хэш, который бот делает сам и который нельзя обратить, —
например HMAC-SHA256(свой секрет бота, telegram id) в hex. Сам telegram id, username и
имя из бота не выходят.

### Ответы

| код | тело | что делать |
|---|---|---|
| 200 | `{ok: true, stored: N, duplicates: M}` | принято; повтор того же `attempt_id` — не ошибка, он в `duplicates` |
| 400 | `{error: "invalid", where: [пути полей]}` | исправить формат; повторять без толку |
| 401 | `{error: "bad_signature"}` | неверный id, ключ, подпись или часы ушли больше чем на 5 минут |
| 413 | `{error: "too_large"}` | разбить пачку |
| 429, 503 | | повторить позже — тем же `attempt_id` |

Повторять можно сколько угодно: прохождение хранится один раз. Сайт держит последние
5000 прохождений клиента.

## Пример на Python (без зависимостей)

```python
import hashlib, hmac, json, os, time, urllib.request

URL = os.environ["SHUR_INGEST_URL"]
CLIENT_ID = os.environ["SHUR_CLIENT_ID"]
SECRET = os.environ["SHUR_CLIENT_SECRET"].encode()


def participant_hash(telegram_id: int) -> str:
    # Наружу уходит только это: по хэшу человека не восстановить.
    return hmac.new(SECRET, f"participant:{telegram_id}".encode(), hashlib.sha256).hexdigest()


def send(payload: dict) -> dict:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    ts = str(int(time.time()))
    signature = hmac.new(SECRET, ts.encode() + b"." + body, hashlib.sha256).hexdigest()
    request = urllib.request.Request(URL, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "X-Shur-Client": CLIENT_ID,
        "X-Shur-Timestamp": ts,
        "X-Shur-Signature": "sha256=" + signature,
    })
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.load(response)


send({
    "attempt_id": "t1-2026-11-18T14:05:12-8f3a",
    "test": "Ваш бізнес готовий до зростання?",
    "score": 7,
    "max_score": 12,
    "range_label": "5–8",
    "finished_at": "2026-11-18T14:05:12+02:00",
    "answers": [
        {"q": "Чи є у вас план продажів?", "a": "Частково", "points": 1},
        {"q": "Хто веде фінанси?", "a": "Я сам", "points": 2},
    ],
    "participant": participant_hash(100000001),
})
```

`urlopen` бросает `HTTPError` на 4xx/5xx: 429 и 5xx — отложить и повторить (у бота для
этого уже есть очередь `answers.jsonl`), 400 и 401 — записать код в журнал и не повторять.
В журнал бота — код ответа и `attempt_id`, не тело.

## Файлом вместо бота

В кабинете клиента (и у админа в `/cabinet`) можно загрузить `.csv` / `.xlsx` с теми же
колонками: `test`, `score`, `finished_at` обязательны; `attempt_id`, `max_score`,
`range_label`, `participant` — по желанию; каждая остальная колонка — вопрос (заголовок —
текст вопроса, ячейка — ответ). Колонки `telegram id`, `username`, `имя` и подобные
отбрасываются и не сохраняются. Тот же файл дважды ничего не добавляет. Таблица с другими
колонками показывается в кабинете как есть.

## Что видит клиент

По каждому тесту: число прохождений, уникальные участники (если бот шлёт `participant`),
средний балл, распределение по диапазонам и по дням, распределение ответов по вопросам;
ниже — последние 50 прохождений (время, тест, балл, диапазон). Результаты открыты, пока
оплачена подписка (`docs/monobank-subscription.md`); приём от бота работает всегда.
