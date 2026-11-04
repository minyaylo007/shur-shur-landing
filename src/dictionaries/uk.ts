/**
 * Ukrainian dictionary — SOURCE OF TRUTH for the Dictionary type.
 * en.ts / he.ts / ro.ts must satisfy `Dictionary`, so key parity is
 * compiler-enforced: a new string here fails the build until all four
 * locales carry it.
 *
 * Redesign v3 (discrepancy §8) — visible prose down ~44%. Four moves:
 *   1. Keys that only repeated a promise the page already makes are gone:
 *      `hero.badge` (the city, on the FIRST SCREEN — §1), `hero.contactLabel`,
 *      `hero.scrollHint`, `work.sub`, `services.sub`, `audit.cityLine`.
 *      Two keys v3 also listed here came BACK when the redesign met
 *      production on 20.09.2026, and neither is visible prose:
 *      `nav.callLabel` is the accessible name of the one remaining `tel:`
 *      link (footer, and the form's failure state — a production fix of
 *      15.09), and `contactBar.channels.viber` names a channel that is live
 *      in production on the same number as WhatsApp. A key that a rendered
 *      channel needs is not decoration; see the note beside `messengers` in
 *      lib/site.
 *   2. Portfolio group notes — five sentences that all said the same thing —
 *      collapsed into ONE `work.note`, and the labels became one-word chips.
 *   3. The 22 service bullets were MERGED into 12. Not one of the seven real
 *      service directions was dropped; micro-services that used to be ranked
 *      alongside whole directions («Мобільна зйомка», «Підбір моделей»,
 *      «Оформлення стрічки», «Маркетингова консультація») now sit inside the
 *      line they belong to.
 *   4. `trust.paragraphs` went from two paragraphs to one sentence. It used
 *      to read «Одинадцять людей у Чернівцях. Працюємо в Україні, Румунії та
 *      Ізраїлі» — both halves were wrong, and the owner said so on
 *      23.09.2026: the eleven are not all in Chernivtsi (part of the team is
 *      remote, in other cities and countries), and three countries is where
 *      the agency has WORKED, not a boundary around who it can work with.
 *      The sentence now says the team is hybrid and the market is open, and
 *      the third fact's label moved from «країни присутності» to «країни, де
 *      вже працювали» — same self-reported figure, no longer a limit. The
 *      city itself stays where it is true: metadata, footer, the hero clip.
 *
 * Nothing factual was invented — every figure is self-reported by the agency
 * and already existed in the project.
 */
const dict = {
  meta: {
    title: "SHUR-SHUR — контент-агенція з Чернівців",
    description:
      "Знімаємо, монтуємо й просуваємо контент для соцмереж: зйомка, Reels, таргетована реклама, motion та AI-рішення.",
    ogAlt: "SHUR-SHUR — контент-агенція з Чернівців.",
  },
  nav: {
    cases: "Кейси",
    packages: "Пакети",
    how: "Як працюємо",
    contact: "Контакти",
    cta: "Обговорити проєкт",
    /* Не видимий підпис, а доступне імʼя для tel:-посилання — воно лишилось
       рівно в двох місцях: у підвалі й усередині відмови форми. v3 прибрав
       ключ разом із телефоном із шапки; сама відмова форми — правка бою від
       15.09, і зчитувач екрана має читати там «Зателефонувати», а не набір
       цифр. Тому ключ повертається. */
    callLabel: "Зателефонувати",
    menuLabel: "Навігація по сторінці",
    skipToContent: "Перейти до контенту",
  },
  /* §2: the switcher is a disclosure, and the language NAMES are autonyms
     from lib/i18n — never translated, never flags. Only the labels the
     control needs for screen readers live here. */
  langSwitcher: {
    label: "Мова сайту",
    current: "Поточна мова",
  },
  /* §5 + §1 + §6: one statement, one short line, ONE primary action.
     No city badge, no row of competing contact links. */
  hero: {
    titleLines: ["ЗНІМАЄМО", "КОНТЕНТ,", "ЯКИЙ ПРОДАЄ"],
    subtitle:
      "Для кафе, салонів, брендів одягу й нерухомості: знімаємо, монтуємо, ведемо соцмережі й рекламу — у Чернівцях і дистанційно.",
    cta: "Обговорити проєкт",
    secondary: "Дивитись кейси",
    direct: "Написати в Direct",
  },
  work: {
    kicker: "Портфоліо",
    heading: "НАШІ РОБОТИ",
    /* §12 of the v2 brief, said ONCE instead of five times: these are finished
       creatives made FOR clients, so client branding inside the frame reads as
       a work sample rather than as the site's own copy. */
    note: "Зняли й змонтували для клієнтів.",
    /* Industry filters, not formats — a restaurateur looks for food, not for
       «Reels». One word each: these are chips, not sentences. */
    groups: {
      beauty: { label: "Б’ЮТІ" },
      food: { label: "ЇЖА" },
      fashion: { label: "FASHION" },
      interior: { label: "ІНТЕР’ЄР" },
      estate: { label: "НЕРУХОМІСТЬ" },
    },
    playLabel: "Відео без звуку",
  },
  process: {
    kicker: "Як це виглядає",
    heading: "ВІД БЕКСТЕЙДЖУ ДО КАДРУ",
    sub: "Одна зйомка, два кадри.",
    btsLabel: "Бекстейдж",
    resultLabel: "Результат",
  },
  /* Four directions, 12 bullets instead of 22 — merged, not deleted. */
  services: {
    kicker: "Що ми робимо",
    heading: "ПОСЛУГИ",
    expand: "Детальніше",
    collapse: "Згорнути",
    items: [
      {
        title: "Контент і продакшн",
        tagline: "Зйомка, монтаж, Reels",
        points: [
          "Фото, відео, мобільна зйомка",
          "Сценарії, моделі, локації",
          "Монтаж, субтитри, звук",
        ],
      },
      {
        title: "Ведення соцмереж",
        tagline: "Профіль під ключ",
        points: [
          "Стратегія, контент-план, оформлення",
          "Reels, сторіс, пости",
          "Аналітика та звітність",
        ],
      },
      {
        title: "Реклама і стратегія",
        tagline: "Заявки, а не покази",
        points: [
          "Аналіз ніші, стратегія, консультація",
          "Креативи, запуск, оптимізація",
          "Meta, Google, TikTok, Telegram Ads, X",
        ],
      },
      {
        title: "Motion, IT та AI",
        tagline: "Анімація, сайти, боти",
        points: [
          "Motion-ролики, афіші, логотипи",
          "Сайти, лендинги, магазини",
          "CRM, бек-офіс, AI-агенти, чат-боти",
        ],
      },
    ],
  },
  trust: {
    kicker: "Про нас",
    heading: "ОДНА КОМАНДА, БАГАТО МІСЦЬ",
    paragraphs: [
      "Частина команди — у Чернівцях, частина працює дистанційно з інших міст і країн. Беремо проєкти з різних ринків — незалежно від того, де ви.",
    ],
    facts: [
      { value: "11", label: "людей у команді" },
      { value: "7", label: "напрямів послуг" },
      { value: "3", label: "країни, де вже працювали" },
    ],
  },
  /* v4 B1.2: niche + what we made, from the portfolio's own alt texts.
     Brand, task and result are slots in lib/cases — empty, not drawn. */
  cases: {
    kicker: "Кейси",
    heading: "ЩО МИ ЗРОБИЛИ ДЛЯ КЛІЄНТІВ",
    did: "Що зробили",
    task: "Задача",
    result: "Результат",
    all: "Усі роботи",
    items: {
      bridal: {
        niche: "Весільний бренд",
        did: "Імідж-ролик салону, виробництво сукні в деталях, чорно-біла зйомка ательє",
      },
      restaurant: {
        niche: "Італійський ресторан",
        did: "Reels із кухні, сторіс сезонного меню веранди, подача пасти й вина",
      },
      bodycare: {
        niche: "Бренд догляду за тілом",
        did: "Предметна зйомка бальзаму у воді — від бекстейджу до готового кадру",
      },
      leisure: {
        niche: "Комплекс відпочинку",
        did: "Сторіс із запрошенням забронювати котедж і календарем вільних дат",
      },
      wellness: {
        niche: "Велнес-студія",
        did: "Reels із процедури масажу й сторіс із запрошенням на запис",
      },
    },
  },
  /* v4 B1.3: the bullets are services.items[0..2]; the «від» price lives
     in lib/business and is drawn only when it exists. */
  packages: {
    kicker: "Пакети",
    heading: "З ЧОГО ПОЧАТИ",
    from: "від",
    ask: "Дізнатись ціну",
    names: {
      shoot: "Знімальний день",
      social: "Ведення соцмереж · місяць",
      ads: "Реклама · місяць",
    },
    extra: "Також: motion, сайти, боти й AI-рішення — під задачу.",
  },
  /* v4 B1.4: four steps in the market's own terms. Facts from the brief
     (A4/B2) — every line awaits the owner's confirmation in the PR. */
  how: {
    kicker: "Як працюємо",
    heading: "З ВАШИМ МІСТОМ",
    steps: [
      {
        title: "Пишете нам",
        text: "Відповідаємо українською — у месенджері, який вам зручний.",
      },
      {
        title: "Знімаємо",
        text: "У Чернівцях — приїжджаємо до вас. В іншому місті ви знімаєте на телефон за нашим сценарієм, а монтуємо ми.",
      },
      {
        title: "Ведемо й запускаємо",
        text: "Соцмережі й рекламу ведемо дистанційно — де б ви не були.",
      },
      {
        title: "Оплата й терміни",
        text: "Умови оплати й терміни узгоджуємо до старту, письмово.",
      },
    ],
  },
  /* v4 B1.5–B1.6: headings only — the section renders when lib/business
     has people / reviews, and not at all before. */
  team: {
    kicker: "Команда",
    heading: "ХТО З ВАМИ ПРАЦЮЄ",
  },
  reviews: {
    kicker: "Відгуки",
    heading: "ЩО КАЖУТЬ КЛІЄНТИ",
  },
  /* v4 B1.7: conservative answers; rights to the material is a question
     for the owner, not answered here. */
  faq: {
    kicker: "Питання",
    heading: "ЧАСТІ ПИТАННЯ",
    items: [
      {
        q: "Якою мовою ви працюєте?",
        a: "Українською, англійською, румунською й івритом — пишіть так, як вам зручно.",
      },
      {
        q: "Де ви знімаєте?",
        a: "У Чернівцях — на місці. В інших містах — виїзні зйомки за домовленістю або ваша зйомка на телефон за нашим сценарієм.",
      },
      {
        q: "Чи можна працювати повністю дистанційно?",
        a: "Так. Ведення соцмереж, монтаж із вашого матеріалу, реклама, motion, сайти й боти не потребують зустрічі.",
      },
      {
        q: "Скільки це коштує?",
        a: "Залежить від обсягу. Напишіть, що потрібно, — назвемо ціну в месенджері.",
      },
      {
        q: "Як оплатити з-за кордону?",
        a: "Спосіб оплати й документи узгоджуємо до старту — під вашу країну.",
      },
      {
        q: "Коли буде результат?",
        a: "Терміни залежать від задачі. Називаємо їх до старту й фіксуємо письмово.",
      },
    ],
  },
  audit: {
    kicker: "Безкоштовно",
    heading: "РОЗБІР ВАШОГО INSTAGRAM",
    sub: "Скажемо, що змінити в контенті.",
    delivery: "Відповімо у ваш месенджер.",
    channelsLabel: "Або напишіть напряму",
    form: {
      igLabel: "Нікнейм в Instagram",
      igPlaceholder: "@vash_biznes",
      contactLabel: "Месенджер або телефон",
      contactPlaceholder: "@nickname або +380…",
      submit: "Отримати розбір",
      submitting: "Надсилаємо…",
      successTitle: "Прийнято!",
      successText: "Подивимось профіль і звʼяжемося з вами.",
      successAgain: "Надіслати ще один",
      retry: "Спробувати ще раз",
      /* Один текст на чотири різні відмови — це була неправда: при 429 заявка
         вже в нас, при 400 повтор дасть те саме. Тепер кожен випадок каже, що
         сталося і що робити; поведінка кнопки й каналів — у lib/lead-failure. */
      failures: {
        rate_limited: {
          title: "Заявку вже прийнято",
          text: "Ви надіслали кілька заявок поспіль — усі вони в нас. Нову форма прийме приблизно за 10 хвилин. Якщо терміново, напишіть або зателефонуйте напряму:",
        },
        invalid_json: {
          title: "Заявка дійшла пошкодженою",
          text: "Дані загубилися дорогою — так буває на нестабільному звʼязку. Спробуйте ще раз, а якщо повториться — напишіть напряму:",
        },
        invalid_input: {
          title: "Перевірте, що у полях",
          text: "Нікнейм — 2–60 символів латиницею, цифри, крапка й підкреслення, можна з @. Контакт — Telegram або телефон, від 3 символів. Виправте й надішліть ще раз.",
        },
        delivery_failed: {
          title: "Ми не отримали вашу заявку",
          text: "Звʼязок із нашим месенджером зараз не працює, і повторна спроба, найімовірніше, дасть те саме. Найшвидший шлях до нас — написати або зателефонувати:",
        },
        network: {
          title: "Звʼязок обірвався",
          text: "Заявка навіть не пішла: зник інтернет або відповідь не прийшла за 15 секунд. Перевірте звʼязок і спробуйте ще раз.",
        },
        unknown: {
          title: "Щось пішло не так",
          text: "Сервер відповів помилкою, якої ми не очікували. Спробуйте ще раз, а якщо повториться — напишіть напряму:",
        },
      },
      errors: {
        igHandle: "Вкажіть нікнейм: 2–60 символів, можна з @",
        contact: "Вкажіть месенджер або телефон (від 3 символів)",
      },
    },
  },
  footer: {
    tagline: "Контент-агенція з Чернівців",
    email: "Пошта",
    nav: "Навігація",
    socials: "Соцмережі",
    contacts: "Контакти",
    city: "Чернівці, Україна",
    rights: "Всі права захищено",
    madeIn: "Зроблено з вишнями у Чернівцях",
  },
  /* §6: ONE contact control. Один ключ на кожен канал воріт із lib/channels —
     Viber у бою увімкнений і стоїть на тому самому номері, що WhatsApp, тому
     підпис для нього тут обовʼязковий: без нього канал вийшов би в панель із
     порожнім рядком. */
  contactBar: {
    open: "Обговорити проєкт",
    close: "Закрити",
    label: "Способи звʼязку",
    channels: {
      telegram: "Telegram",
      whatsapp: "WhatsApp",
      viber: "Viber",
      instagram: "Instagram Direct",
    },
  },
  /* 404 — a document of its own (src/app/global-not-found.tsx), so the copy
     below is all it needs: it borrows nothing from the page shell. No
     messenger links here on purpose — the way out of a dead address is a
     LIVE page of the site, where every channel is already gathered. */
  /* Банер згоди на cookie (29.09.2026). Дві рівні кнопки: відмова має бути
     такою ж простою, як дозвіл. За замовчуванням — нічого рекламного. */
  consent: {
    label: "Згода на cookie",
    text: "Ми використовуємо лише необхідне для роботи сайту. З вашого дозволу — ще рекламні cookie Meta, щоб бачити, яка реклама приводить заявки.",
    necessary: "Лише необхідне",
    allowAds: "Дозволити рекламні cookie",
    settings: "Налаштування cookie",
  },
  /* Сторінка подяки після прийнятої заявки (01.10.2026). Заголовок і текст — audit.form.successTitle/successText. */
  thanks: {
    metaTitle: "Заявку прийнято — SHUR-SHUR",
    home: "На головну",
  },
  notFound: {
    metaTitle: "Сторінку не знайдено — SHUR-SHUR",
    heading: "ТАКОЇ СТОРІНКИ НЕМАЄ",
    text: "Можливо, в адресі помилка або сторінку прибрали. Усе, що ми робимо, зібрано на головній.",
    home: "На головну",
    chooseLanguage: "Оберіть мову",
  },
};

export type Dictionary = typeof dict;
export const uk: Dictionary = dict;
