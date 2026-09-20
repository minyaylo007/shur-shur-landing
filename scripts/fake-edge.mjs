#!/usr/bin/env node
/**
 * Подделка боевого края Vercel — чтобы смоку выката можно было проверить
 * НЕ на бою.
 *
 * Смока (scripts/smoke-production.sh) обязана отличать переходное состояние
 * края, которое проходит само, от поломки, которая сама не пройдёт. Проверить
 * это на настоящем Vercel нельзя: переходное состояние не вызывается по
 * заказу. Поэтому сервер ниже отвечает как край — теми же заголовками
 * (`age`, `x-vercel-cache`, `x-vercel-id`) и той же разметкой (canonical +
 * meta-отпечаток сборки), — но по сценарию, который задаёт человек.
 *
 *   FAKE_SCENARIO=converge  node scripts/fake-edge.mjs
 *
 * Сценарии (отстаёт ровно одна локаль, FAKE_LAGGING_LOCALE, по умолчанию /uk —
 * ровно так и выглядели прогоны 35004846361, 35010597770, 35014441296):
 *   converge  — первые FAKE_LAG_SECONDS секунд отдаёт предыдущую сборку
 *               с большим `age`, потом свежую. Смока обязана ПРОЙТИ.
 *   stuck     — отдаёт предыдущую сборку с большим `age` всегда.
 *               Смока обязана УПАСТЬ, уложившись в бюджет ожидания.
 *   foreign   — отвечает 200 со свежим `age`, но чужим телом (нет нашего
 *               canonical). Смока обязана упасть СРАЗУ, не потратив бюджет.
 *   old-build — отвечает 200 со СВЕЖИМ `age`, но отпечатком предыдущей
 *               сборки. Прежняя смока, судившая по возрасту, это пропускала.
 *
 * Слушает только 127.0.0.1 и только порт из FAKE_PORT (реестр ~/maestro/PORTS.md).
 */
import { createServer } from "node:http";

const PORT = Number(process.env.FAKE_PORT || 8012);
const BASE = process.env.FAKE_BASE || `http://127.0.0.1:${PORT}`;
const NEW_SHA = process.env.FAKE_NEW_SHA || "1".repeat(40);
const OLD_SHA = process.env.FAKE_OLD_SHA || "0".repeat(40);
const SCENARIO = process.env.FAKE_SCENARIO || "converge";
const LAG_SECONDS = Number(process.env.FAKE_LAG_SECONDS || 30);
const LAGGING = process.env.FAKE_LAGGING_LOCALE || "uk";
const LOCALES = ["uk", "en", "he", "ro"];

const startedAt = Date.now();
let served = 0;

/** Наша страница: ровно те два признака, которые читает смока. */
const ourPage = (locale, sha) =>
  `<!DOCTYPE html><html lang="${locale}"><head>` +
  `<link rel="canonical" href="${BASE}/${locale}"/>` +
  (sha ? `<meta name="x-build-sha" content="${sha}"/>` : "") +
  `<title>shur-shur</title></head><body>shur-shur</body></html>`;

/** Не наша страница: отвечает 200, выглядит живой, нашего canonical нет. */
const foreignPage =
  `<!DOCTYPE html><html><head><title>Deployment</title></head>` +
  `<body>404: NOT_FOUND</body></html>`;

/** Что край отдаёт по этой локали прямо сейчас. */
function state(locale) {
  if (locale !== LAGGING) return "fresh";
  const elapsed = (Date.now() - startedAt) / 1000;
  switch (SCENARIO) {
    case "converge": return elapsed < LAG_SECONDS ? "stale" : "fresh";
    case "stuck": return "stale";
    case "foreign": return "foreign";
    case "old-build": return "old-build";
    default: return "fresh";
  }
}

const server = createServer((req, res) => {
  served += 1;
  const path = (req.url || "/").split("?")[0];
  const id = `iad1::fake-${served}`;

  if (path === "/" || path === "") {
    res.writeHead(308, { location: `${BASE}/uk`, "x-vercel-id": id });
    res.end();
    process.stderr.write(`подделка: GET / -> 308\n`);
    return;
  }

  const locale = path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!LOCALES.includes(locale)) {
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end(foreignPage);
    return;
  }

  const what = state(locale);
  const [code, age, cache, body] =
    what === "stale"
      ? [200, 3189, "HIT", ourPage(locale, OLD_SHA)]
      : what === "foreign"
        ? [200, 0, "MISS", foreignPage]
        : what === "old-build"
          ? [200, 4, "PRERENDER", ourPage(locale, OLD_SHA)]
          : [200, 0, "PRERENDER", ourPage(locale, NEW_SHA)];

  res.writeHead(code, {
    "content-type": "text/html; charset=utf-8",
    age: String(age),
    "x-vercel-cache": cache,
    "x-vercel-id": id,
  });
  res.end(body);
  process.stderr.write(`подделка: GET /${locale} -> ${code} ${what} (age ${age})\n`);
});

server.listen(PORT, "127.0.0.1", () => {
  process.stderr.write(
    `подделка края: 127.0.0.1:${PORT}, сценарий ${SCENARIO}, ` +
      `отстаёт /${LAGGING}, новая сборка ${NEW_SHA}, предыдущая ${OLD_SHA}\n`,
  );
});
