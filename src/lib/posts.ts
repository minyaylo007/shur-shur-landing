import type { Locale } from "./i18n";
import { site } from "./site";

/**
 * Instagram integration, Approach A (brief §6): a hand-curated grid of posts
 * we own the imagery for. No tokens, no widgets, no third-party uptime — the
 * v2 path swaps this array for a Behold JSON feed behind the same component.
 *
 * The three post/reel URLs below are VERIFIED live links from the appendix
 * research (2026-06-11); the remaining tiles deep-link to the profile.
 */
export interface InstaPost {
  /** Tile image from /public/brand — shots the agency made itself. */
  image: string;
  /** Real post/reel URL (verified) or the agency profile. */
  href: string;
  /** Localized alt text — doubles as the accessible link name. */
  alt: Record<Locale, string>;
}

export const posts: InstaPost[] = [
  {
    image: "/brand/content.png",
    href: "https://www.instagram.com/p/C93H517INJt/",
    alt: {
      uk: "Пост-знайомство з командою Shur Shur Agency",
      en: "Meet-the-team post by Shur Shur Agency",
      he: "פוסט היכרות עם הצוות של Shur Shur Agency",
      ro: "Postare de prezentare a echipei Shur Shur Agency",
    },
  },
  {
    image: "/brand/video.png",
    href: "https://www.instagram.com/reel/DHGtrkJoO8E/",
    alt: {
      uk: "Reels зі студії радіо «Буковинська Хвиля» про бізнес під час війни",
      en: "Reel from the Bukovynska Khvylia radio studio on wartime local business",
      he: "ריל מהאולפן של רדיו Bukovynska Khvylia על עסקים מקומיים בזמן מלחמה",
      ro: "Reel din studioul radioului Bukovynska Khvylia despre afacerile locale în timp de război",
    },
  },
  {
    image: "/brand/motion.png",
    href: "https://www.instagram.com/reel/DLhQNcgIOGb/",
    alt: {
      uk: "Fashion-reels «Court Style» — зйомка для тенісного клубу та бренду одягу",
      en: "“Court Style” fashion reel shot for a tennis club and a clothing brand",
      he: "ריל אופנה «Court Style» — צילומים למועדון טניס ולמותג אופנה",
      ro: "Reel fashion „Court Style” — filmat pentru un club de tenis și un brand de haine",
    },
  },
  {
    image: "/brand/target.png",
    href: site.socials.instagram,
    alt: {
      uk: "Обкладинка послуги «Таргетована реклама» — наш профіль в Instagram",
      en: "“Paid advertising” service cover — our Instagram profile",
      he: "עטיפת השירות «פרסום ממומן» — הפרופיל שלנו באינסטגרם",
      ro: "Coperta serviciului „Reclame plătite” — profilul nostru de Instagram",
    },
  },
  {
    image: "/brand/consult.png",
    href: site.socials.instagram,
    alt: {
      uk: "Обкладинка послуги «Маркетингова консультація» — наш профіль в Instagram",
      en: "“Marketing consulting” service cover — our Instagram profile",
      he: "עטיפת השירות «ייעוץ שיווקי» — הפרופיל שלנו באינסטגרם",
      ro: "Coperta serviciului „Consultanță de marketing” — profilul nostru de Instagram",
    },
  },
  {
    image: "/brand/it-ai.png",
    href: site.socials.instagram,
    alt: {
      uk: "Обкладинка послуги «IT та AI-рішення» — наш профіль в Instagram",
      en: "“IT & AI solutions” service cover — our Instagram profile",
      he: "עטיפת השירות «פתרונות IT ו-AI» — הפרופיל שלנו באינסטגרם",
      ro: "Coperta serviciului „Soluții IT și AI” — profilul nostru de Instagram",
    },
  },
];

/**
 * «Нас знають» row (brief §5): VERIFIED clients/partners from the appendix —
 * the radio segment, the featured curtain salon, the Court Style location and
 * outfit credits. Display names live in the dictionaries (cases.knownBy.names,
 * same order).
 */
export const knownHandles = [
  { handle: "@100fmcv", href: "https://www.instagram.com/100fmcv/" },
  { handle: "@tulpan_cv", href: "https://www.instagram.com/tulpan_cv/" },
  { handle: "@terrasa_ace", href: "https://www.instagram.com/terrasa_ace/" },
  { handle: "@irony_ua", href: "https://www.instagram.com/irony_ua/" },
] as const;
