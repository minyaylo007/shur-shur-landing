import type { Dictionary } from "./uk";

/** Romanian dictionary. Key parity with uk.ts is compiler-enforced. */
export const ro: Dictionary = {
  meta: {
    title: "SHUR-SHUR — agenție de conținut din Cernăuți",
    description:
      "Filmăm, montăm și promovăm conținut pentru rețelele sociale: producție, Reels, reclame plătite, motion și soluții AI. O echipă de 11 oameni în Cernăuți, Ucraina.",
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
    callLabel: "Sună-ne",
  },
  langSwitcher: {
    label: "Limba site-ului",
    uk: "Укр",
    en: "Eng",
    he: "עב",
    ro: "Rom",
  },
  hero: {
    badge: "Agenție de conținut • Cernăuți",
    titleLines: ["CREĂM", "CONȚINUT", "CARE VINDE"],
    subtitle:
      "Ciclu complet: producție, montaj, administrarea rețelelor sociale și reclame plătite. Ucraina, România, Israel.",
    cta: "Să discutăm proiectul",
    contactLabel: "Sau direct:",
    scrollHint: "Vezi lucrările",
  },
  work: {
    kicker: "Portofoliu",
    heading: "LUCRĂRILE NOASTRE",
    sub: "Filmat, montat și publicat de echipa SHUR-SHUR.",
    groups: {
      beauty: { label: "BEAUTY ȘI PRODUS", note: "Ședințe de studio pentru cosmetice și îngrijire" },
      food: { label: "MÂNCARE ȘI OSPITALITATE", note: "Cafenele, restaurante, brutării" },
      bridal: { label: "FASHION ȘI NUNTĂ", note: "Filmări în locație" },
      stories: { label: "STORIES ȘI REELS", note: "Creative finalizate pe care le-am făcut pentru clienți" },
    },
    playLabel: "Videoclipul rulează fără sunet",
  },
  process: {
    kicker: "Cum arată",
    heading: "DIN CULISE PÂNĂ LA CADRU",
    sub: "O singură ședință de cosmetice: întâi procesul din studio, apoi cadrul finalizat pentru client.",
    btsLabel: "Din culise",
    resultLabel: "Rezultatul",
  },
  services: {
    kicker: "Ce facem",
    heading: "SERVICII",
    sub: "Patru direcții. Deschide oricare pentru detalii.",
    expand: "Detalii",
    collapse: "Închide",
    items: [
      {
        title: "Conținut și producție",
        tagline: "Filmare, montaj și Reels gata de publicat — de la idee la postare",
        points: [
          "Fotografie și video profesionale",
          "Filmare pe mobil",
          "Scenarii pentru Reels și TikTok",
          "Casting de modele și locații",
          "Montaj, subtitrări, design de sunet",
          "Adaptare pentru fiecare platformă",
        ],
      },
      {
        title: "Administrarea rețelelor sociale",
        tagline: "Tot profilul: strategie, plan de conținut, stories zilnice",
        points: [
          "Strategie de conținut",
          "Reels, stories și postări",
          "Calendar de conținut",
          "Direcție vizuală a feedului",
          "Analitică și raportare",
        ],
      },
      {
        title: "Publicitate și strategie",
        tagline: "Solicitări și vânzări, nu doar afișări",
        points: [
          "Analiza nișei și a concurenței",
          "Strategie de publicitate",
          "Creative pentru campanii",
          "Lansare și optimizare",
          "Meta, Google, TikTok, Telegram Ads, X",
          "Consultanță de marketing și plan de creștere",
        ],
      },
      {
        title: "Motion, IT și AI",
        tagline: "Animație, site-uri și automatizare pentru afacerea ta",
        points: [
          "Afișe animate și filme publicitare",
          "Animație de logo, creative motion",
          "Site-uri, landing page-uri, magazine online",
          "Sisteme CRM și back-office",
          "Agenți AI, chatboți, integrări",
        ],
      },
    ],
  },
  trust: {
    kicker: "Despre noi",
    heading: "O ECHIPĂ DIN CERNĂUȚI",
    paragraphs: [
      "SHUR-SHUR este o echipă de 11 oameni care trăiesc din conținut: filmăm, montăm, animăm, gestionăm reclame și construim soluții AI. Fiecare direcție are specialistul ei.",
      "Lucrăm cu afaceri din toată Ucraina și intrăm pe piețe internaționale — printre clienți avem deja proiecte din România și Israel.",
    ],
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
      caption: "Comentarii și postări reale despre noi pe Instagram, în original în ucraineană.",
      items: [
        { text: "Дай Боже", source: "comentariu sub postarea noastră de prezentare" },
        { text: "Горжусь!!", source: "comentariu sub postarea noastră de prezentare" },
        {
          text: "Навчання з @lexi.brzvsk Кольорокорекція, робота зі стабілізатором, правильні налаштування камери…",
          source: "@pafos.art — o postare despre training-ul cu echipa noastră",
        },
      ],
    },
  },
  audit: {
    kicker: "Gratuit",
    heading: "O ANALIZĂ A INSTAGRAMULUI TĂU",
    sub: "Ne uităm pe profilul tău și îți spunem ce să schimbi în conținut ca să aducă solicitări.",
    delivery: "Îți răspundem pe Telegram sau te sunăm — cum îți este mai comod.",
    channelsLabel: "Sau scrie-ne direct",
    cityLine: "Cernăuți, Ucraina",
    form: {
      igLabel: "Numele de utilizator Instagram",
      igPlaceholder: "@afacerea_ta",
      contactLabel: "Telegram sau număr de telefon",
      contactPlaceholder: "@nickname sau +380…",
      submit: "Vreau analiza",
      submitting: "Trimitem…",
      successTitle: "Am primit!",
      successText: "Ne uităm pe profil și revenim la contactul pe care l-ai lăsat.",
      successAgain: "Trimite încă una",
      errorTitle: "Ceva nu a mers",
      errorText: "Nu s-a trimis. Încearcă din nou sau scrie-ne direct:",
      retry: "Încearcă din nou",
      errors: {
        igHandle: "Introdu un nume de utilizator: 2–60 de caractere, @ opțional",
        contact: "Introdu un Telegram sau un telefon (minim 3 caractere)",
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
    open: "Ia legătura",
    close: "Închide",
    label: "Moduri de contact",
    channels: {
      telegram: "Telegram",
      whatsapp: "WhatsApp",
      viber: "Viber",
      instagram: "Instagram Direct",
    },
  },
};
