#!/usr/bin/env node
// Задать пароль кабинета Саши (вход «admin» на /login) без ссылки.
//
//   node ops/cabinet/set-password.mjs --password-file <файл>
//
// Пароль — первая строка файла (держать 600); не печатается и не попадает в
// argv. На сайт уходит подписанным запросом (CABINET_HMAC_SECRET), хранится
// только scrypt-хеш. Все прежние входы и неиспользованная ссылка гаснут.

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { config, postSigned } from "./lib.mjs";

const { values } = parseArgs({ options: { "password-file": { type: "string" } } });
if (!values["password-file"]) {
  console.error("нужно: --password-file <файл>");
  process.exit(2);
}
const password = readFileSync(values["password-file"], "utf8").split(/\r?\n/)[0];

const { secret, site } = config();
const { status, answer } = await postSigned(`${site}/api/cabinet/password`, secret, { password });
if (status !== 200) {
  console.error(`сайт не задал пароль: HTTP ${status} ${answer?.error ?? ""}`);
  process.exit(1);
}
console.log(`пароль кабинета задан; вход: ${site}/login, логин admin`);
