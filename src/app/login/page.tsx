/* The one login: login + password. «admin» opens the owner's cabinet, any
   other login a client's own cabinet; the form never says whether a login is known. */

import { site } from "@/lib/site";

const MESSAGES: Record<string, string> = {
  bad: "Логін або пароль не підійшли.",
  limit: "Забагато спроб. Зачекайте трохи й спробуйте знову.",
  unset: "Пароль ще не задано — напишіть нам.",
  down: "Кабінет тимчасово недоступний. Спробуйте пізніше.",
};

const input = "mt-1 block w-full rounded-xl border border-ink-500/50 bg-white px-4 py-3 text-ink-900 placeholder:text-ink-500";

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const message = e ? MESSAGES[e] : undefined;
  return (
    <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-paper-200 bg-cream-type p-6 shadow-[0_8px_24px_-16px_rgba(74,13,20,0.25)] sm:mt-12 sm:p-8">
      <h1 className="font-display text-2xl">Вхід у кабінет SHUR-SHUR</h1>
      <form method="post" action="/api/login" className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-ink-700">Логін</span>
          <input type="text" name="login" required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus className={input} />
        </label>
        <label className="block">
          <span className="text-sm text-ink-700">Пароль</span>
          <input type="password" name="password" required autoComplete="current-password" className={input} />
        </label>
        {message ? (
          <p role="alert" className="text-sm text-cherry-600">
            {message}
          </p>
        ) : null}
        <button type="submit" className="w-full rounded-full bg-cherry-juice px-6 py-3.5 font-semibold text-cream-type shadow-sm hover:bg-juice-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cherry-deep">
          Увійти
        </button>
      </form>
      <p className="mt-6 text-sm text-ink-700">
        Забули пароль? Подзвоніть або напишіть:{" "}
        <a href={site.phone.tel} className="font-medium text-cherry-700 underline underline-offset-4">
          <span dir="ltr">{site.phone.display}</span>
        </a>
      </p>
    </div>
  );
}
