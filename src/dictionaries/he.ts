import type { Dictionary } from "./uk";

/**
 * Hebrew dictionary. Key parity with uk.ts is compiler-enforced.
 *
 * RTL notes (brief §24): the page direction comes from getDirection() in
 * lib/i18n and lands on <html dir>. Copy here is written for RTL reading —
 * no left/right wording, and Latin handles/numbers are pinned with dir="ltr"
 * in the components that render them, never here.
 */
export const he: Dictionary = {
  meta: {
    title: "SHUR-SHUR — סוכנות תוכן מצ׳רנוביץ",
    description:
      "מצלמים, עורכים ומקדמים תוכן לרשתות החברתיות: הפקה, Reels, פרסום ממומן, מושן ופתרונות AI.",
    ogAlt: "SHUR-SHUR — סוכנות תוכן מצ׳רנוביץ.",
  },
  nav: {
    cases: "מקרי בוחן",
    packages: "חבילות",
    how: "איך עובדים",
    contact: "צור קשר",
    cta: "לדבר על הפרויקט",
    callLabel: "להתקשר",
    menuLabel: "ניווט בעמוד",
    skipToContent: "דלגו לתוכן",
  },
  langSwitcher: {
    label: "שפת האתר",
    current: "השפה הנוכחית",
  },
  hero: {
    titleLines: ["תוכן", "שמוכר", "לעסקים בישראל"],
    subtitle:
      "ימי צילום בתאריכי הביקור שלנו, ניהול רשתות ופרסום מרחוק — ומנהל פרויקט שמדבר עברית.",
    cta: "לדבר על הפרויקט",
    secondary: "לראות מקרי בוחן",
    direct: "לכתוב לנו בדיירקט",
  },
  work: {
    kicker: "תיק עבודות",
    heading: "העבודות שלנו",
    note: "צילמנו וערכנו עבור לקוחות.",
    groups: {
      beauty: { label: "ביוטי" },
      food: { label: "אוכל" },
      fashion: { label: "אופנה" },
      interior: { label: "עיצוב פנים" },
      estate: { label: "נדל״ן" },
    },
    playLabel: "הווידאו ללא קול",
  },
  process: {
    kicker: "איך זה נראה",
    heading: "ממאחורי הקלעים אל הפריים",
    sub: "צילום אחד, שני פריימים.",
    btsLabel: "מאחורי הקלעים",
    resultLabel: "התוצאה",
  },
  services: {
    kicker: "מה אנחנו עושים",
    heading: "שירותים",
    expand: "פרטים",
    collapse: "לסגור",
    items: [
      {
        title: "תוכן והפקה",
        tagline: "צילום, עריכה, רילס",
        points: [
          "סטילס, וידאו, צילום בנייד",
          "תסריטים, דוגמנים, לוקיישנים",
          "עריכה, כתוביות, סאונד",
        ],
      },
      {
        title: "רשתות חברתיות",
        tagline: "הפרופיל כולו",
        points: [
          "אסטרטגיה, לוח תוכן, עיצוב הפיד",
          "רילס, סטוריז, פוסטים",
          "אנליטיקה ודיווח",
        ],
      },
      {
        title: "פרסום ואסטרטגיה",
        tagline: "פניות, לא חשיפות",
        points: [
          "ניתוח נישה, אסטרטגיה, ייעוץ",
          "קריאייטיבים, השקה, אופטימיזציה",
          "Meta, Google, TikTok, Telegram Ads, X",
        ],
      },
      {
        title: "מושן, IT ו-AI",
        tagline: "אנימציה, אתרים, בוטים",
        points: [
          "סרטוני מושן, פוסטרים, לוגואים",
          "אתרים, דפי נחיתה, חנויות",
          "CRM, בק-אופיס, סוכני AI, צ׳אטבוטים",
        ],
      },
    ],
  },
  trust: {
    kicker: "עלינו",
    heading: "צוות אחד, הרבה מקומות",
    paragraphs: [
      "חלק מהצוות נמצא בצ׳רנוביץ, וחלק עובד מרחוק מערים וממדינות אחרות. אנחנו עובדים עם פרויקטים משווקים שונים, בכל מקום שבו אתם נמצאים.",
    ],
    facts: [
      { value: "11", label: "אנשים בצוות" },
      { value: "7", label: "תחומי שירות" },
      { value: "3", label: "מדינות שבהן כבר עבדנו" },
    ],
  },
  /* v4 B1.2: niche + what we made, from the portfolio's own alt texts.
     Brand, task and result are slots in lib/cases — empty, not drawn. */
  cases: {
    kicker: "מקרי בוחן",
    heading: "מה עשינו ללקוחות",
    did: "מה עשינו",
    task: "המשימה",
    result: "התוצאה",
    all: "כל העבודות",
    items: {
      bridal: {
        niche: "מותג שמלות כלה",
        did: "סרט תדמית לסלון, תפירת שמלה בתקריב, צילום שחור-לבן באטלייה",
      },
      restaurant: {
        niche: "מסעדה איטלקית",
        did: "רילס מהמטבח, סטוריז לתפריט העונתי של המרפסת, הגשת פסטה ויין",
      },
      bodycare: {
        niche: "מותג טיפוח לגוף",
        did: "צילום מוצר של בלם במים — מאחורי הקלעים ועד הפריים המוגמר",
      },
      leisure: {
        niche: "מתחם נופש",
        did: "סטוריז עם הזמנה לשריין בקתה ולוח תאריכים פנויים",
      },
      wellness: {
        niche: "סטודיו ולנס",
        did: "רילס מטיפול עיסוי וסטוריז עם הזמנה לקבוע תור",
      },
    },
  },
  /* v4 B1.3: the bullets are services.items[0..2]; the «від» price lives
     in lib/business and is drawn only when it exists. */
  packages: {
    kicker: "חבילות",
    heading: "מאיפה מתחילים",
    from: "החל מ־",
    ask: "לברר מחיר",
    names: {
      shoot: "יום צילום",
      social: "ניהול רשתות · חודש",
      ads: "פרסום · חודש",
    },
    extra: "וגם: מושן, אתרים, בוטים ו-AI — לפי המשימה.",
  },
  /* v4 B1.4: four steps in the market's own terms. Facts from the brief
     (A4/B2) — every line awaits the owner's confirmation in the PR. */
  how: {
    kicker: "איך עובדים",
    heading: "עם ישראל",
    steps: [
      {
        title: "כותבים לנו",
        text: "עונים בעברית, בוואטסאפ או במסנג׳ר שנוח לכם.",
      },
      {
        title: "מצלמים",
        text: "ימי צילום בישראל בתאריכי הביקור שלנו — או שאתם מצלמים בטלפון לפי התסריט שלנו, והעריכה עלינו.",
      },
      {
        title: "מנהלים ומפרסמים",
        text: "את הרשתות והפרסום אנחנו מנהלים מרחוק.",
      },
      {
        title: "תשלום ולוחות זמנים",
        text: "תנאי תשלום ולוחות זמנים נסגרים בכתב לפני ההתחלה.",
      },
    ],
  },
  /* v4 B1.5–B1.6: headings only — the section renders when lib/business
     has people / reviews, and not at all before. */
  team: {
    kicker: "הצוות",
    heading: "עם מי עובדים",
  },
  reviews: {
    kicker: "המלצות",
    heading: "מה הלקוחות אומרים",
  },
  /* v4 B1.7: conservative answers; rights to the material is a question
     for the owner, not answered here. */
  faq: {
    kicker: "שאלות",
    heading: "שאלות נפוצות",
    items: [
      {
        q: "באיזו שפה אתם עובדים?",
        a: "עברית, אנגלית, אוקראינית ורומנית — כתבו איך שנוח לכם.",
      },
      {
        q: "איפה אתם מצלמים?",
        a: "בישראל — בימי צילום בתאריכי הביקור שלנו. בין הביקורים — אתם מצלמים בטלפון לפי התסריט שלנו.",
      },
      {
        q: "אפשר לעבוד לגמרי מרחוק?",
        a: "כן. ניהול רשתות, עריכה מהחומר שלכם, פרסום, מושן, אתרים ובוטים — בלי פגישה.",
      },
      {
        q: "כמה זה עולה?",
        a: "תלוי בהיקף. כתבו מה צריך, ונגיד מחיר במסנג׳ר.",
      },
      {
        q: "איך משלמים מישראל?",
        a: "אמצעי התשלום והמסמכים נסגרים לפני ההתחלה.",
      },
      {
        q: "מתי רואים תוצאה?",
        a: "לוחות הזמנים תלויים במשימה. אנחנו קובעים אותם לפני ההתחלה, בכתב.",
      },
    ],
  },
  audit: {
    kicker: "בחינם",
    heading: "ניתוח האינסטגרם שלכם",
    sub: "נגיד מה לשנות בתוכן.",
    delivery: "נחזור אליכם במסנג׳ר שלכם.",
    channelsLabel: "או כתבו לנו ישירות",
    form: {
      igLabel: "שם המשתמש באינסטגרם",
      igPlaceholder: "@your_business",
      contactLabel: "מסנג׳ר או טלפון",
      contactPlaceholder: "@nickname או ‎+380…",
      submit: "לקבל ניתוח",
      submitting: "שולחים…",
      successTitle: "קיבלנו!",
      successText: "נסתכל על הפרופיל ונחזור אליכם.",
      successAgain: "לשלוח עוד אחד",
      retry: "לנסות שוב",
      failures: {
        rate_limited: {
          title: "הבקשה שלכם כבר אצלנו",
          text: "שלחתם כמה בקשות ברצף — כולן הגיעו אלינו. הטופס יקבל בקשה חדשה בעוד כ־10 דקות. אם דחוף, כתבו או התקשרו אלינו ישירות:",
        },
        invalid_json: {
          title: "הבקשה הגיעה פגומה",
          text: "הנתונים אבדו בדרך — קורה בחיבור לא יציב. נסו שוב, ואם זה חוזר — כתבו לנו ישירות:",
        },
        invalid_input: {
          title: "בדקו מה כתוב בשדות",
          text: "שם המשתמש: 2–60 תווים באותיות לטיניות, ספרות, נקודה וקו תחתון, @ לא חובה. איש קשר: טלגרם או מספר טלפון, לפחות 3 תווים. תקנו ושלחו שוב.",
        },
        delivery_failed: {
          title: "הבקשה לא הגיעה אלינו",
          text: "החיבור למסנג׳ר שלנו לא עובד כרגע, וניסיון נוסף כנראה ייגמר באותו אופן. הדרך המהירה אלינו היא לכתוב או להתקשר:",
        },
        network: {
          title: "החיבור נותק",
          text: "הבקשה בכלל לא יצאה: הרשת נעלמה או שלא הגיעה תשובה תוך 15 שניות. בדקו את החיבור ונסו שוב.",
        },
        unknown: {
          title: "משהו השתבש",
          text: "השרת החזיר שגיאה שלא ציפינו לה. נסו שוב, ואם זה חוזר — כתבו לנו ישירות:",
        },
      },
      errors: {
        igHandle: "הזינו שם משתמש: 2–60 תווים, @ לא חובה",
        contact: "הזינו מסנג׳ר או טלפון (לפחות 3 תווים)",
      },
    },
  },
  footer: {
    tagline: "סוכנות תוכן מצ׳רנוביץ",
    email: "אימייל",
    nav: "ניווט",
    socials: "רשתות",
    contacts: "פרטי קשר",
    city: "צ׳רנוביץ, אוקראינה",
    rights: "כל הזכויות שמורות",
    madeIn: "נעשה עם דובדבנים בצ׳רנוביץ",
  },
  contactBar: {
    open: "לדבר על הפרויקט",
    close: "לסגור",
    label: "דרכים ליצור קשר",
    channels: {
      telegram: "Telegram",
      whatsapp: "WhatsApp",
      viber: "Viber",
      instagram: "Instagram Direct",
    },
  },
  /* ждёт проверки носителем — cookie banner copy, written 29.09.2026 without a native reviewer. */
  consent: {
    label: "הסכמה לעוגיות",
    text: "אנחנו משתמשים רק במה שנחוץ לפעולת האתר. באישורכם — גם בעוגיות פרסום של Meta, כדי לדעת איזו פרסומת מביאה פניות.",
    necessary: "רק ההכרחי",
    allowAds: "לאשר עוגיות פרסום",
    settings: "הגדרות עוגיות",
  },
  thanks: {
    metaTitle: "הבקשה התקבלה — SHUR-SHUR",
    home: "לדף הראשי",
  },
  notFound: {
    metaTitle: "הדף לא נמצא — SHUR-SHUR",
    heading: "הדף הזה לא קיים",
    text: "ייתכן שיש טעות בכתובת או שהדף הוסר. כל מה שאנחנו עושים מרוכז בדף הראשי.",
    home: "לדף הראשי",
    chooseLanguage: "בחרו שפה",
  },
};
