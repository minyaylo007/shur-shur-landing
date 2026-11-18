import Link from "next/link";
import { redirect } from "next/navigation";
import { MIN_PASSWORD } from "@/lib/cabinet/auth";
import { clientSetupValid, isClientId } from "@/lib/client/clients";

const MESSAGES: Record<string, string> = {
  weak_password: `Пароль — не коротший за ${MIN_PASSWORD} символів.`,
  mismatch: "Паролі не збіглися.",
  limit: "Забагато спроб. Зачекайте трохи.",
  down: "Кабінет тимчасово недоступний. Спробуйте пізніше.",
  bad_link: "Посилання вже використане або застаріло — попросіть нове.",
};

const input = "mt-1 block w-full rounded border border-ink-500 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-500";

export default async function ClientSetup({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; e?: string }> }) {
  const { id } = await params;
  if (!isClientId(id)) redirect("/");
  const { t, e } = await searchParams;
  let valid = false;
  try {
    valid = await clientSetupValid(id, t);
  } catch {
    valid = false;
  }

  if (!valid) {
    return (
      <div className="mx-auto mt-16 max-w-sm">
        <h1 className="font-display text-2xl">Посилання недійсне</h1>
        <p className="mt-4 text-ink-700">
          Посилання для встановлення пароля одноразове й діє 7 днів. Це вже використане або застаріло — попросіть нове.
        </p>
        <p className="mt-4">
          <Link href={`/client/${id}/login`} className="font-medium text-cherry-700 underline">
            Увійти з паролем
          </Link>
        </p>
      </div>
    );
  }

  const message = e ? MESSAGES[e] : undefined;
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="font-display text-2xl">Задайте пароль</h1>
      <p className="mt-2 text-sm text-ink-700">Не коротший за {MIN_PASSWORD} символів. Посилання спрацює один раз.</p>
      <form method="post" action="/api/client/setup" className="mt-6 space-y-4">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="t" value={t} />
        <label className="block">
          <span className="text-sm text-ink-700">Новий пароль</span>
          <input type="password" name="password" required minLength={MIN_PASSWORD} autoComplete="new-password" className={input} />
        </label>
        <label className="block">
          <span className="text-sm text-ink-700">Ще раз</span>
          <input type="password" name="repeat" required minLength={MIN_PASSWORD} autoComplete="new-password" className={input} />
        </label>
        {message ? (
          <p role="alert" className="text-sm text-cherry-600">
            {message}
          </p>
        ) : null}
        <button type="submit" className="w-full rounded bg-cherry-deep px-4 py-3 font-semibold text-cream-type shadow-sm hover:bg-cherry-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cherry-deep">
          Зберегти пароль
        </button>
      </form>
    </div>
  );
}
