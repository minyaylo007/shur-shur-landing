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
    cases: "Studii de caz",
    packages: "Pachete",
    how: "Cum lucrăm",
    contact: "Contact",
    cta: "Să discutăm proiectul",
    callLabel: "Sună-ne",
    menuLabel: "Navigare în pagină",
    skipToContent: "Sari la conținut",
  },
  langSwitcher: {
    label: "Limba site-ului",
    current: "Limba curentă",
  },
  hero: {
    titleLines: ["ECHIPĂ DE PRODUCȚIE", "LA 90 KM", "DE SUCEAVA"],
    subtitle:
      "Pentru cafenele, saloane, branduri de modă și imobiliare din Suceava și nordul României: filmăm, montăm, administrăm rețelele sociale și reclamele. Vorbim românește.",
    cta: "Să discutăm proiectul",
    secondary: "Vezi studiile de caz",
    direct: "Scrie-ne în Direct",
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
    heading: "O ECHIPĂ, MAI MULTE LOCURI",
    paragraphs: [
      "O parte din echipă este în Cernăuți, cealaltă lucrează la distanță din alte orașe și țări. Lucrăm cu proiecte din piețe diferite, indiferent unde vă aflați.",
    ],
    facts: [
      { value: "11", label: "oameni în echipă" },
      { value: "7", label: "direcții de servicii" },
      { value: "3", label: "țări în care am lucrat deja" },
    ],
  },
  /* v4 B1.2: niche + what we made, from the portfolio's own alt texts.
     Brand, task and result are slots in lib/cases — empty, not drawn. */
  cases: {
    kicker: "Studii de caz",
    heading: "CE AM FĂCUT PENTRU CLIENȚI",
    did: "Ce am făcut",
    task: "Sarcina",
    result: "Rezultatul",
    all: "Toate lucrările",
    items: {
      bridal: {
        niche: "Brand de rochii de mireasă",
        did: "Film de imagine pentru salon, confecționarea rochiei în detaliu, ședință alb-negru în atelier",
      },
      restaurant: {
        niche: "Restaurant italian",
        did: "Reels din bucătărie, stories pentru meniul de sezon al terasei, paste și vin la servire",
      },
      bodycare: {
        niche: "Brand de îngrijire corporală",
        did: "Filmare de produs: balsamul în apă — din culise până la cadrul final",
      },
      leisure: {
        niche: "Complex de agrement",
        did: "Stories cu invitație la rezervarea unei cabane și calendarul datelor libere",
      },
      wellness: {
        niche: "Studio de wellness",
        did: "Reels cu o ședință de masaj și stories cu invitație la programare",
      },
    },
  },
  /* v4 B1.3: the bullets are services.items[0..2]; the «від» price lives
     in lib/business and is drawn only when it exists. */
  packages: {
    kicker: "Pachete",
    heading: "DE UNDE ÎNCEPEM",
    from: "de la",
    ask: "Află prețul",
    names: {
      shoot: "Zi de filmare",
      social: "Rețele sociale · lună",
      ads: "Publicitate · lună",
    },
    extra: "Și: motion, site-uri, boți și AI — după sarcină.",
  },
  /* v4 B1.4: four steps in the market's own terms. Facts from the brief
     (A4/B2) — every line awaits the owner's confirmation in the PR. */
  how: {
    kicker: "Cum lucrăm",
    heading: "CU SUCEAVA",
    steps: [
      {
        title: "Ne scrieți",
        text: "Vă răspunde un coleg care vorbește românește, în messengerul preferat.",
      },
      {
        title: "Filmăm",
        text: "Suntem la 90 km de Suceava și venim la filmare. Sau filmați cu telefonul după scenariul nostru, iar montajul îl facem noi.",
      },
      {
        title: "Administrăm și lansăm",
        text: "Rețelele sociale și reclamele le administrăm de la distanță.",
      },
      {
        title: "Plată și termene",
        text: "Condițiile de plată și termenele le stabilim în scris, înainte de start.",
      },
    ],
  },
  /* v4 B1.5–B1.6: headings only — the section renders when lib/business
     has people / reviews, and not at all before. */
  team: {
    kicker: "Echipa",
    heading: "CU CINE LUCRAȚI",
  },
  reviews: {
    kicker: "Recenzii",
    heading: "CE SPUN CLIENȚII",
  },
  /* v4 B1.7: conservative answers; rights to the material is a question
     for the owner, not answered here. */
  faq: {
    kicker: "Întrebări",
    heading: "ÎNTREBĂRI FRECVENTE",
    items: [
      {
        q: "În ce limbă lucrați?",
        a: "Română, engleză, ucraineană și ebraică — scrieți cum vă este comod.",
      },
      {
        q: "Unde filmați?",
        a: "La Cernăuți, pe loc. În Suceava și în alte orașe — deplasări la filmare, de comun acord, sau filmați cu telefonul după scenariul nostru.",
      },
      {
        q: "Putem lucra complet de la distanță?",
        a: "Da. Rețelele sociale, montajul din materialul dvs., reclamele, motion, site-urile și boții nu necesită întâlniri.",
      },
      {
        q: "Cât costă?",
        a: "Depinde de volum. Scrieți-ne ce vă trebuie și vă spunem prețul în messenger.",
      },
      {
        q: "Cum plătesc din România?",
        a: "Modalitatea de plată și documentele le stabilim înainte de start.",
      },
      {
        q: "Când văd rezultatul?",
        a: "Termenele depind de sarcină. Le spunem înainte de start și le fixăm în scris.",
      },
    ],
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
      retry: "Încearcă din nou",
      failures: {
        rate_limited: {
          title: "Cererea ta a ajuns deja la noi",
          text: "Ai trimis mai multe una după alta — toate au ajuns la noi. Formularul acceptă una nouă peste circa 10 minute. Dacă e urgent, scrie-ne sau sună-ne direct:",
        },
        invalid_json: {
          title: "Cererea a ajuns deteriorată",
          text: "Datele s-au pierdut pe drum — se întâmplă pe o conexiune instabilă. Încearcă din nou, iar dacă se repetă, scrie-ne direct:",
        },
        invalid_input: {
          title: "Verifică ce ai scris în câmpuri",
          text: "Numele de utilizator: 2–60 de caractere latine, cifre, punct și underscore, @ opțional. Contactul: un Telegram sau un număr de telefon, minim 3 caractere. Corectează și trimite din nou.",
        },
        delivery_failed: {
          title: "Cererea nu a ajuns la noi",
          text: "Legătura cu mesageria noastră nu funcționează acum, iar o nouă încercare se va termina cel mai probabil la fel. Cel mai rapid ajungi la noi dacă ne scrii sau ne suni:",
        },
        network: {
          title: "Conexiunea s-a întrerupt",
          text: "Cererea nici nu a plecat: rețeaua a dispărut sau nu a venit niciun răspuns în 15 secunde. Verifică conexiunea și încearcă din nou.",
        },
        unknown: {
          title: "Ceva nu a mers",
          text: "Serverul a răspuns cu o eroare la care nu ne așteptam. Încearcă din nou, iar dacă se repetă, scrie-ne direct:",
        },
      },
      errors: {
        igHandle: "Introdu un nume de utilizator: 2–60 de caractere, @ opțional",
        contact: "Introdu un messenger sau un telefon (minim 3 caractere)",
      },
    },
  },
  footer: {
    tagline: "Agenție de conținut din Cernăuți",
    email: "E-mail",
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
      viber: "Viber",
      instagram: "Instagram Direct",
    },
  },
  /* ждёт проверки носителем — cookie banner copy, written 29.09.2026 without a native reviewer. */
  consent: {
    label: "Consimțământ cookie",
    text: "Folosim doar ce este necesar pentru funcționarea site-ului. Cu permisiunea dvs., și cookie-uri publicitare Meta — ca să vedem ce reclame aduc solicitări.",
    necessary: "Doar cele necesare",
    allowAds: "Permite cookie-urile publicitare",
    settings: "Setări cookie",
  },
  thanks: {
    metaTitle: "Cererea a fost primită — SHUR-SHUR",
    home: "Înapoi la pagina principală",
  },
  notFound: {
    metaTitle: "Pagina nu a fost găsită — SHUR-SHUR",
    heading: "PAGINA NU EXISTĂ",
    text: "Poate că adresa are o greșeală sau pagina a fost ștearsă. Tot ce facem este adunat pe pagina principală.",
    home: "Înapoi pe site",
    chooseLanguage: "Alegeți limba",
  },
};
