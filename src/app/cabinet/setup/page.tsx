import Link from "next/link";
import { MIN_PASSWORD, setupLinkValid } from "@/lib/cabinet/auth";

const MESSAGES: Record<string, string> = {
  weak_password: `Пароль — не короче ${MIN_PASSWORD} символов.`,
  mismatch: "Пароли не совпали.",
  limit: "Слишком много попыток. Подождите немного.",
  down: "Кабинет временно недоступен. Попробуйте позже.",
};

export default async function CabinetSetup({ searchParams }: { searchParams: Promise<{ t?: string; e?: string }> }) {
  const { t, e } = await searchParams;
  let valid = false;
  try {
    valid = await setupLinkValid(t);
  } catch {
    valid = false;
  }

  if (!valid) {
    return (
      <div className="mx-auto mt-16 max-w-sm">
        <h1 className="font-display text-2xl">Ссылка недействительна</h1>
        <p className="mt-4 text-ink-700">
          Ссылка для установки пароля одноразовая и живёт 7 дней. Эта уже использована или устарела — попросите новую.
        </p>
        <p className="mt-4">
          <Link href="/cabinet/login" className="underline">
            Войти с паролем
          </Link>
        </p>
      </div>
    );
  }

  const message = e ? MESSAGES[e] : undefined;
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="font-display text-2xl">Задайте пароль</h1>
      <p className="mt-2 text-sm text-ink-700">
        Не короче {MIN_PASSWORD} символов. Ссылка сработает один раз.
      </p>
      <form method="post" action="/api/cabinet/setup" className="mt-6 space-y-4">
        <input type="hidden" name="t" value={t} />
        <label className="block">
          <span className="text-sm text-ink-700">Новый пароль</span>
          <input
            type="password"
            name="password"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            className="mt-1 block w-full rounded border border-ink-500 bg-white px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm text-ink-700">Ещё раз</span>
          <input
            type="password"
            name="repeat"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            className="mt-1 block w-full rounded border border-ink-500 bg-white px-3 py-2"
          />
        </label>
        {message ? (
          <p role="alert" className="text-sm text-cherry-600">
            {message}
          </p>
        ) : null}
        <button type="submit" className="w-full rounded bg-cherry-deep px-4 py-2 text-cream-type">
          Сохранить и войти
        </button>
      </form>
    </div>
  );
}
