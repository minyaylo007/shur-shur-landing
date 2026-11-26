#!/usr/bin/env node
// Ключ бота для кабинета клиента — без браузера (то же, что кнопка «Ключ бота» в /cabinet).
//
//   node ops/cabinet/client-key.mjs --name "<название клиента>" --out <файл> [--test]
//   node ops/cabinet/client-key.mjs --id <id клиента> --out <файл>
//   node ops/cabinet/client-key.mjs --id <id клиента> --delete
//   node ops/cabinet/client-key.mjs --list
//   node ops/cabinet/client-key.mjs --id <id клиента> --link
//   node ops/cabinet/client-key.mjs --id <id клиента> --login <логин> --password-file <файл>
//
// --list: id, название, задан ли пароль. --link: НОВАЯ одноразовая короткая
// ссылка (7 дней); пароль, заданный по ней, заменяет прежний и выходит из
// всех прежних сессий; ключ бота не меняется.
//
// --login + --password-file: простой логин (латиница/цифры, 3–32, регистр не
// важен) и пароль (от 5 знаков) без ссылки. Пароль — первая строка файла
// (держать 600); не печатается. Прежние сессии и неиспользованная ссылка
// перестают действовать.
//
// --name: клиент с таким названием; нет такого — будет создан. Каждый запуск
// выпускает НОВЫЙ секрет, прежний перестаёт действовать сразу.
//
// Секрет НЕ печатается: три строки (адрес, id, секрет) пишутся в --out с
// правами 640 — файл читает тот, кто ведёт бота (docs/client-ingest.md).
// У нового клиента рядом появляется <файл>.setup (600) с одноразовой ссылкой,
// по которой клиент задаёт пароль своего кабинета; ссылка живёт 7 дней.
// --delete убирает клиента и его данные (сайт откажет, пока идёт подписка).

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { config, postSigned } from "./lib.mjs";

const { values } = parseArgs({
  options: { name: { type: "string" }, id: { type: "string" }, out: { type: "string" }, test: { type: "boolean" }, delete: { type: "boolean" }, list: { type: "boolean" }, link: { type: "boolean" }, login: { type: "string" }, "password-file": { type: "string" } },
});
const usage = () => {
  console.error('нужно: --name "<название>" --out <файл> [--test] | --id <id> --out <файл> | --id <id> --delete | --id <id> --login <логин> --password-file <файл>');
  process.exit(2);
};
if (values.login !== undefined || values["password-file"] !== undefined) {
  if (!values.id || !values.login || !values["password-file"]) usage();
} else if (!values.list && (values.delete || values.link ? !values.id : !values.out || !values.name === !values.id)) usage();

const { secret, site } = config();
const call = (payload) => postSigned(`${site}/api/cabinet/client-key`, secret, payload);

if (values.list) {
  const { status, answer } = await call({ action: "list" });
  if (status !== 200) {
    console.error(`сайт не дал список: HTTP ${status} ${answer?.error ?? ""}`);
    process.exit(1);
  }
  for (const c of answer.clients) console.log(`${c.id}  ${c.name}${c.test ? " (тест)" : ""}  логин: ${c.login ?? "—"}  пароль: ${c.password_set ? "есть" : "нет"}`);
  process.exit(0);
}

if (values.login) {
  const password = readFileSync(values["password-file"], "utf8").split(/\r?\n/)[0];
  const { status, answer } = await call({ action: "password", client_id: values.id, login: values.login, password });
  if (status !== 200) {
    console.error(`сайт не задал логин и пароль: HTTP ${status} ${answer?.error ?? ""}`);
    process.exit(1);
  }
  console.log(`логин и пароль заданы; вход: ${site}/client/login`);
  process.exit(0);
}

if (values.link) {
  const { status, answer } = await call({ action: "link", client_id: values.id });
  if (status !== 200 || !answer?.setup_url) {
    console.error(`сайт не выдал ссылку: HTTP ${status} ${answer?.error ?? ""}`);
    process.exit(1);
  }
  console.log(`одноразовая ссылка для пароля (7 дней):\n${answer.setup_url}\nпотом вход: ${site}/client/${values.id}`);
  process.exit(0);
}

if (values.delete) {
  const { status, answer } = await call({ action: "delete", client_id: values.id });
  if (status !== 200) {
    console.error(`сайт не удалил клиента: HTTP ${status} ${answer?.error ?? ""}`);
    process.exit(1);
  }
  console.log("клиент удалён вместе с данными");
  process.exit(0);
}

const { status, answer } = await call(values.id ? { action: "key", client_id: values.id } : { action: "key", name: values.name, ...(values.test ? { test: true } : {}) });
if (status !== 200 || !answer?.secret) {
  console.error(`сайт не выдал ключ: HTTP ${status} ${answer?.error ?? ""}`);
  process.exit(1);
}

function write(file, lines, mode) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, lines.join("\n") + "\n", { mode });
  chmodSync(file, mode);
}

write(values.out, [`SHUR_INGEST_URL=${site}/api/client/ingest`, `SHUR_CLIENT_ID=${answer.client_id}`, `SHUR_CLIENT_SECRET=${answer.secret}`], 0o640);
console.log(`ключ бота записан в ${values.out} (640); клиент ${answer.client_id}${answer.created ? " — создан" : ""}`);
if (answer.setup_token) {
  const link = `${values.out}.setup`;
  write(
    link,
    ["Кабинет клиента SHUR-SHUR — одноразовая ссылка для установки пароля (7 дней).", "", `${site}/c/${answer.client_id}/${answer.setup_token}`, "", `Потом вход: ${site}/client/${answer.client_id}`],
    0o600,
  );
  console.log(`ссылка для пароля клиента — в ${link} (600)`);
}
