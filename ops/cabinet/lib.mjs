// Общее для ops/cabinet/*.mjs: ключ подписи и адрес сайта. Без зависимостей.
//
// Ключ CABINET_HMAC_SECRET берётся из окружения, иначе из env-файла ads-engine
// (/opt/ihor/shur-ads/env, 600). Файл РАЗБИРАЕТСЯ, а не исполняется оболочкой:
// значение не попадает ни в argv, ни в вывод.

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

export const ENV_FILE = process.env.SHUR_ADS_ENV_FILE || "/opt/ihor/shur-ads/env";

export function readEnvFile(file = ENV_FILE) {
  const out = {};
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return out;
  }
  for (const line of text.split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

export function config() {
  const file = readEnvFile();
  const secret = process.env.CABINET_HMAC_SECRET || file.CABINET_HMAC_SECRET;
  const site = (process.env.SHUR_SITE_URL || file.SHUR_SITE_URL || "https://shur-shur.com").replace(/\/+$/, "");
  if (!secret) {
    console.error(`нет CABINET_HMAC_SECRET (ни в окружении, ни в ${ENV_FILE})`);
    process.exit(2);
  }
  if (site === "off") {
    console.error("SHUR_SITE_URL=off — отправлять некуда");
    process.exit(2);
  }
  return { secret, site };
}

/** POST, подписанный как договор журнала: HMAC-SHA256(«ts.тело»), ±300 с. */
export async function postSigned(url, secret, payload) {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const signature = "sha256=" + createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shur-Timestamp": ts, "X-Shur-Signature": signature },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  let answer = null;
  try {
    answer = await res.json();
  } catch {
    answer = null;
  }
  return { status: res.status, answer };
}
