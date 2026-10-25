const MESSAGES: Record<string, string> = {
  bad: "Пароль не подошёл.",
  limit: "Слишком много попыток. Подождите немного и попробуйте снова.",
  unset: "Пароль ещё не задан — откройте ссылку для установки пароля.",
  down: "Кабинет временно недоступен. Попробуйте позже.",
};

export default async function CabinetLogin({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const message = e ? MESSAGES[e] : undefined;
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="font-display text-2xl">Кабинет SHUR-SHUR</h1>
      <form method="post" action="/api/cabinet/login" className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-ink-700">Пароль</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            autoFocus
            className="mt-1 block w-full rounded border border-ink-500 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-500"
          />
        </label>
        {message ? (
          <p role="alert" className="text-sm text-cherry-600">
            {message}
          </p>
        ) : null}
        <button type="submit" className="w-full rounded bg-cherry-deep px-4 py-3 font-semibold text-cream-type shadow-sm hover:bg-cherry-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cherry-deep">
          Войти
        </button>
      </form>
    </div>
  );
}
