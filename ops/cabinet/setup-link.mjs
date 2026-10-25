#!/usr/bin/env node
// Выпустить одноразовую ссылку установки пароля для кабинета (/cabinet/setup).
//
//   node ops/cabinet/setup-link.mjs [файл]     (по умолчанию /opt/ihor/shur/private/cabinet-setup.txt)
//
// Токен рождается здесь и НЕ печатается: ссылка пишется в файл с правами 600,
// на сайт уходит только SHA-256 токена и срок (7 дней). Новая ссылка отменяет
// прежнюю неиспользованную. Пароль, заданный по ссылке, сбрасывает все
// прежние входы — так же делается и смена пароля.

import { createHash, randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { config, postSigned } from "./lib.mjs";

const out = process.argv[2] || "/opt/ihor/shur/private/cabinet-setup.txt";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const { secret, site } = config();
const token = randomBytes(32).toString("base64url");
const expiresAt = Date.now() + TTL_MS;

const { status, answer } = await postSigned(`${site}/api/cabinet/setup-link`, secret, {
  token_hash: createHash("sha256").update(token).digest("hex"),
  expires_at: expiresAt,
});
if (status !== 200) {
  console.error(`сайт не принял ссылку: HTTP ${status} ${answer?.error ?? ""}`);
  process.exit(1);
}

const until = new Date(answer?.expires_at ?? expiresAt).toLocaleString("ru-RU", { timeZone: "Europe/Kyiv" });
mkdirSync(dirname(out), { recursive: true, mode: 0o700 });
writeFileSync(
  out,
  [
    "Кабинет SHUR-SHUR — одноразовая ссылка для установки пароля.",
    `Действует до ${until} (Киев), срабатывает один раз.`,
    "",
    `${site}/cabinet/setup?t=${token}`,
    "",
  ].join("\n"),
  { mode: 0o600 },
);
chmodSync(out, 0o600);
console.log(`ссылка записана в ${out} (600), действует до ${until}`);
