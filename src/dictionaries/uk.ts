/**
 * Ukrainian dictionary — SOURCE OF TRUTH for the Dictionary type.
 * en.ts / he.ts / ro.ts must satisfy `Dictionary`, so key parity is
 * compiler-enforced: a new string here fails the build until all four
 * locales carry it.
 *
 * Redesign v2 (brief §3): visible copy is roughly half of what v1 shipped.
 * Nothing factual was invented — every figure below already existed in the
 * project and is self-reported by the agency (team size, number of service
 * directions, countries). The v1 «кейси» figures and aggregate counters were
 * removed rather than restated: they were marked in code as an illustrative
 * placeholder set, and brief §16/§28 forbid presenting unverified numbers as
 * client results.
 */
const dict = {
  meta: {
    title: "SHUR-SHUR — контент-агенція з Чернівців",
    description:
      "Знімаємо, монтуємо й просуваємо контент для соцмереж: зйомка, Reels, таргетована реклама, motion та AI-рішення. Команда з 11 людей у Чернівцях.",
    ogAlt: "SHUR-SHUR — контент-агенція з Чернівців.",
  },
  nav: {
    work: "Роботи",
    services: "Послуги",
    about: "Про нас",
    contact: "Контакти",
    cta: "Обговорити проєкт",
    menuLabel: "Навігація по сторінці",
    skipToContent: "Перейти до контенту",
    callLabel: "Зателефонувати",
  },
  langSwitcher: {
    label: "Мова сайту",
    uk: "Укр",
    en: "Eng",
    he: "עב",
    ro: "Rom",
  },
  /* Brief §5: one statement, one supporting line, ONE primary CTA, and
     direct contact within reach. The audit form moved to its own section. */
  hero: {
    badge: "Контент-агенція • Чернівці",
    titleLines: ["ЗНІМАЄМО", "КОНТЕНТ,", "ЯКИЙ ПРОДАЄ"],
    subtitle:
      "Повний цикл: зйомка, монтаж, ведення соцмереж і таргетована реклама. Україна, Румунія, Ізраїль.",
    cta: "Обговорити проєкт",
    contactLabel: "Або одразу:",
    scrollHint: "Наші роботи",
  },
  /* Brief §7: the portfolio sits immediately after the hero. */
  work: {
    kicker: "Портфоліо",
    heading: "НАШІ РОБОТИ",
    sub: "Знято, змонтовано й опубліковано командою SHUR-SHUR.",
    groups: {
      beauty: { label: "Б’ЮТІ ТА ПРЕДМЕТКА", note: "Студійна зйомка косметики й догляду" },
      food: { label: "ЇЖА ТА ЗАКЛАДИ", note: "Кав’ярні, ресторани, пекарні" },
      bridal: { label: "FASHION І ВЕСІЛЛЯ", note: "Виїзні зйомки на локаціях" },
      /* Framing required for §12: these are finished creatives the agency
         produced FOR clients, so client branding inside the frame reads as
         a work sample rather than as the site's own copy. */
      stories: { label: "STORIES ТА REELS", note: "Готові креативи, які ми зробили для клієнтів" },
    },
    playLabel: "Відео відтворюється без звуку",
  },
  /* Brief §8: behind the scenes → finished frame, one shoot, one product. */
  process: {
    kicker: "Як це виглядає",
    heading: "ВІД БЕКСТЕЙДЖУ ДО КАДРУ",
    sub: "Одна зйомка косметики: спершу процес у студії, потім готовий кадр для клієнта.",
    btsLabel: "Бекстейдж",
    resultLabel: "Результат",
  },
  /* Brief §15: the same seven real services, grouped into four. Nothing was
     invented and nothing was dropped — the detail lists below hold every
     bullet the v1 cards carried, just collapsed by default. */
  services: {
    kicker: "Що ми робимо",
    heading: "ПОСЛУГИ",
    sub: "Чотири напрями. Розгорніть будь-який, щоб побачити деталі.",
    expand: "Детальніше",
    collapse: "Згорнути",
    items: [
      {
        title: "Контент і продакшн",
        tagline: "Зйомка, монтаж і готові Reels — від ідеї до публікації",
        points: [
          "Професійна фото- та відеозйомка",
          "Мобільна зйомка",
          "Сценарії для Reels та TikTok",
          "Підбір моделей та локацій",
          "Монтаж, субтитри, звуковий дизайн",
          "Адаптація під кожну платформу",
        ],
      },
      {
        title: "Ведення соцмереж",
        tagline: "Профіль під ключ: стратегія, контент-план, щоденні сторіс",
        points: [
          "Контент-стратегія",
          "Reels, сторіс та пости",
          "Контент-план",
          "Оформлення стрічки",
          "Аналітика та звітність",
        ],
      },
      {
        title: "Реклама і стратегія",
        tagline: "Заявки та продажі, а не просто покази",
        points: [
          "Аналіз ніші та конкурентів",
          "Рекламна стратегія",
          "Креативи для кампаній",
          "Запуск та оптимізація",
          "Meta, Google, TikTok, Telegram Ads, X",
          "Маркетингова консультація й план розвитку",
        ],
      },
      {
        title: "Motion, IT та AI",
        tagline: "Анімація, сайти й автоматизація під ваш бізнес",
        points: [
          "Анімовані афіші та рекламні ролики",
          "Анімація логотипів, motion-креативи",
          "Сайти, лендинги, інтернет-магазини",
          "CRM та бек-офіс системи",
          "AI-агенти, чат-боти, інтеграції",
        ],
      },
    ],
  },
  /* Brief §17: one consolidated proof block instead of the four separate
     «trust us» sections v1 shipped (about + team + numbers + wall of love). */
  trust: {
    kicker: "Про нас",
    heading: "КОМАНДА З ЧЕРНІВЦІВ",
    paragraphs: [
      "SHUR-SHUR — команда з 11 людей, яка живе контентом: знімає, монтує, анімує, запускає рекламу та будує AI-рішення. Кожен напрям закриває окремий спеціаліст.",
      "Працюємо з бізнесами по всій Україні й виходимо на міжнародні ринки — серед клієнтів уже є проєкти з Румунії та Ізраїлю.",
    ],
    facts: [
      { value: "11", label: "людей у команді" },
      { value: "7", label: "напрямів послуг" },
      { value: "3", label: "країни присутності" },
    ],
    knownBy: {
      label: "Нас знають:",
      /* Order matches knownHandles in src/lib/posts.ts (verified accounts). */
      names: [
        "радіо «Буковинська Хвиля»",
        "салон текстилю «Тюльпан»",
        "тенісний клуб ACE",
        "бренд одягу IRONY",
      ],
    },
    /* Brief §28: never fake social proof. These are verbatim real comments
       and post excerpts from verified Instagram posts. */
    quotes: {
      caption: "З коментарів та дописів про нас в Instagram — дослівно.",
      items: [
        { text: "Дай Боже", source: "коментар під постом-знайомством" },
        { text: "Горжусь!!", source: "коментар під постом-знайомством" },
        {
          /* Trailing «…» = honest truncation marker: an excerpt of a longer post. */
          text: "Навчання з @lexi.brzvsk Кольорокорекція, робота зі стабілізатором, правильні налаштування камери…",
          source: "@pafos.art — допис про навчання з нашою командою",
        },
      ],
    },
  },
  /* Brief §20: two fields, clear delivery, no «за 24 години» promise — that
     was a guarantee the business never actually made. */
  audit: {
    kicker: "Безкоштовно",
    heading: "РОЗБІР ВАШОГО INSTAGRAM",
    sub: "Подивимось ваш профіль і скажемо, що змінити в контенті, щоб він приносив заявки.",
    delivery: "Відповідь надішлемо в Telegram або зателефонуємо — як вам зручніше.",
    channelsLabel: "Або напишіть напряму",
    cityLine: "Чернівці, Україна",
    form: {
      igLabel: "Нікнейм в Instagram",
      igPlaceholder: "@vash_biznes",
      contactLabel: "Telegram або номер телефону",
      contactPlaceholder: "@nickname або +380…",
      submit: "Отримати розбір",
      submitting: "Надсилаємо…",
      successTitle: "Прийнято!",
      successText: "Ми подивимось профіль і звʼяжемося з вами вказаним контактом.",
      successAgain: "Надіслати ще один",
      errorTitle: "Щось пішло не так",
      errorText: "Не надіслалося. Спробуйте ще раз або напишіть нам напряму:",
      retry: "Спробувати ще раз",
      errors: {
        igHandle: "Вкажіть нікнейм: 2–60 символів, можна з @",
        contact: "Вкажіть Telegram або телефон (від 3 символів)",
      },
    },
  },
  footer: {
    tagline: "Контент-агенція з Чернівців",
    nav: "Навігація",
    socials: "Соцмережі",
    contacts: "Контакти",
    city: "Чернівці, Україна",
    rights: "Всі права захищено",
    madeIn: "Зроблено з вишнями у Чернівцях",
  },
  /* Brief §19: ONE contact control, not three or four floating circles. */
  contactBar: {
    open: "Звʼязатися з нами",
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
