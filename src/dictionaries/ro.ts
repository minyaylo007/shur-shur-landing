import type { Dictionary } from "./uk";

/** Romanian dictionary. Key parity with uk.ts is compiler-enforced. */
export const ro: Dictionary = {
  meta: {
    title: "SHUR-SHUR — agenție de conținut din Cernăuți",
    description:
      "Filmăm, montăm și promovăm conținut pentru rețelele sociale: producție, Reels, reclame plătite, motion și soluții AI.",
    ogAlt: "SHUR-SHUR — agenție de conținut din Cernăuți.",
  },
  nav: {
    work: "Lucrări",
    services: "Servicii",
    about: "Despre noi",
    contact: "Contact",
    cta: "Să discutăm proiectul",
    menuLabel: "Navigare în pagină",
    skipToContent: "Sari la conținut",
  },
  langSwitcher: {
    label: "Limba site-ului",
    current: "Limba curentă",
  },
  hero: {
    titleLines: ["CREĂM", "CONȚINUT", "CARE VINDE"],
    subtitle: "Producție, montaj, rețele sociale, reclame.",
    cta: "Să discutăm proiectul",
    secondary: "Vezi lucrările",
  },
  work: {
    kicker: "Portofoliu",
    heading: "LUCRĂRILE NOASTRE",
    note: "Filmate și montate pentru clienți.",
    groups: {
      beauty: { label: "BEAUTY" },
      food: { label: "MÂNCARE" },
      fashion: { label: "FASHION" },
      interior: { label: "INTERIOARE" },
      estate: { label: "IMOBILIARE" },
    },
    playLabel: "Video fără sunet",
  },
  process: {
    kicker: "Cum arată",
    heading: "DIN CULISE PÂNĂ LA CADRU",
    sub: "O ședință, două cadre.",
    btsLabel: "Din culise",
    resultLabel: "Rezultatul",
  },
  services: {
    kicker: "Ce facem",
    heading: "SERVICII",
    expand: "Detalii",
    collapse: "Închide",
    items: [
      {
        title: "Conținut și producție",
        tagline: "Filmare, montaj, Reels",
        points: [
          "Foto, video, filmare pe mobil",
          "Scenarii, modele, locații",
          "Montaj, subtitrări, sunet",
        ],
      },
      {
        title: "Rețele sociale",
        tagline: "Tot profilul",
        points: [
          "Strategie, plan de conținut, direcție vizuală",
          "Reels, stories, postări",
          "Analitică și raportare",
        ],
      },
      {
        title: "Publicitate și strategie",
        tagline: "Solicitări, nu afișări",
        points: [
          "Analiza nișei, strategie, consultanță",
          "Creative, lansare, optimizare",
          "Meta, Google, TikTok, Telegram Ads, X",
        ],
      },
      {
        title: "Motion, IT și AI",
        tagline: "Animație, site-uri, boți",
        points: [
          "Filme motion, afișe, logo-uri",
          "Site-uri, landing page-uri, magazine",
          "CRM, back-office, agenți AI, chatboți",
        ],
      },
    ],
  },
  trust: {
    kicker: "Despre noi",
    heading: "O ECHIPĂ DIN CERNĂUȚI",
    paragraphs: ["Unsprezece oameni în Cernăuți. Lucrăm în Ucraina, România și Israel."],
    facts: [
      { value: "11", label: "oameni în echipă" },
      { value: "7", label: "direcții de servicii" },
      { value: "3", label: "țări în care lucrăm" },
    ],
    knownBy: {
      label: "Ne cunosc:",
      names: [
        "radio Bukovynska Khvylia",
        "showroomul textil Tulpan",
        "clubul de tenis ACE",
        "brandul de haine IRONY",
      ],
    },
    quotes: {
      caption: "De pe Instagram, în original în ucraineană.",
      items: [
        { text: "Дай Боже", source: "comentariu sub o postare" },
        { text: "Горжусь!!", source: "comentariu sub o postare" },
        {
          text: "Навчання з @lexi.brzvsk Кольорокорекція, робота зі стабілізатором, правильні налаштування камери…",
          source: "@pafos.art, o postare",
        },
      ],
    },
  },
  audit: {
    kicker: "Gratuit",
    heading: "O ANALIZĂ A INSTAGRAMULUI TĂU",
    sub: "Îți spunem ce să schimbi în conținut.",
    delivery: "Răspundem în messengerul tău.",
    channelsLabel: "Sau scrie-ne direct",
    form: {
      igLabel: "Numele de utilizator Instagram",
      igPlaceholder: "@afacerea_ta",
      contactLabel: "Messenger sau telefon",
      contactPlaceholder: "@nickname sau +380…",
      submit: "Vreau analiza",
      submitting: "Trimitem…",
      successTitle: "Am primit!",
      successText: "Ne uităm pe profil și revenim la tine.",
      successAgain: "Trimite încă una",
      errorTitle: "Ceva nu a mers",
      errorText: "Nu s-a trimis. Încearcă din nou sau scrie-ne direct:",
      retry: "Încearcă din nou",
      errors: {
        igHandle: "Introdu un nume de utilizator: 2–60 de caractere, @ opțional",
        contact: "Introdu un messenger sau un telefon (minim 3 caractere)",
      },
    },
  },
  footer: {
    tagline: "Agenție de conținut din Cernăuți",
    nav: "Navigare",
    socials: "Rețele",
    contacts: "Contacte",
    city: "Cernăuți, Ucraina",
    rights: "Toate drepturile rezervate",
    madeIn: "Făcut cu cireșe la Cernăuți",
  },
  contactBar: {
    open: "Să discutăm proiectul",
    close: "Închide",
    label: "Moduri de contact",
    channels: {
      telegram: "Telegram",
      whatsapp: "WhatsApp",
      instagram: "Instagram Direct",
    },
  },
};
