/**
 * Ukrainian dictionary — SOURCE OF TRUTH for the Dictionary type.
 * en.ts must satisfy `Dictionary`, so key parity is compiler-enforced.
 */
const dict = {
  meta: {
    title: "SHUR-SHUR — соковита SMM-агенція з Чернівців",
    description:
      "SMM-агенція повного циклу: контент, таргетована реклама, монтаж, motion design та AI-рішення. Команда з 11 людей у Чернівцях. Працюємо з Україною та світом.",
    ogAlt: "SHUR-SHUR — SMM-агенція. Соковиті вишні та великий заголовок «Наші послуги».",
  },
  nav: {
    services: "Послуги",
    cases: "Кейси",
    about: "Про нас",
    team: "Команда",
    contact: "Контакти",
    cta: "Обговорити проєкт",
    menuLabel: "Навігація по сторінці",
    skipToContent: "Перейти до контенту",
  },
  langSwitcher: {
    label: "Мова сайту",
    uk: "Укр",
    en: "Eng",
    he: "עב",
    ro: "Rom",
  },
  hero: {
    badge: "SMM-агенція • Чернівці",
    titleLines: ["СОКОВИТИЙ", "SMM ТА", "КОНТЕНТ"],
    subtitle:
      "Перетворюємо соцмережі на джерело клієнтів: стратегія, контент, таргет, motion та AI — все в одному пакеті.",
    rotatingWords: ["SMM", "REELS", "ТАРГЕТ", "КОНТЕНТ"],
    cta: "Хочу соковитий контент",
    secondaryCta: "Наші послуги",
    scrollHint: "Гортайте",
    posterAlt: "Глянцева стигла вишня — фірмовий символ SHUR-SHUR",
    stats: [
      { value: "11", label: "людей у команді" },
      { value: "7", label: "напрямів послуг" },
      { value: "3+", label: "країни клієнтів" },
    ],
    /* Cycle 4 (brief §7.3): one-field free Instagram audit in the hero card.
       Same lead pipeline, kind="audit". */
    audit: {
      title: "Безкоштовний аудит Instagram",
      label: "Ваш нікнейм в Instagram",
      placeholder: "@vash_biznes",
      submit: "Отримати аудит",
      submitting: "Надсилаємо…",
      note: "розбір за 24 год",
      successTitle: "Прийнято!",
      successText: "Розбір буде в Direct протягом 24 год.",
      errorText: "Не надіслалося. Спробуйте ще раз або напишіть нам у Direct.",
      retry: "Спробувати ще раз",
      errorHandle: "Вкажіть нікнейм: 2–60 символів, можна з @",
    },
  },
  marquee: {
    items: ["SMM", "REELS", "ТАРГЕТ", "КОНТЕНТ", "MOTION", "AI"],
  },
  /* Cycle 4 (brief §7 copy layer): pain block right after the hero chapter —
     the Sociallyin pattern, brand «ти/ви» voice, funnels into Services. */
  pain: {
    kicker: "Знайомо?",
    heading: "ВЕДЕТЕ INSTAGRAM, А ЗАЯВОК НЕМАЄ?",
    pains: [
      "Пости виходять регулярно, а продажів з них — нуль",
      "Конкуренти забирають ваших клієнтів з таргета",
      "Контент зʼїдає весь час, який мав іти на бізнес",
    ],
    cta: "Ось що з цим робити",
  },
  services: {
    kicker: "Що ми робимо",
    heading: "НАШІ ПОСЛУГИ",
    sub: "Сім напрямів — від першої ідеї до заявок у вашому Direct.",
    scrollNote: "Гортайте, щоб переглянути всі послуги",
    items: [
      {
        title: "Комплексне SMM-ведення",
        badge: "комплексне",
        tagline: "Усе необхідне для просування бізнесу в одному пакеті",
        points: [
          "Контент-стратегія",
          "Reels, сторіс та пости",
          "Фото- та відеозйомка",
          "Монтаж контенту",
          "Таргетована реклама",
          "Контент-план",
          "Аналітика та звітність",
        ],
        outcome: "Працюємо комплексно, щоб контент приносив не лише охоплення, а й продажі.",
      },
      {
        title: "Таргетована реклама",
        badge: "результат",
        tagline: "Заявки, продажі та нові клієнти — а не просто покази",
        points: [
          "Аналіз ніші та конкурентів",
          "Рекламна стратегія",
          "Креативи для кампаній",
          "Запуск та оптимізація",
          "Звітність і прозорі результати",
        ],
        outcome: "Платформи: Meta, Google, TikTok, Telegram Ads, X.",
      },
      {
        title: "Контент під ключ",
        badge: "під ключ",
        tagline: "Готовий контент для соцмереж, реклами та сайту",
        points: [
          "Професійна фото- та відеозйомка",
          "Мобільна зйомка",
          "Сценарії для Reels та TikTok",
          "Підбір моделей та локацій",
          "Монтаж та обробка",
        ],
        outcome: "Від ідеї до публікації — повний продакшн на нашому боці.",
      },
      {
        title: "Монтаж відео",
        badge: "динаміка",
        tagline: "Відео, які зупиняють скрол",
        points: [
          "Reels та TikTok",
          "Субтитри",
          "Звуковий дизайн",
          "Графіка й анімації",
          "Адаптація під соцмережі",
        ],
        outcome: "Швидкий ритм, чистий звук і формат під кожну платформу.",
      },
      {
        title: "Motion Design",
        badge: "wow-ефект",
        tagline: "Анімація, що робить бренд живим",
        points: [
          "Анімовані афіші",
          "Рекламні ролики",
          "Анімація логотипів",
          "Motion-креативи для реклами",
        ],
        outcome: "Рух привертає увагу — ми робимо його фірмовим.",
      },
      {
        title: "Маркетингова консультація",
        badge: "стратегія",
        tagline: "Чіткий план розвитку замість здогадок",
        points: [
          "Аналіз бізнесу й соцмереж",
          "Контент-стратегія",
          "План розвитку",
        ],
        outcome: "Ви отримуєте конкретні кроки, а не загальні поради.",
      },
      {
        title: "IT-рішення та AI-автоматизація",
        badge: "майбутнє",
        tagline: "Від простого лендингу до повноцінної цифрової екосистеми",
        points: [
          "Розробка сайтів та лендингів",
          "Інтернет-магазини",
          "CRM та бек-офіс системи",
          "AI-агенти для бізнесу",
          "Автоматизація процесів",
          "Чат-боти та інтеграції",
          "Веб- та мобільні додатки",
        ],
        outcome: "Технології, які працюють на ваш бізнес 24/7.",
      },
    ],
  },
  /* Cycle 3 (brief §5) + REM-FIX-C3: the cards use the brief's ILLUSTRATIVE
     placeholder set — niches deliberately do NOT overlap with the verified
     «Нас знають» handles (no deanonymization), and the sub honestly frames
     the figures as typical format results (§9: never fake social proof).
     Spaced figures carry the NBSP group separator. */
  cases: {
    kicker: "Кейси",
    heading: "ЦИФРИ, А НЕ ОБІЦЯНКИ",
    sub: "Типові результати наших форматів — повні кейси з іменами покажемо на дзвінку.",
    micro: "Хочу так само",
    items: [
      { num: "01", niche: "Кав’ярня, Чернівці", value: "+4 180", context: "підписників за 6 місяців" },
      { num: "02", niche: "Салон краси", value: "×3.2", context: "охоплення за 90 днів" },
      { num: "03", niche: "Магазин товарів для дому", value: "215", context: "заявок з reels щомісяця" },
      { num: "04", niche: "Ресторан", value: "4.7%", context: "залученість зросла з 1.1%" },
    ],
    reels: {
      kicker: "Кадри з наших reels",
      /* Order matches the 4 phone mockups in PhoneReels.tsx. */
      alts: [
        "Кадр із reels: бекстейдж контент-зйомки для клієнта",
        "Кадр із reels: моушн-дизайн у роботі",
        "Кадр із reels: запуск таргетованої реклами",
        "Кадр із reels: розбір стратегії на консультації",
      ],
    },
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
  },
  /* Cycle 3 (brief §5 pattern 6+11): aggregate counters. The HTML ships the
     FINAL values (SEO/no-js); count-up is a visual-only enhancement. */
  numbers: {
    heading: "Агенція в цифрах",
    items: [
      { value: 27, decimals: 0, suffix: "", label: "акаунтів під веденням" },
      { value: 4.2, decimals: 1, suffix: "млн", label: "охоплень за рік" },
      { value: 850, decimals: 0, suffix: "+", label: "reels знято" },
      { value: 11, decimals: 0, suffix: "", label: "людей у команді" },
    ],
  },
  about: {
    kicker: "Хто ми",
    heading: "АГЕНЦІЯ З ЧЕРНІВЦІВ",
    paragraphs: [
      "SHUR-SHUR — це команда з 11 людей, яка живе контентом: знімає, монтує, анімує, запускає рекламу та будує AI-рішення.",
      "Ми працюємо з бізнесами по всій Україні та виходимо на міжнародні ринки — серед наших клієнтів уже є проєкти з Румунії та Ізраїлю.",
    ],
    geoLabel: "Працюємо з",
    geo: ["Україна", "Румунія", "Ізраїль", "Весь світ"],
    highlight: "Соковито. Сміливо. Системно.",
  },
  team: {
    kicker: "Команда",
    heading: "11 ЛЮДЕЙ, ЯКІ РОБЛЯТЬ СОКОВИТО",
    sub: "Кожен напрям закриває окремий спеціаліст — без фрилансу навмання.",
    roles: [
      { title: "SMM-спеціалісти", desc: "Стратегія, контент-плани, ведення профілів" },
      { title: "Сторісмейкери", desc: "Щоденні сторіс, які тримають аудиторію" },
      { title: "Графічні дизайнери", desc: "Айдентика, банери, оформлення стрічки" },
      { title: "Моушн-дизайнер", desc: "Анімація, рекламні ролики, лого-анімації" },
      { title: "Таргетолог", desc: "Реклама в Meta, Google, TikTok, Telegram" },
      { title: "Web/IT-розробники", desc: "Сайти, магазини, CRM, інтеграції" },
      { title: "AI-напрям", desc: "AI-контент, агенти та автоматизація" },
    ],
  },
  socials: {
    kicker: "Ми в соцмережах",
    /* Curated framing (brief §6): «найсоковитіше», not «останні пости». */
    heading: "Найсоковитіше з @shur.shur.agency",
    sub: "Найкраще портфоліо — наш власний Instagram. Шість постів, які ми любимо найбільше.",
    gridLabel: "Добірка постів з нашого Instagram",
    ctaInstagram: "Підписатися",
    ctaTelegram: "Telegram",
    /* Brief §9: НЕ фейкувати social proof. Тексти нижче — дослівні реальні
       коментарі/підписи з верифікованих постів (APPENDIX research). */
    wallOfLove: {
      caption: "З коментарів та дописів про нас в Instagram — дослівно.",
      quotes: [
        { text: "Дай Боже", source: "коментар під постом-знайомством" },
        { text: "Горжусь!!", source: "коментар під постом-знайомством" },
        {
          /* Trailing «…» = honest truncation marker: the caption promises
             «дослівно», and this is an excerpt of a longer post (REM-FIX-C4). */
          text: "Навчання з @lexi.brzvsk Кольорокорекція, робота зі стабілізатором, правильні налаштування камери…",
          source: "@pafos.art — допис про навчання з нашою командою",
        },
      ],
    },
  },
  contact: {
    kicker: "Контакти",
    heading: "ДАВАЙТЕ ПРАЦЮВАТИ",
    sub: "Залиште заявку — відповімо протягом робочого дня та запропонуємо перші ідеї для вашого проєкту.",
    /* Cycle 4 (brief §7): honest capacity positioning, NOT a fake timer (§9). */
    scarcity: "Беремо 3 нові бренди на місяць — щоб кожному вистачило уваги.",
    channelsLabel: "Або напишіть напряму",
    cityLine: "Чернівці, Україна",
    form: {
      name: "Ваше імʼя",
      namePlaceholder: "Як до вас звертатися?",
      contact: "Контакт для звʼязку",
      contactPlaceholder: "Telegram, Instagram, телефон або email",
      message: "Про ваш проєкт",
      messagePlaceholder: "Розкажіть коротко: бізнес, цілі, що болить (необовʼязково)",
      messageOptional: "необовʼязково",
      submit: "Надіслати заявку",
      submitting: "Надсилаємо…",
      successTitle: "Заявку отримано!",
      successText: "Дякуємо! Ми звʼяжемося з вами протягом робочого дня.",
      successAgain: "Надіслати ще одну",
      errorTitle: "Щось пішло не так",
      errorText: "Заявка не надіслалася. Спробуйте ще раз або напишіть нам напряму:",
      retry: "Спробувати ще раз",
      errors: {
        name: "Вкажіть імʼя (від 2 символів)",
        contact: "Вкажіть контакт (від 3 символів)",
        message: "Повідомлення задовге (до 1000 символів)",
      },
    },
  },
  footer: {
    tagline: "Соковитий SMM та контент",
    nav: "Навігація",
    socials: "Соцмережі",
    rights: "Всі права захищено",
    madeIn: "Зроблено з вишнями у Чернівцях",
  },
  /* Cycle 4 (brief §7.1): floating multi-messenger button. */
  fab: {
    open: "Написати нам у месенджер",
    close: "Закрити список месенджерів",
    label: "Месенджери для звʼязку",
    channels: {
      telegram: "Telegram",
      whatsapp: "WhatsApp",
      viber: "Viber",
      instagram: "Instagram Direct",
    },
  },
  /* Cycle 4 (brief §7.5): mobile sticky CTA bar, brand voice. */
  stickyCta: {
    cta: "Хочу соковито",
    telegramLabel: "Написати нам у Telegram",
  },
};

export type Dictionary = typeof dict;
export const uk: Dictionary = dict;
