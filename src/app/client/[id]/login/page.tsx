import { redirect } from "next/navigation";
import { isClientId } from "@/lib/client/clients";

const MESSAGES: Record<string, string> = {
  bad: "Пароль не підійшов.",
  limit: "Забагато спроб. Зачекайте трохи й спробуйте знову.",
  unset: "Пароль ще не задано — відкрийте посилання, яке ви отримали від SHUR-SHUR.",
  down: "Кабінет тимчасово недоступний. Спробуйте пізніше.",
};

export default async function ClientLogin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string }> }) {
  const { id } = await params;
  if (!isClientId(id)) redirect("/");
  const { e } = await searchParams;
  const message = e ? MESSAGES[e] : undefined;
  return (
    <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-paper-200 bg-cream-type p-6 shadow-[0_8px_24px_-16px_rgba(74,13,20,0.25)] sm:mt-12 sm:p-8">
      <h1 className="font-display text-2xl">Кабінет клієнта SHUR-SHUR</h1>
      <form method="post" action="/api/client/login" className="mt-6 space-y-4">
        <input type="hidden" name="id" value={id} />
        <label className="block">
          <span className="text-sm text-ink-700">Пароль</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            autoFocus
            className="mt-1 block w-full rounded-xl border border-ink-500/50 bg-white px-4 py-3 text-ink-900 placeholder:text-ink-500"
          />
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
      <p className="mt-6 text-sm text-ink-700">Забули пароль — напишіть нам, надішлемо нове посилання.</p>
    </div>
  );
}
