import type { Dictionary } from "./uk";

/**
 * Hebrew dictionary — idiomatic translation, typed against the UA source.
 * This is the only RTL locale (see `getDirection` in lib/i18n): the layout
 * flips via `dir="rtl"` on <html>, the copy below carries no direction logic.
 *
 * Latin brand/format words (SMM, Reels, TikTok, Motion Design, CRM, AI) stay
 * Latin on purpose — that is how the Israeli market writes them, and the
 * Hebrew font pair loaded for this locale keeps a latin subset for exactly
 * this reason.
 */
export const he: Dictionary = {
  meta: {
    title: "SHUR-SHUR — סוכנות SMM עסיסית מצ'רניבצי",
    description:
      "סוכנות סושיאל מדיה מקצה לקצה: תוכן, קמפיינים ממומנים, עריכת וידאו, motion design ופתרונות AI. צוות של 11 אנשים בצ'רניבצי, אוקראינה — עובדים עם לקוחות בכל העולם.",
    ogAlt: "SHUR-SHUR — סוכנות SMM. דובדבנים עסיסיים מאחורי כותרת ענקית.",
  },
  nav: {
    services: "שירותים",
    cases: "קייסים",
    about: "עלינו",
    team: "הצוות",
    contact: "צור קשר",
    cta: "מתחילים פרויקט",
    menuLabel: "ניווט בדף",
    skipToContent: "דלגו לתוכן",
  },
  langSwitcher: {
    label: "שפת האתר",
    uk: "Укр",
    en: "Eng",
    he: "עב",
    ro: "Rom",
  },
  hero: {
    badge: "סוכנות SMM • צ'רניבצי",
    titleLines: ["SMM", "ותוכן", "עסיסיים"],
    subtitle:
      "הופכים את הרשתות החברתיות למכונת לקוחות: אסטרטגיה, תוכן, קמפיינים ממומנים, motion ו-AI — הכול תחת קורת גג אחת.",
    rotatingWords: ["SMM", "REELS", "ממומן", "תוכן"],
    cta: "רוצה תוכן עסיסי",
    secondaryCta: "השירותים שלנו",
    scrollHint: "גללו",
    posterAlt: "דובדבן בשל ומבריק — סמל המותג של SHUR-SHUR",
    stats: [
      { value: "11", label: "אנשים בצוות" },
      { value: "7", label: "תחומי שירות" },
      { value: "3+", label: "מדינות של לקוחות" },
    ],
    audit: {
      title: "אודיט אינסטגרם בחינם",
      label: "שם המשתמש שלכם באינסטגרם",
      placeholder: "@ha_asak_sheli",
      submit: "קבלו אודיט",
      submitting: "שולחים…",
      note: "ניתוח תוך 24 שעות",
      successTitle: "התקבל!",
      successText: "הניתוח יגיע אליכם ב-Direct תוך 24 שעות.",
      errorText: "השליחה נכשלה. נסו שוב או כתבו לנו ב-Direct.",
      retry: "נסו שוב",
      errorHandle: "הזינו שם משתמש: 2–60 תווים, אפשר עם @",
    },
  },
  marquee: {
    items: ["SMM", "REELS", "ממומן", "תוכן", "MOTION", "AI"],
  },
  pain: {
    kicker: "מכירים את זה?",
    heading: "מנהלים אינסטגרם ואין פניות?",
    pains: [
      "הפוסטים יוצאים בזמן, והמכירות פשוט לא מגיעות",
      "המתחרים אוספים את הלקוחות שלכם דרך קמפיינים ממומנים",
      "התוכן בולע את כל הזמן שהיה צריך ללכת לעסק",
    ],
    cta: "הנה מה שעושים עם זה",
  },
  services: {
    kicker: "מה אנחנו עושים",
    heading: "השירותים שלנו",
    sub: "שבעה תחומים — מהרעיון הראשון ועד לפניות ב-Direct שלכם.",
    scrollNote: "גללו כדי לראות את כל השירותים",
    items: [
      {
        title: "ניהול SMM מקיף",
        badge: "מקיף",
        tagline: "כל מה שצריך לקידום העסק, בחבילה אחת",
        points: [
          "אסטרטגיית תוכן",
          "Reels, סטוריז ופוסטים",
          "צילומי סטילס ווידאו",
          "עריכת תוכן",
          "קמפיינים ממומנים",
          "לוח תוכן",
          "אנליטיקה ודיווח",
        ],
        outcome: "עובדים מקצה לקצה כדי שהתוכן יביא מכירות, לא רק חשיפות.",
      },
      {
        title: "קמפיינים ממומנים",
        badge: "תוצאות",
        tagline: "פניות, מכירות ולקוחות חדשים — לא רק חשיפות",
        points: [
          "ניתוח נישה ומתחרים",
          "אסטרטגיית פרסום",
          "קריאייטיב לקמפיינים",
          "השקה ואופטימיזציה",
          "דיווח שקוף",
        ],
        outcome: "פלטפורמות: Meta, Google, TikTok, Telegram Ads, X.",
      },
      {
        title: "הפקת תוכן שלמה",
        badge: "הכול עלינו",
        tagline: "תוכן מוכן לפרסום — לרשתות, לקמפיינים ולאתר",
        points: [
          "צילומי סטילס ווידאו מקצועיים",
          "הפקה מובילית",
          "תסריטים ל-Reels ול-TikTok",
          "איתור דוגמנים ולוקיישנים",
          "עריכה ופוסט-פרודקשן",
        ],
        outcome: "מהרעיון ועד הפרסום — כל ההפקה עלינו.",
      },
      {
        title: "עריכת וידאו",
        badge: "דינמיקה",
        tagline: "סרטונים שעוצרים את הגלילה",
        points: [
          "Reels ו-TikTok",
          "כתוביות",
          "עיצוב סאונד",
          "גרפיקה ואנימציה",
          "התאמה לכל פלטפורמה",
        ],
        outcome: "קצב מהיר, סאונד נקי ופורמט מדויק לכל רשת.",
      },
      {
        title: "Motion Design",
        badge: "אפקט wow",
        tagline: "אנימציה שמחייה את המותג",
        points: [
          "פוסטרים מונפשים",
          "סרטוני פרסום",
          "אנימציית לוגו",
          "קריאייטיב מונפש לקמפיינים",
        ],
        outcome: "התנועה תופסת תשומת לב — אנחנו הופכים אותה לשפה של המותג.",
      },
      {
        title: "ייעוץ שיווקי",
        badge: "אסטרטגיה",
        tagline: "תוכנית צמיחה ברורה במקום ניחושים",
        points: [
          "ניתוח העסק והרשתות",
          "אסטרטגיית תוכן",
          "מפת דרכים לצמיחה",
        ],
        outcome: "מקבלים צעדים קונקרטיים, לא עצות כלליות.",
      },
      {
        title: "פתרונות IT ואוטומציית AI",
        badge: "עתיד",
        tagline: "מדף נחיתה פשוט ועד אקוסיסטם דיגיטלי שלם",
        points: [
          "אתרים ודפי נחיתה",
          "חנויות אונליין",
          "מערכות CRM ובק-אופיס",
          "סוכני AI לעסקים",
          "אוטומציה של תהליכים",
          "צ'אטבוטים ואינטגרציות",
          "אפליקציות ווב ומובייל",
        ],
        outcome: "טכנולוגיה שעובדת בשביל העסק שלכם 24/7.",
      },
    ],
  },
  cases: {
    kicker: "קייסים",
    heading: "מספרים, לא הבטחות",
    sub: "תוצאות טיפוסיות של הפורמטים שלנו — קייסים מלאים עם שמות נראה בשיחה.",
    micro: "רוצה גם",
    items: [
      { num: "01", niche: "בית קפה, צ'רניבצי", value: "+4 180", context: "עוקבים בחצי שנה" },
      { num: "02", niche: "סלון יופי", value: "×3.2", context: "חשיפות ב-90 יום" },
      { num: "03", niche: "חנות למוצרי בית", value: "215", context: "פניות מ-reels בכל חודש" },
      { num: "04", niche: "מסעדה", value: "4.7%", context: "מדד מעורבות, עלה מ-1.1%" },
    ],
    reels: {
      kicker: "פריימים מה-reels שלנו",
      alts: [
        "פריים מ-reel: מאחורי הקלעים של צילומי תוכן ללקוח",
        "פריים מ-reel: motion design בעבודה",
        "פריים מ-reel: השקת קמפיין ממומן",
        "פריים מ-reel: פירוק אסטרטגיה בפגישת ייעוץ",
      ],
    },
    knownBy: {
      label: "אפשר להכיר אותנו מ:",
      names: [
        "רדיו בוקובינסקה חוויליה",
        "סלון הטקסטיל טולפן",
        "מועדון הטניס ACE",
        "מותג הבגדים IRONY",
      ],
    },
  },
  numbers: {
    heading: "הסוכנות במספרים",
    items: [
      { value: 27, decimals: 0, suffix: "", label: "חשבונות בניהול" },
      { value: 4.2, decimals: 1, suffix: "M", label: "חשיפות בשנה החולפת" },
      { value: 850, decimals: 0, suffix: "+", label: "reels שהופקו" },
      { value: 11, decimals: 0, suffix: "", label: "אנשים בצוות" },
    ],
  },
  about: {
    kicker: "מי אנחנו",
    heading: "סוכנות מצ'רניבצי",
    paragraphs: [
      "SHUR-SHUR הם 11 אנשים שחיים תוכן: מצלמים, עורכים, מנפישים, מריצים קמפיינים ובונים פתרונות AI.",
      "אנחנו עובדים עם עסקים בכל אוקראינה ומתרחבים לשווקים בינלאומיים — ברשימת הלקוחות שלנו יש כבר פרויקטים מרומניה ומישראל.",
    ],
    geoLabel: "עובדים עם",
    geo: ["אוקראינה", "רומניה", "ישראל", "כל העולם"],
    highlight: "עסיסי. נועז. שיטתי.",
  },
  team: {
    kicker: "הצוות",
    heading: "11 אנשים שעושים את זה עסיסי",
    sub: "כל תחום שירות באחריות מומחה משלו — בלי פרילנסרים רנדומליים.",
    roles: [
      { title: "מומחי SMM", desc: "אסטרטגיה, תוכניות תוכן וניהול חשבונות" },
      { title: "יוצרי סטוריז", desc: "סטוריז יומיים שמחזיקים את הקהל" },
      { title: "מעצבים גרפיים", desc: "איידנטיטי, באנרים ועיצוב הפיד" },
      { title: "מעצב Motion", desc: "אנימציה, סרטוני פרסום ואנימציות לוגו" },
      { title: "מנהל קמפיינים", desc: "קמפיינים ב-Meta, Google, TikTok ו-Telegram" },
      { title: "מפתחי Web/IT", desc: "אתרים, חנויות, CRM ואינטגרציות" },
      { title: "תחום AI", desc: "תוכן AI, סוכנים ואוטומציה" },
    ],
  },
  socials: {
    kicker: "מיישמים על עצמנו",
    heading: "העסיסי ביותר מ-@shur.shur.agency",
    sub: "האינסטגרם שלנו הוא הפורטפוליו הטוב ביותר. שישה פוסטים שאנחנו אוהבים במיוחד.",
    gridLabel: "מקבץ נבחר של פוסטים מהאינסטגרם שלנו",
    ctaInstagram: "עקבו אחרינו",
    ctaTelegram: "Telegram",
    /* Real community comments, shown verbatim in the original Ukrainian —
       no invented testimonials (brief §9). */
    wallOfLove: {
      caption: "מתגובות ומפוסטים עלינו באינסטגרם — מילה במילה, במקור האוקראיני.",
      quotes: [
        { text: "Дай Боже", source: "תגובה מתחת לפוסט ההיכרות עם הצוות" },
        { text: "Горжусь!!", source: "תגובה מתחת לפוסט ההיכרות עם הצוות" },
        {
          /* Trailing «…» = honest truncation marker — excerpt of a longer
             post, the caption promises "verbatim" (REM-FIX-C4). */
          text: "Навчання з @lexi.brzvsk Кольорокорекція, робота зі стабілізатором, правильні налаштування камери…",
          source: "@pafos.art — פוסט על הכשרה עם הצוות שלנו",
        },
      ],
    },
  },
  contact: {
    kicker: "צור קשר",
    heading: "בואו נעבוד יחד",
    sub: "השאירו פנייה — נחזור אליכם באותו יום עסקים עם הרעיונות הראשונים לפרויקט.",
    scarcity: "לוקחים 3 מותגים חדשים בחודש — כדי שלכל אחד תהיה תשומת לב מלאה.",
    channelsLabel: "או כתבו לנו ישירות",
    cityLine: "צ'רניבצי, אוקראינה",
    form: {
      name: "השם שלכם",
      namePlaceholder: "איך לקרוא לכם?",
      contact: "איך להשיג אתכם",
      contactPlaceholder: "Telegram, Instagram, טלפון או אימייל",
      message: "על הפרויקט שלכם",
      messagePlaceholder: "בקצרה: העסק, המטרות, מה כואב (לא חובה)",
      messageOptional: "לא חובה",
      submit: "שליחת פנייה",
      submitting: "שולחים…",
      successTitle: "הפנייה התקבלה!",
      successText: "תודה! נחזור אליכם במהלך יום העסקים הקרוב.",
      successAgain: "לשלוח עוד אחת",
      errorTitle: "משהו השתבש",
      errorText: "הפנייה לא נשלחה. נסו שוב או כתבו לנו ישירות:",
      retry: "נסו שוב",
      errors: {
        name: "הזינו שם (לפחות 2 תווים)",
        contact: "הזינו פרטי קשר (לפחות 3 תווים)",
        message: "ההודעה ארוכה מדי (עד 1000 תווים)",
      },
    },
  },
  footer: {
    tagline: "SMM ותוכן עסיסיים",
    nav: "ניווט",
    socials: "רשתות חברתיות",
    rights: "כל הזכויות שמורות",
    madeIn: "נעשה עם דובדבנים בצ'רניבצי",
  },
  fab: {
    open: "כתבו לנו במסנג'ר",
    close: "סגירת רשימת המסנג'רים",
    label: "מסנג'רים ליצירת קשר",
    channels: {
      telegram: "Telegram",
      whatsapp: "WhatsApp",
      viber: "Viber",
      instagram: "Instagram Direct",
    },
  },
  stickyCta: {
    cta: "רוצה עסיסי",
    telegramLabel: "כתבו לנו ב-Telegram",
  },
};
