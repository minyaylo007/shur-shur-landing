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
    ],
  },
});
