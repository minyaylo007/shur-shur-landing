import type { Locale } from "./i18n";

/**
 * Curated portfolio (brief §7–§12).
 *
 * Every entry below is real SHUR-SHUR material from the agency's own shoot
 * archive — no stock, no placeholders. Localized strings use the same
 * `Record<Locale, string>` alt shape as `posts.ts`, so there is one alt
 * convention in the codebase rather than two.
 *
 * A note that shaped the whole layout: ALL twenty source files are vertical
 * 9:16. The six 4K clips are stored as 3840×2160 with `rotation=-90` in
 * their metadata, which reads as landscape until a player applies the
 * matrix. The agency shoots Instagram-native and nothing else, so the grid
 * is built from 9:16 tiles by design instead of cropping tall footage into
 * wide boxes.
 */
export type WorkGroupKey = "beauty" | "food" | "bridal" | "stories";

interface WorkBase {
  /** Stable key — also the basename of the media file. */
  id: string;
  group: WorkGroupKey;
  alt: Record<Locale, string>;
}

export interface WorkPhoto extends WorkBase {
  kind: "photo";
  src: string;
  width: number;
  height: number;
}

export interface WorkVideo extends WorkBase {
  kind: "video";
  src: string;
  poster: string;
  width: number;
  height: number;
}

export type WorkItem = WorkPhoto | WorkVideo;

const photo = (
  id: string,
  group: WorkGroupKey,
  width: number,
  height: number,
  alt: Record<Locale, string>,
): WorkPhoto => ({ kind: "photo", id, group, width, height, alt, src: `/work/photo/${id}.webp` });

const video = (
  id: string,
  group: WorkGroupKey,
  width: number,
  height: number,
  alt: Record<Locale, string>,
): WorkVideo => ({
  kind: "video",
  id,
  group,
  width,
  height,
  alt,
  src: `/work/video/${id}.mp4`,
  poster: `/work/poster/${id}.webp`,
});

/** Order here is the render order inside each group. */
export const workItems: WorkItem[] = [
  // ─── Beauty & product ────────────────────────────────────────────────
  photo("beauty-spf", "beauty", 1000, 1500, {
    uk: "Предметна зйомка: сонцезахисний крем на шкірі, деталь у м’якому світлі",
    en: "Product shoot: sunscreen on skin, close detail in soft light",
    he: "צילום מוצר: קרם הגנה על העור, פרט קרוב באור רך",
    ro: "Ședință de produs: cremă de protecție solară pe piele, detaliu în lumină difuză",
  }),
  photo("beauty-foam", "beauty", 1000, 1500, {
    uk: "Предметна зйомка: пінка для вмивання з текстурою піни",
    en: "Product shoot: cleansing foam with its texture in frame",
    he: "צילום מוצר: קצף ניקוי עם המרקם שלו בפריים",
    ro: "Ședință de produs: spumă de curățare cu textura în cadru",
  }),
  photo("beauty-lineup", "beauty", 1024, 1500, {
    uk: "Предметна зйомка: повна лінійка догляду, розкладка на світлому тлі",
    en: "Product shoot: the full skincare line laid out on a light background",
    he: "צילום מוצר: קו הטיפוח המלא פרוש על רקע בהיר",
    ro: "Ședință de produs: gama completă de îngrijire, așezată pe fundal deschis",
  }),
  photo("beauty-clay", "beauty", 1000, 1500, {
    uk: "Предметна зйомка: глиняна маска, макрокадр текстури",
    en: "Product shoot: clay mask, macro frame of the texture",
    he: "צילום מוצר: מסכת חימר, מאקרו של המרקם",
    ro: "Ședință de produs: mască de argilă, cadru macro al texturii",
  }),
  photo("beauty-hands", "beauty", 1009, 1500, {
    uk: "Предметна зйомка: догляд у руках моделі",
    en: "Product shoot: skincare held in the model’s hands",
    he: "צילום מוצר: מוצרי טיפוח בידי הדוגמנית",
    ro: "Ședință de produs: îngrijire ținută în mâinile modelului",
  }),
  photo("beauty-still", "beauty", 1000, 1500, {
    uk: "Естетична предметна зйомка косметики зі світлотінню",
    en: "Editorial cosmetics still life with sculpted light",
    he: "טבע דומם אסתטי של קוסמטיקה עם עבודת אור",
    ro: "Natură statică editorială de cosmetice, cu lumină modelată",
  }),

  // ─── Food & hospitality ──────────────────────────────────────────────
  video("reel-bakery", "food", 540, 960, {
    uk: "Відео: процес приготування випічки в турецькій пекарні",
    en: "Video: the baking process at a Turkish bakery",
    he: "וידאו: תהליך האפייה במאפייה טורקית",
    ro: "Video: procesul de coacere într-o brutărie turcească",
  }),
  photo("food-pastry", "food", 982, 1500, {
    uk: "Зйомка для кав’ярні: випічка на темному тлі",
    en: "Coffee-shop shoot: pastry on a dark surface",
    he: "צילום לבית קפה: מאפה על משטח כהה",
    ro: "Ședință pentru cafenea: patiserie pe o suprafață închisă",
  }),
  photo("food-interior", "food", 1000, 1500, {
    uk: "Інтер’єрна зйомка залу ресторану",
    en: "Interior shoot of a restaurant dining room",
    he: "צילום פנים של אולם המסעדה",
    ro: "Fotografie de interior a sălii unui restaurant",
  }),
  video("bts-pool", "food", 720, 1280, {
    uk: "Бекстейдж: зйомка сніданку біля басейну котеджу",
    en: "Behind the scenes: shooting breakfast by a cottage pool",
    he: "מאחורי הקלעים: צילום ארוחת בוקר ליד בריכת הקוטג’",
    ro: "Din culise: fotografierea micului dejun lângă piscina unei cabane",
  }),

  // ─── Fashion & bridal ────────────────────────────────────────────────
  video("bts-crew", "bridal", 720, 1280, {
    uk: "Бекстейдж: команда зі студійним світлом на виїзній зйомці",
    en: "Behind the scenes: the crew with studio light on location",
    he: "מאחורי הקלעים: הצוות עם תאורת סטודיו בצילומי חוץ",
    ro: "Din culise: echipa cu lumină de studio la filmare în locație",
  }),
  photo("bridal-terrace", "bridal", 844, 1500, {
    uk: "Бекстейдж весільної зйомки: наречена на терасі, фотограф у кадрі",
    en: "Bridal shoot behind the scenes: the bride on a terrace, photographer in frame",
    he: "מאחורי הקלעים של צילומי כלה: הכלה במרפסת, הצלם בפריים",
    ro: "Din culisele ședinței de nuntă: mireasa pe terasă, fotograful în cadru",
  }),
  photo("bridal-seawall", "bridal", 844, 1500, {
    uk: "Весільна зйомка на локації біля моря",
    en: "Bridal shoot on location by the sea",
    he: "צילומי כלה בלוקיישן על שפת הים",
    ro: "Ședință de nuntă în locație, lângă mare",
  }),

  // ─── Stories & reels made for clients ────────────────────────────────
  video("reel-baklava", "stories", 540, 960, {
    uk: "Reels для пекарні: подача пахлави — готовий креатив для клієнта",
    en: "Reel for a bakery: serving baklava — a finished creative made for the client",
    he: "ריל למאפייה: הגשת בקלאווה — קריאייטיב מוגמר עבור הלקוח",
    ro: "Reel pentru o brutărie: servirea baclavalei — creativ finalizat pentru client",
  }),
  video("reel-massage", "stories", 540, 960, {
    uk: "Reels для велнес-студії — готовий креатив для клієнта",
    en: "Reel for a wellness studio — a finished creative made for the client",
    he: "ריל לסטודיו וולנס — קריאייטיב מוגמר עבור הלקוח",
    ro: "Reel pentru un studio de wellness — creativ finalizat pentru client",
  }),
  photo("story-massage", "stories", 720, 1280, {
    uk: "Сторіс для велнес-студії — готовий креатив для клієнта",
    en: "Story creative for a wellness studio — made for the client",
    he: "קריאייטיב סטורי לסטודיו וולנס — עבור הלקוח",
    ro: "Creativ de story pentru un studio de wellness — realizat pentru client",
  }),
];

export const workGroupOrder: WorkGroupKey[] = ["beauty", "food", "bridal", "stories"];

export function itemsInGroup(group: WorkGroupKey): WorkItem[] {
  return workItems.filter((item) => item.group === group);
}

/**
 * Brief §8: the strongest pair in the archive — the studio behind-the-scenes
 * of pouring water over a balm, and the finished frame of that same product.
 * Same shoot, same product, process → result.
 */
export const processPair = {
  bts: video("bts-cosmetics", "beauty", 720, 1280, {
    uk: "Бекстейдж: вода ллється у скляний акваріум над бальзамом під час зйомки",
    en: "Behind the scenes: water poured into a glass tank over the balm during the shoot",
    he: "מאחורי הקלעים: מים נשפכים לאקווריום זכוכית מעל הבלם במהלך הצילום",
    ro: "Din culise: apă turnată într-un acvariu de sticlă peste balsam în timpul ședinței",
  }),
  result: photo("result-underwater", "beauty", 1200, 1800, {
    uk: "Готовий кадр: бальзам для тіла на вкритій водою поверхні",
    en: "The finished frame: the body balm on a water-covered surface",
    he: "הפריים המוגמר: בלם הגוף על משטח מכוסה מים",
    ro: "Cadrul finalizat: balsamul de corp pe o suprafață acoperită cu apă",
  }),
} as const;

/** Hero background (brief §6): a street shoot in the agency's own city. */
export const heroVideo = video("hero-street", "beauty", 900, 1600, {
  uk: "Бекстейдж вуличної зйомки в Чернівцях: оператор знімає модель біля фруктової ятки",
  en: "Behind the scenes of a street shoot in Chernivtsi: an operator filming a model by a fruit stall",
  he: "מאחורי הקלעים של צילומי רחוב בצ’רנוביץ: צלם מצלם דוגמנית ליד דוכן פירות",
  ro: "Din culisele unei filmări stradale în Cernăuți: un operator filmează un model lângă o tarabă cu fructe",
});
