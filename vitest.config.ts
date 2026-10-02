import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/* The suite ran configless until app modules joined it: `src/app/sitemap.ts`
   imports through the `@/*` alias from tsconfig, which vitest does not read.

   Two runs, one suite (owner's speed review, 22.09.2026). A test is CRITICAL
   when its failure changes something for the visitor, for the lead or for the
   deploy: the lead reaches Telegram, the four locales are alive, the contact
   channels are real, the edge serves the build we pushed. Everything else
   guards appearance — it still runs, but on merge and in CI, not on every
   small fix. The split lives here and nowhere else, so sessions run one
   command instead of inventing a file list. */
const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export const critical = [
  "tests/telegram.test.ts", //          заявка доходит в Telegram
  "tests/validation.test.ts", //        что принимаем и что отсекаем
  "tests/lead-failures.test.ts", //     отказ маршрута виден человеку
  "tests/rate-limit.test.ts", //        канал не забить
  "tests/i18n-locales.test.ts", //      четыре локали живы
  "tests/conversion.test.ts", //        единственный настоящий телефон и готовность каналов
  "tests/build-fingerprint.test.ts", // выкат и откат можно ИЗМЕРИТЬ
  "tests/lead-attribution.test.ts", //  заявка доходит при любом учёте; HMAC; рынок; пиксель без согласия молчит; PII не в URL/логах
  "tests/consent-zone.test.ts", //      баннер в ЕС и по умолчанию; вне ЕС пиксель сразу; отказ главнее зоны
  "tests/thanks-lead.test.ts", //      принятая заявка → /thanks; Lead ровно один с eventID; Contact; URL без данных
  "tests/lead-ledger-first.test.ts", // журнал первым: Telegram упал → 200 и ретрай; оба упали → 502; повторная доставка
];

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      { resolve: { alias }, test: { name: "critical", include: critical } },
      {
        resolve: { alias },
        test: { name: "looks", include: ["tests/**/*.test.ts"], exclude: critical },
      },
      /* The lead ledger and ads analytics service (ads-engine/, runs on
         ace-main, not on Vercel). Its tests touch no site code, so they ride
         with the full run only: `npm test` stays the site's fast lane. */
      { test: { name: "ads", include: ["ads-engine/test/**/*.test.ts"] } },
    ],
  },
});
