import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { locales } from "../src/lib/i18n";

/**
 * Отпечаток сборки: смока выката судит о свежести боя ПО НЕМУ.
 *
 * Свежесть раньше проверялась возрастом ответа (`age <= 120`), и исправный
 * бой краснел трижды за день 15.09.2026: кеш края Vercel сбрасывается не
 * одномоментно по всем PoP, и переходное состояние по возрасту неотличимо от
 * поломки. Теперь на каждой странице стоит meta с SHA коммита, из которого
 * она собрана, и смока требует совпадения с коммитом выката.
 *
 * Значит отпечаток — не украшение: пропадёт он из страницы, и смока либо
 * остановит исправный выкат, либо (если её ослабить) перестанет проверять
 * свежесть вовсе. Отсюда три вещи, которые здесь и стерегутся:
 *   • переменная сборки действительно превращается в отпечаток;
 *   • тег стоит во ВСЕХ локалях — их обслуживает общий layout;
 *   • layout и смока называют тег ОДНИМ именем: они в разных файлах и на
 *     разных языках, ничто, кроме этого теста, их не сводит.
 */

/* layout тянет next/font/google — вне сборки Next его там нет. Подменяем
   фабрики шрифтов: этот тест про отпечаток, а не про типографику. */
vi.mock("next/font/google", () => {
  const face = () => ({ variable: "--font-mock", className: "font-mock" });
  return { Unbounded: face, Manrope: face, Rubik: face, Assistant: face };
});

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const SHA = "0123456789abcdef0123456789abcdef01234567";

/** Модуль читает переменную на импорте — значит его надо импортировать заново. */
async function withBuildSha<T>(value: string | undefined, run: () => Promise<T>): Promise<T> {
  vi.resetModules();
  if (value === undefined) vi.stubEnv("NEXT_PUBLIC_BUILD_SHA", "");
  else vi.stubEnv("NEXT_PUBLIC_BUILD_SHA", value);
  return run();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("отпечаток сборки", () => {
  it("берётся из переменной сборки и чистится от пробелов", async () => {
    await withBuildSha(`  ${SHA}\n`, async () => {
      const { buildSha } = await import("../src/lib/build");
      expect(buildSha).toBe(SHA);
    });
  });

  it("пустой, когда переменной нет: вне боевого выката отпечатывать нечего", async () => {
    await withBuildSha(undefined, async () => {
      const { buildSha } = await import("../src/lib/build");
      expect(buildSha).toBe("");
    });
  });

  it.each(locales)("стоит в метаданных локали /%s", async (locale) => {
    await withBuildSha(SHA, async () => {
      const { BUILD_SHA_META } = await import("../src/lib/build");
      const { generateMetadata } = await import("../src/app/[locale]/layout");
      const meta = await generateMetadata({ params: Promise.resolve({ locale }) });
      expect(meta.other?.[BUILD_SHA_META]).toBe(SHA);
    });
  });

  it("не появляется, когда переменной сборки нет", async () => {
    await withBuildSha(undefined, async () => {
      const { BUILD_SHA_META } = await import("../src/lib/build");
      const { generateMetadata } = await import("../src/app/[locale]/layout");
      const meta = await generateMetadata({ params: Promise.resolve({ locale: "uk" }) });
      expect(meta.other?.[BUILD_SHA_META]).toBeUndefined();
    });
  });

  it("называется в смоке выката ровно так же, как в коде страницы", async () => {
    const { BUILD_SHA_META } = await import("../src/lib/build");
    const smoke = read("../scripts/smoke-production.sh");
    const named = /^META="([^"]+)"/m.exec(smoke);
    expect(named, "в scripts/smoke-production.sh нет строки META=\"…\" — смока ищет тег под другим именем").not.toBeNull();
    expect(named?.[1]).toBe(BUILD_SHA_META);
  });

  it("человеку не виден: это meta в <head>, а не текст страницы", async () => {
    const { BUILD_SHA_META } = await import("../src/lib/build");
    const layout = read("../src/app/[locale]/layout.tsx");
    // Отпечаток попадает на страницу ТОЛЬКО через блок metadata: всё, что
    // рисует RootLayout, человек видит глазами.
    const rendered = layout.slice(layout.indexOf("export default async function RootLayout"));
    expect(rendered).not.toContain(BUILD_SHA_META);
    expect(layout).toContain("other:");
  });
});
