import type { LandingCopy } from "./types";

/**
 * /ro/suceava — hypotheses Г1 (wedding industry) and Г2 (HoReCa) of the
 * Suceava pilot. Offer: the free Instagram audit the site already has.
 * Written 29.09.2026 without a native reviewer.
 */
export const suceavaRo: LandingCopy = {
  meta: {
    title: "SHUR-SHUR pentru afacerile din Suceava — conținut, Reels, rețele sociale", // ждёт проверки носителем
    description: "Filmăm și montăm conținut pentru rețelele sociale. În Suceava avem o colegă care vorbește română. Începem cu o analiză gratuită a Instagramului tău.", // ждёт проверки носителем
  },
  hero: {
    kicker: "Suceava", // ждёт проверки носителем
    title: "CONȚINUT PENTRU AFACERI DIN SUCEAVA", // ждёт проверки носителем
    sub: "Filmăm, montăm și ne ocupăm de rețelele sociale. Începem cu o analiză gratuită a Instagramului tău.", // ждёт проверки носителем
    cta: "Vreau analiza gratuită", // ждёт проверки носителем
  },
  about: {
    heading: "CINE SUNTEM", // ждёт проверки носителем
    text: "SHUR-SHUR este o agenție de conținut din Cernăuți. În Suceava avem o colegă care vorbește română, așa că putem discuta în limba ta.", // ждёт проверки носителем
  },
  segments: [
    {
      key: "g1-weddings",
      kicker: "Nunți", // ждёт проверки носителем
      heading: "PENTRU INDUSTRIA DE NUNȚI", // ждёт проверки носителем
      text: "Saloane de rochii de mireasă, ateliere, săli de evenimente, decor. Înainte de sezon și de târguri ai nevoie de video proaspăt — îl filmăm și îl montăm.", // ждёт проверки носителем
      points: [
        "Reels pentru salon și pentru colecție", // ждёт проверки носителем
        "Filmare în atelier: rochia, detaliu cu detaliu", // ждёт проверки носителем
        "Stories și postări pentru sezon", // ждёт проверки носителем
      ],
      work: ["reel-bride", "reel-atelier", "bridal-atelier", "bts-crew"],
      workNote: "Lucrări reale pentru un brand de rochii de mireasă.", // ждёт проверки носителем
    },
    {
      key: "g2-horeca",
      kicker: "HoReCa", // ждёт проверки носителем
      heading: "PENTRU RESTAURANTE, CAFENELE ȘI BRUTĂRII", // ждёт проверки носителем
      text: "Feed-ul nu vinde, iar timp de filmat nu ai. Îți spunem gratuit ce să schimbi în profil, iar conținutul îl putem face noi.", // ждёт проверки носителем
      points: [
        "Reels din bucătărie și de la servire", // ждёт проверки носителем
        "Fotografii cu preparate și interior", // ждёт проверки носителем
        "Stories cu meniul și ofertele zilei", // ждёт проверки носителем
      ],
      work: ["reel-kitchen", "reel-bakery", "reel-baklava", "food-pastry"],
      workNote: "Lucrări reale pentru un restaurant italian, brutării și o cafenea.", // ждёт проверки носителем
    },
  ],
  steps: {
    heading: "CUM ÎNCEPEM", // ждёт проверки носителем
    items: [
      "Ne trimiți profilul de Instagram în formularul de mai jos.", // ждёт проверки носителем
      "Ne uităm pe profil și îți scriem ce am schimba.", // ждёт проверки носителем
      "Dacă ți se potrivește, stabilim împreună ce filmăm.", // ждёт проверки носителем
    ],
  },
  audit: {
    kicker: "Gratuit", // ждёт проверки носителем
    heading: "ANALIZA INSTAGRAMULUI TĂU", // ждёт проверки носителем
    sub: "Îți spunem ce să schimbi în conținut. Fără obligații.", // ждёт проверки носителем
  },
  whenConfigured: {
    phoneLabel: "Sună-ne sau scrie-ne pe WhatsApp", // ждёт проверки носителем
    priceFrom: "Zi de filmare, de la", // ждёт проверки носителем
  },
  footer: {
    home: "Site-ul principal", // ждёт проверки носителем
  },
};
