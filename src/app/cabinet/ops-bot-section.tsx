import type { OpsBotStatus } from "@/lib/cabinet/ops-bot";

/* Her ops bot: the Telegram bot that brings the daily report and takes
   /client. A short BotFather guide and two write-only fields — never
   pre-filled, nothing she typed comes back. */

export const OPS_BOT_MESSAGES: Record<string, string> = {
  bot_token_format:
    "Токен не похож на настоящий: он выглядит как «123456789:AA…» — цифры, двоеточие и длинный хвост из букв. Скопируйте его из сообщения BotFather целиком.",
  bot_chat_format: "Номер чата — только цифры (у групп с минусом впереди). Или оставьте поле пустым.",
  bot_refused: "Telegram не узнал этот токен. Возьмите его ещё раз у @BotFather (команда /mybots → бот → API Token).",
  bot_no_chat: "Бот не видит ни одного сообщения. Напишите своему боту /start (шаг 3) и нажмите «Проверить и сохранить» ещё раз.",
  bot_unreachable: "Telegram сейчас не отвечает. Попробуйте ещё раз через несколько минут — ничего не сохранено.",
  down: "Токен сейчас не принимается — ничего не сохранено. Попробуйте позже.",
};

const input = "mt-1 block w-full rounded border border-ink-500 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-500";

const kyiv = (ms: number) => new Date(ms).toLocaleString("ru-RU", { timeZone: "Europe/Kyiv" });

export function OpsBotSection({ status, o }: { status: OpsBotStatus | null; o: string | undefined }) {
  const message = o && o !== "saved" ? OPS_BOT_MESSAGES[o] : undefined;
  const bot = status?.botName ? ` — ${status.botName}` : "";
  return (
    <section id="ops-bot" className="mt-10 max-w-xl">
      <h2 className="font-display text-xl">Служебный бот</h2>
      {o === "saved" ? (
        <p role="status" className="mt-2 font-medium">
          Бот проверен{bot}.
        </p>
      ) : null}
      <p className="mt-2 text-sm text-ink-700">
        {status?.pendingSince
          ? `Токен проверен и передан ${kyiv(status.pendingSince)} (Киев)${bot}; сервер рекламы заберёт его при ближайшем обновлении.`
          : status?.takenAt
            ? `Токен перенесён на сервер рекламы ${kyiv(status.takenAt)} (Киев)${bot}; здесь его копии нет.`
            : "Бот ещё не подключён. Через него приходит ежедневный отчёт и записываются клиенты из Direct (/client)."}
      </p>
      {message ? (
        <p role="alert" className="mt-2 text-sm text-cherry-600">
          {message}
        </p>
      ) : null}
      {status?.pendingSince || status?.takenAt ? null : (
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-ink-700">
          <li>В Telegram откройте @BotFather и отправьте /newbot.</li>
          <li>Придумайте имя и логин — логин должен кончаться на «bot». BotFather пришлёт токен вида 123456789:AA…</li>
          <li>Откройте своего нового бота и нажмите «Старт» (или добавьте его в рабочую группу и напишите там /start).</li>
          <li>Вставьте токен ниже. Номер чата можно не заполнять — сайт найдёт его сам по вашему /start.</li>
        </ol>
      )}
      <form method="post" action="/api/cabinet/ops-bot" className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm text-ink-700">Токен бота (из сообщения BotFather)</span>
          <input type="password" name="bot_token" required autoComplete="off" spellCheck={false} className={input} />
        </label>
        <label className="block">
          <span className="text-sm text-ink-700">Номер чата (необязательно)</span>
          <input type="text" name="bot_chat" inputMode="numeric" autoComplete="off" className={input} />
        </label>
        <button
          type="submit"
          className="w-full rounded bg-cherry-deep px-4 py-3 font-semibold text-cream-type shadow-sm hover:bg-cherry-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cherry-deep"
        >
          Проверить и сохранить
        </button>
      </form>
    </section>
  );
}
