"use client";

import { useState } from "react";

/* How she gets her Meta key, for someone who has never seen a developer
   page: one step open at a time, a «сделала» tick opens the next. Button
   names are given in Russian and, in brackets, in English — Meta shows its
   interface in whatever language her profile has. */

interface Step {
  title: string;
  link?: { href: string; label: string };
  body: React.ReactNode;
  expect: string;
  stuck: React.ReactNode;
}

const B = ({ ru, en }: { ru: string; en: string }) => (
  <>
    <strong>«{ru}»</strong> <span className="text-ink-500">({en})</span>
  </>
);

const STEPS: Step[] = [
  {
    title: "Что нужно до начала",
    link: { href: "https://business.facebook.com/settings", label: "business.facebook.com/settings" },
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Компьютер или ноутбук — на телефоне нужные страницы открываются не полностью.</li>
        <li>Вход в Facebook под тем профилем, через который вы запускаете рекламу.</li>
        <li>
          Бизнес-портфолио — это «папка» вашей компании в Meta, где лежат рекламный аккаунт и пиксель. Откройте
          ссылку выше: если открылись <B ru="Настройки компании" en="Business settings" /> с названием компании
          слева вверху — портфолио есть, можно дальше.
        </li>
        <li>
          Если портфолио нет: откройте business.facebook.com/overview → <B ru="Создать аккаунт" en="Create an account" />{" "}
          → название компании, ваше имя, почта → <B ru="Отправить" en="Submit" />. Потом в настройках:{" "}
          <B ru="Аккаунты" en="Accounts" /> → <B ru="Рекламные аккаунты" en="Ad accounts" /> →{" "}
          <B ru="Добавить" en="Add" /> → <B ru="Добавить рекламный аккаунт" en="Add an ad account" />.
        </li>
      </ul>
    ),
    expect: "Открываются «Настройки компании», слева вверху — название вашей компании.",
    stuck: (
      <>
        Если страница пишет, что доступа нет, — вы не администратор портфолио. Попросите того, кто его создавал, дать
        вам <B ru="Полный доступ" en="Full control" />.
      </>
    ),
  },
  {
    title: "Создать приложение",
    link: { href: "https://developers.facebook.com/apps", label: "developers.facebook.com/apps" },
    body: (
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Нажмите <B ru="Создать приложение" en="Create app" />. Это не настоящее приложение для телефона — просто
          «пропуск», через который будет работать ключ.
        </li>
        <li>Название — например, «SHUR stats»; почта — ваша.</li>
        <li>
          На вопросе о назначении выберите <B ru="Другое" en="Other" /> → <B ru="Далее" en="Next" />, тип —{" "}
          <B ru="Бизнес" en="Business" /> → <B ru="Далее" en="Next" />.
        </li>
        <li>
          Если спросит про бизнес-портфолио — выберите своё. Нажмите <B ru="Создать приложение" en="Create app" /> (может
          попросить пароль от Facebook).
        </li>
      </ol>
    ),
    expect: "Открывается панель приложения, слева вверху — его название.",
    stuck: (
      <>
        Если кнопки нет, а вверху справа <B ru="Начать" en="Get started" /> — Meta ещё не знает вас как разработчика:
        нажмите её, подтвердите телефон или почту, в вопросе «кто вы» выберите любой вариант — и вернитесь по ссылке.
      </>
    ),
  },
  {
    title: "Завести служебного пользователя",
    link: { href: "https://business.facebook.com/settings/system-users", label: "business.facebook.com/settings/system-users" },
    body: (
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Это не человек, а служебная учётная запись, у которой будет ключ. Нажмите <B ru="Добавить" en="Add" />.
        </li>
        <li>
          Имя: <strong>shur-stats</strong>. Роль: <B ru="Сотрудник" en="Employee" /> — не администратор.
        </li>
        <li>
          Нажмите <B ru="Создать системного пользователя" en="Create system user" />.
        </li>
      </ol>
    ),
    expect: "В списке «Системные пользователи» (System users) появился shur-stats.",
    stuck: (
      <>
        Если Meta просит сначала принять условия — нажмите <B ru="Принять" en="Accept" />. Если раздела «Системные
        пользователи» нет: слева <B ru="Пользователи" en="Users" /> → <B ru="Системные пользователи" en="System users" />;
        его не видно без полного доступа к портфолио (шаг 0).
      </>
    ),
  },
  {
    title: "Дать доступ: аккаунт и пиксель",
    link: { href: "https://business.facebook.com/settings/system-users", label: "business.facebook.com/settings/system-users" },
    body: (
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Нажмите на shur-stats → <B ru="Назначить ресурсы" en="Assign assets" />.
        </li>
        <li>
          <B ru="Рекламные аккаунты" en="Ad accounts" /> → отметьте ваш аккаунт → включите только{" "}
          <B ru="Просмотр результатов" en="View performance" /> → <B ru="Сохранить изменения" en="Save changes" />.
        </li>
        <li>
          Снова <B ru="Назначить ресурсы" en="Assign assets" /> → <B ru="Пиксели" en="Pixels" /> (или{" "}
          <B ru="Наборы данных" en="Datasets" />) → ваш пиксель → <B ru="Управление" en="Manage" /> →{" "}
          <B ru="Сохранить изменения" en="Save changes" />.
        </li>
        <li>
          И ещё раз: <B ru="Приложения" en="Apps" /> → приложение из шага 1 → <B ru="Управление" en="Manage" /> →{" "}
          сохранить. Без этого его не будет в списке на следующем шаге.
        </li>
      </ol>
    ),
    expect: "У shur-stats в «Назначенных ресурсах» (Assigned assets) видны рекламный аккаунт, пиксель и приложение.",
    stuck: (
      <>
        Если вашего аккаунта или пикселя нет в списке — они не добавлены в портфолио: <B ru="Аккаунты" en="Accounts" />{" "}
        → <B ru="Рекламные аккаунты" en="Ad accounts" /> (или <B ru="Наборы данных" en="Datasets" />) →{" "}
        <B ru="Добавить" en="Add" />.
      </>
    ),
  },
  {
    title: "Создать ключ доступа",
    link: { href: "https://business.facebook.com/settings/system-users", label: "business.facebook.com/settings/system-users" },
    body: (
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Нажмите на shur-stats → <B ru="Сгенерировать новый маркер" en="Generate new token" /> («маркер» здесь и есть
          ключ доступа).
        </li>
        <li>Приложение — то, что создали в шаге 1.</li>
        <li>
          Срок действия — <B ru="Никогда" en="Never" />.
        </li>
        <li>
          В списке разрешений поставьте одну галочку: <strong>ads_read</strong>. Больше ничего не нужно.
        </li>
        <li>
          <B ru="Сгенерировать" en="Generate" /> → <B ru="Копировать" en="Copy" />.
        </li>
      </ol>
    ),
    expect: "Появилась длинная строка из латинских букв и цифр, обычно начинается с «EAA».",
    stuck: (
      <>
        Ключ показывается один раз — если окно закрылось, просто создайте новый, это не страшно. Если в списке нет
        вашего приложения — вернитесь к шагу 3, пункт про <B ru="Приложения" en="Apps" />. Никому не пересылайте ключ в
        мессенджерах — только в поле ниже.
      </>
    ),
  },
  {
    title: "Найти два номера",
    link: { href: "https://adsmanager.facebook.com", label: "adsmanager.facebook.com" },
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Номер рекламного аккаунта.</strong> Откройте Ads Manager по ссылке выше и посмотрите в адресную
          строку: цифры после <code>act=</code> — это он. Или в настройках компании:{" "}
          <B ru="Рекламные аккаунты" en="Ad accounts" /> → номер под названием аккаунта.
        </li>
        <li>
          <strong>Номер пикселя.</strong> Откройте business.facebook.com/events_manager2 → слева выберите пиксель →
          номер под его названием (<B ru="Идентификатор" en="ID" />) или во вкладке <B ru="Настройки" en="Settings" />.
        </li>
      </ul>
    ),
    expect: "Два номера из одних цифр. Номер аккаунта можно копировать вместе с «act_».",
    stuck: <>Если пикселей несколько — нужен тот, что стоит на сайте shur-shur.com.</>,
  },
  {
    title: "Вставить и проверить",
    body: (
      <p>
        Вставьте ключ и два номера в поля ниже и нажмите <strong>«Проверить и сохранить»</strong>. Сайт сразу спросит у
        Meta, подходит ли ключ, и скажет результат.
      </p>
    ),
    expect: "Надпись «Подключено» и название вашего рекламного аккаунта.",
    stuck: <>Если появилась ошибка — под полями будет написано, что не так и какой шаг повторить.</>,
  },
];

export function MetaGuide() {
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));
  const [open, setOpen] = useState(0);

  const tick = (i: number, value: boolean) => {
    const next = done.map((d, j) => (j === i ? value : d));
    setDone(next);
    if (value && i + 1 < STEPS.length) setOpen(i + 1);
  };

  return (
    <ol className="space-y-2">
      {STEPS.map((step, i) => (
        <li key={step.title} className="rounded border border-paper-200 bg-white">
          <button
            type="button"
            onClick={() => setOpen(open === i ? -1 : i)}
            aria-expanded={open === i}
            className="flex w-full items-center gap-3 px-3 py-2 text-left"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                done[i] ? "bg-cherry-deep text-cream-type" : "border border-ink-500"
              }`}
              aria-hidden
            >
              {done[i] ? "✓" : i}
            </span>
            <span className="font-medium">
              Шаг {i}. {step.title}
            </span>
          </button>
          {open === i ? (
            <div className="space-y-3 border-t border-paper-100 px-3 py-3 text-sm">
              {step.link ? (
                <p>
                  Откройте:{" "}
                  <a href={step.link.href} target="_blank" rel="noopener noreferrer" className="underline">
                    {step.link.label}
                  </a>
                </p>
              ) : null}
              {step.body}
              <p>
                <span className="font-medium">Что должно появиться:</span> {step.expect}
              </p>
              <p className="text-ink-700">
                <span className="font-medium">Если не видите кнопку:</span> {step.stuck}
              </p>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={done[i]} onChange={(e) => tick(i, e.target.checked)} />
                <span>сделала</span>
              </label>
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
