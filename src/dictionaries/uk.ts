/**
 * Ukrainian dictionary — SOURCE OF TRUTH for the Dictionary type.
 * en.ts / he.ts / ro.ts must satisfy `Dictionary`, so key parity is
 * compiler-enforced: a new string here fails the build until all four
 * locales carry it.
 *
 * Redesign v3 (discrepancy §8) — visible prose down ~44%. Four moves:
 *   1. Keys that only repeated a promise the page already makes are gone:
 *      `hero.badge` (the city, on the FIRST SCREEN — §1), `hero.contactLabel`,
 *      `hero.scrollHint`, `nav.callLabel`, `work.sub`, `services.sub`,
 *      `audit.cityLine`, `contactBar.channels.viber`.
 *   2. Portfolio group notes — five sentences that all said the same thing —
 *      collapsed into ONE `work.note`, and the labels became one-word chips.
 *   3. The 22 service bullets were MERGED into 12. Not one of the seven real
 *      service directions was dropped; micro-services that used to be ranked
 *      alongside whole directions («Мобільна зйомка», «Підбір моделей»,
 *      «Оформлення стрічки», «Маркетингова консультація») now sit inside the
 *      line they belong to.
 *   4. `trust.paragraphs` went from two paragraphs to one sentence. The
 *      geography that used to close the hero subtitle lives there: low on the
 *      page, small, beside the team fact it actually supports (§1).
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
    work: "Роботи",
    services: "Послуги",
    about: "Про нас",
    contact: "Контакти",
    cta: "Обговорити проєкт",
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
    subtitle: "Зйомка, монтаж, соцмережі, реклама.",
    cta: "Обговорити проєкт",
    secondary: "Дивитись роботи",
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
    heading: "КОМАНДА З ЧЕРНІВЦІВ",
    paragraphs: ["Одинадцять людей у Чернівцях. Працюємо в Україні, Румунії та Ізраїлі."],
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
    /* Brief §28: never fake social proof. Verbatim comments and post excerpts
       from verified Instagram posts. */
    quotes: {
      caption: "З Instagram, дослівно.",
      items: [
        { text: "Дай Боже", source: "коментар під постом" },
        { text: "Горжусь!!", source: "коментар під постом" },
        {
          /* Trailing «…» = honest truncation marker: an excerpt of a longer post. */
          text: "Навчання з @lexi.brzvsk Кольорокорекція, робота зі стабілізатором, правильні налаштування камери…",
          source: "@pafos.art, допис",
        },
      ],
    },
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
      errorTitle: "Щось пішло не так",
      errorText: "Не надіслалося. Спробуйте ще раз або напишіть напряму:",
      retry: "Спробувати ще раз",
      errors: {
        igHandle: "Вкажіть нікнейм: 2–60 символів, можна з @",
        contact: "Вкажіть месенджер або телефон (від 3 символів)",
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
  /* §6: ONE contact control. Viber is gone — the channel does not exist. */
  contactBar: {
    open: "Обговорити проєкт",
    close: "Закрити",
    label: "Способи звʼязку",
    channels: {
      telegram: "Telegram",
      whatsapp: "WhatsApp",
      instagram: "Instagram Direct",
    },
  },
};

export type Dictionary = typeof dict;
export const uk: Dictionary = dict;
