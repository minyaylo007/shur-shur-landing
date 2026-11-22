#!/usr/bin/env node
// Залить проекты Саши в «Гроші» (/cabinet/groshi) из приватного файла.
//
//   node ops/groshi/seed-projects.mjs [файл]
//   по умолчанию /opt/ihor/shur/private/groshi-projects.json
//
// Файл: { "projects": [{ "name", "amount" (целые гривни/доллары), "ccy": "UAH"|"USD",
//          "group"?, "pausedFrom"?: "ГГГГ-ММ", "pausedUntil"?: "ГГГГ-ММ" }] }.
// Файл НЕ в git: настоящие названия и суммы. Скрипт печатает только счётчики.
// «group» — подсказка, что проекты платят вместе: проекты одной группы идут
// в списке рядом, отдельной сущности нет. Повторный запуск обновит суммы и
// паузы по названию, не задвоит. Подпись — CABINET_HMAC_SECRET (ops/cabinet/lib.mjs).

import { readFileSync } from "node:fs";
import { config, postSigned } from "../cabinet/lib.mjs";

const file = process.argv[2] || "/opt/ihor/shur/private/groshi-projects.json";
let source;
try {
  source = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  console.error(`не читается как JSON: ${file} (${e instanceof Error ? e.name : "error"})`);
  process.exit(2);
}

const list = Array.isArray(source?.projects) ? source.projects : [];
const order = [...new Set(list.map((p) => p.group ?? ""))];
const projects = [...list]
  .sort((a, b) => order.indexOf(a.group ?? "") - order.indexOf(b.group ?? ""))
  .map((p) => ({
    name: String(p.name),
    amount: Math.round(Number(p.amount) * 100),
    currency: p.ccy === "USD" ? "USD" : "UAH",
    ...(p.pausedFrom ? { pausedFrom: p.pausedFrom } : {}),
    ...(p.pausedUntil ? { pausedUntil: p.pausedUntil } : {}),
  }));
if (!projects.length) {
  console.error("в файле нет проектов");
  process.exit(2);
}

const { secret, site } = config();
const { status, answer } = await postSigned(`${site}/api/cabinet/groshi-seed`, secret, { projects });
if (status === 200) {
  console.log(`залито: ${answer.added} новых, ${answer.updated} обновлено, всего проектов ${answer.total}`);
} else {
  console.error(`отказ HTTP ${status}: ${answer?.error ?? "?"}`);
  process.exit(1);
}
