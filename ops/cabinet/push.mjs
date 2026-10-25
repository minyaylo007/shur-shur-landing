#!/usr/bin/env node
// Отправить снимок кабинета на сайт вручную.
//
//   node ops/cabinet/push.mjs <снимок.json>
//   node ops/cabinet/push.mjs /opt/ihor/shur-ads/data/cabinet-snapshot.json
//
// Обычно это делает ads-engine сам после ежедневного отчёта (`daily`, или
// `node src/cli.ts cabinet`). Скрипт — для повторной отправки и проверки.
// Сайт принимает только подписанный снимок без полей с персональными данными
// (src/lib/cabinet/snapshot.ts); при отказе печатает ПУТИ полей, не значения.

import { readFileSync } from "node:fs";
import { config, postSigned } from "./lib.mjs";

const file = process.argv[2];
if (!file) {
  console.error("использование: node ops/cabinet/push.mjs <снимок.json>");
  process.exit(2);
}

let snapshot;
try {
  snapshot = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  console.error(`не читается как JSON: ${file} (${e instanceof Error ? e.name : "error"})`);
  process.exit(2);
}

const { secret, site } = config();
const { status, answer } = await postSigned(`${site}/api/cabinet/ingest`, secret, snapshot);
if (status === 200) {
  console.log(`принято: ${site}/api/cabinet/ingest (test_data=${snapshot.test_data})`);
} else {
  console.error(`отказ HTTP ${status}: ${answer?.error ?? "?"}${answer?.where ? " в " + answer.where.join(", ") : ""}`);
  process.exit(1);
}
