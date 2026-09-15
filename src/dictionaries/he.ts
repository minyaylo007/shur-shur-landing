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
      "מצלמים, עורכים ומקדמים תוכן לרשתות החברתיות: הפקה, Reels, פרסום ממומן, מושן ופתרונות AI. צוות של 11 אנשים בצ׳רנוביץ, אוקראינה.",
    ogAlt: "SHUR-SHUR — סוכנות תוכן מצ׳רנוביץ.",
  },
  nav: {
    work: "עבודות",
    services: "שירותים",
    about: "עלינו",
    contact: "צור קשר",
    cta: "לדבר על הפרויקט",
    menuLabel: "ניווט בעמוד",
    skipToContent: "דלגו לתוכן",
    callLabel: "להתקשר",
  },
  langSwitcher: {
    label: "שפת האתר",
    uk: "Укр",
    en: "Eng",
    he: "עב",
    ro: "Rom",
  },
  hero: {
    badge: "סוכנות תוכן • צ׳רנוביץ",
    titleLines: ["מייצרים", "תוכן", "שמוכר"],
    subtitle:
      "מעגל מלא: הפקה, עריכה, ניהול רשתות חברתיות ופרסום ממומן. אוקראינה, רומניה, ישראל.",
    cta: "לדבר על הפרויקט",
    contactLabel: "או ישירות:",
    scrollHint: "לעבודות שלנו",
  },
  work: {
    kicker: "תיק עבודות",
    heading: "העבודות שלנו",
    sub: "צולם, נערך ופורסם על ידי הצוות של SHUR-SHUR.",
    groups: {
      beauty: { label: "ביוטי ומוצר", note: "צילומי סטודיו לקוסמטיקה וטיפוח" },
      food: { label: "אוכל ואירוח", note: "בתי קפה, מסעדות, מאפיות" },
      bridal: { label: "אופנה וחתונות", note: "צילומים בלוקיישן" },
      stories: { label: "סטוריז ורילס", note: "קריאייטיבים מוגמרים שעשינו עבור לקוחות" },
    },
    playLabel: "הווידאו מתנגן ללא קול",
  },
  process: {
    kicker: "איך זה נראה",
    heading: "ממאחורי הקלעים אל הפריים",
    sub: "צילום קוסמטיקה אחד: תחילה התהליך בסטודיו, אחר כך הפריים המוגמר עבור הלקוח.",
    btsLabel: "מאחורי הקלעים",
    resultLabel: "התוצאה",
  },
  services: {
    kicker: "מה אנחנו עושים",
    heading: "שירותים",
    sub: "ארבעה תחומים. אפשר לפתוח כל אחד מהם לפרטים.",
    expand: "פרטים",
    collapse: "לסגור",
    items: [
      {
        title: "תוכן והפקה",
        tagline: "צילום, עריכה ורילסים מוגמרים — מרעיון ועד פרסום",
        points: [
          "צילומי סטילס ווידאו מקצועיים",
          "צילום בנייד",
          "תסריטים לרילס ולטיקטוק",
          "ליהוק דוגמנים ואיתור לוקיישנים",
          "עריכה, כתוביות, עיצוב סאונד",
          "התאמה לכל פלטפורמה",
        ],
      },
      {
        title: "ניהול רשתות חברתיות",
        tagline: "הפרופיל כולו: אסטרטגיה, תוכנית תוכן, סטוריז יומיים",
        points: [
          "אסטרטגיית תוכן",
          "רילס, סטוריז ופוסטים",
          "לוח תוכן",
          "עיצוב הפיד",
          "אנליטיקה ודיווח",
        ],
      },
      {
        title: "פרסום ואסטרטגיה",
        tagline: "פניות ומכירות, לא רק חשיפות",
        points: [
          "ניתוח נישה ומתחרים",
          "אסטרטגיית פרסום",
          "קריאייטיבים לקמפיינים",
          "השקה ואופטימיזציה",
          "Meta, Google, TikTok, Telegram Ads, X",
          "ייעוץ שיווקי ותוכנית צמיחה",
        ],
      },
      {
        title: "מושן, IT ו-AI",
        tagline: "אנימציה, אתרים ואוטומציה לעסק שלכם",
        points: [
          "פוסטרים מונפשים וסרטוני פרסום",
          "אנימציית לוגו, קריאייטיבים מונפשים",
          "אתרים, דפי נחיתה, חנויות אונליין",
          "מערכות CRM ובק-אופיס",
          "סוכני AI, צ׳אטבוטים, אינטגרציות",
        ],
      },
    ],
  },
  trust: {
    kicker: "עלינו",
    heading: "צוות מצ׳רנוביץ",
    paragraphs: [
      "SHUR-SHUR הוא צוות של 11 אנשים שחיים תוכן: מצלמים, עורכים, מנפישים, מנהלים פרסום ובונים פתרונות AI. לכל תחום יש מומחה משלו.",
      "אנחנו עובדים עם עסקים בכל רחבי אוקראינה ויוצאים לשווקים בינלאומיים — בין הלקוחות שלנו כבר יש פרויקטים מרומניה ומישראל.",
    ],
    facts: [
      { value: "11", label: "אנשים בצוות" },
      { value: "7", label: "תחומי שירות" },
      { value: "3", label: "מדינות פעילות" },
    ],
    knownBy: {
      label: "מכירים אותנו:",
      names: [
        "רדיו Bukovynska Khvylia",
        "אולם הטקסטיל Tulpan",
        "מועדון הטניס ACE",
        "מותג האופנה IRONY",
      ],
    },
    quotes: {
      caption: "תגובות ופוסטים אמיתיים עלינו באינסטגרם, במקור באוקראינית.",
      items: [
        { text: "Дай Боже", source: "תגובה מתחת לפוסט ההיכרות שלנו" },
        { text: "Горжусь!!", source: "תגובה מתחת לפוסט ההיכרות שלנו" },
        {
          text: "Навчання з @lexi.brzvsk Кольорокорекція, робота зі стабілізатором, правильні налаштування камери…",
          source: "@pafos.art — פוסט על הדרכה עם הצוות שלנו",
        },
      ],
    },
  },
  audit: {
    kicker: "בחינם",
    heading: "ניתוח האינסטגרם שלכם",
    sub: "נסתכל על הפרופיל ונגיד מה לשנות בתוכן כדי שיביא פניות.",
    delivery: "נחזור אליכם בטלגרם או בשיחה — איך שנוח לכם.",
    channelsLabel: "או כתבו לנו ישירות",
    cityLine: "צ׳רנוביץ, אוקראינה",
    form: {
      igLabel: "שם המשתמש באינסטגרם",
      igPlaceholder: "@your_business",
      contactLabel: "טלגרם או מספר טלפון",
      contactPlaceholder: "@nickname או ‎+380…",
      submit: "לקבל ניתוח",
      submitting: "שולחים…",
      successTitle: "קיבלנו!",
      successText: "נסתכל על הפרופיל ונחזור אליכם לפרטי הקשר שהשארתם.",
      successAgain: "לשלוח עוד אחד",
      errorTitle: "משהו השתבש",
      errorText: "השליחה נכשלה. נסו שוב או כתבו לנו ישירות:",
      retry: "לנסות שוב",
      errors: {
        igHandle: "הזינו שם משתמש: 2–60 תווים, @ לא חובה",
        contact: "הזינו טלגרם או טלפון (לפחות 3 תווים)",
      },
    },
  },
  footer: {
    tagline: "סוכנות תוכן מצ׳רנוביץ",
    nav: "ניווט",
    socials: "רשתות",
    contacts: "פרטי קשר",
    city: "צ׳רנוביץ, אוקראינה",
    rights: "כל הזכויות שמורות",
    madeIn: "נעשה עם דובדבנים בצ׳רנוביץ",
  },
  contactBar: {
    open: "ליצור קשר",
    close: "לסגור",
    label: "דרכים ליצור קשר",
    channels: {
      telegram: "Telegram",
      whatsapp: "WhatsApp",
      viber: "Viber",
      instagram: "Instagram Direct",
    },
  },
  notFound: {
    metaTitle: "הדף לא נמצא — SHUR-SHUR",
    heading: "הדף הזה לא קיים",
    text: "ייתכן שיש טעות בכתובת או שהדף הוסר. כל מה שאנחנו עושים מרוכז בדף הראשי.",
    home: "לדף הראשי",
    chooseLanguage: "בחרו שפה",
  },
};
