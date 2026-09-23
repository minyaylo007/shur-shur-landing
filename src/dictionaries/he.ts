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
    work: "עבודות",
    services: "שירותים",
    about: "עלינו",
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
    titleLines: ["מייצרים", "תוכן", "שמוכר"],
    subtitle: "הפקה, עריכה, רשתות חברתיות, פרסום.",
    cta: "לדבר על הפרויקט",
    secondary: "לראות עבודות",
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
  notFound: {
    metaTitle: "הדף לא נמצא — SHUR-SHUR",
    heading: "הדף הזה לא קיים",
    text: "ייתכן שיש טעות בכתובת או שהדף הוסר. כל מה שאנחנו עושים מרוכז בדף הראשי.",
    home: "לדף הראשי",
    chooseLanguage: "בחרו שפה",
  },
};
