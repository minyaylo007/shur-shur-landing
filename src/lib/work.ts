import type { Locale } from "./i18n";

/**
 * Curated portfolio (brief §7–§12).
 *
 * Every entry below is real SHUR-SHUR material from the agency's own shoot
 * archive — no stock, no placeholders. Localized strings use the same
 * `Record<Locale, string>` alt shape the portfolio has always used — one alt
 * convention in the codebase rather than two.
 *
 * v3: the shared Drive folder grew from 20 files to 43. The new material is
 * not "more of the same" — it adds whole industries the site could not show
 * before (fashion studio, bridal atelier, an Italian restaurant, furniture
 * and textile salons, a leisure complex). So the clusters are now by
 * INDUSTRY rather than by "stills / stories": a visitor recognises their own
 * business in a row of tiles, which no amount of prose achieves. Everything
 * that was only a frame grab from a three-second clip (bridal-terrace,
 * bridal-seawall, bts-pool) is retired — it was the weakest evidence in the
 * archive and there are now real photographs in its place.
 *
 * Owner's cleanup pass, 23.09.2026: beauty is pinned at exactly eight tiles
 * — the second cosmetics portrait (`beauty-foam`, the smiling model with the
 * hair clip) is gone, which also turns a nine-tile group with one orphan in
 * the last row into two full rows of four. Estate gained `story-kodra-house`
 * from the same Drive folder for the same reason: three tiles left a lonely
 * fourth slot, and the group had no house in it, which is what the category
 * is about. The file `beauty-foam.webp` is deleted from `public/` too — an
 * unreferenced asset would fail tests/public-assets.test.ts.
 *
 * Owner's content pass, 23.09.2026: three new files from the same shared
 * Drive folder join fashion — a street portrait for a clothing brand
 * (`fashion-model`), a still of the designer's sketch table
 * (`fashion-production`) and the clip shot over that table
 * (`bts-production`). The white-suit studio portrait (`fashion-dress`, the
 * model on the chair in a white waistcoat and trousers) is gone on the
 * owner's instruction, and its file is deleted from `public/` with it — an
 * unreferenced asset would fail tests/public-assets.test.ts. The clip is the
 * one file in the archive shot 16:9 rather than 9:16; it is cropped to the
 * centre column at encode time instead of at render time, so the browser is
 * never sent pixels the tile crops away.
 *
 * ALL source files are vertical 9:16, so the grid is built from 9:16 tiles
 * by design instead of cropping tall footage into wide boxes.
 */
export type WorkGroupKey = "beauty" | "food" | "fashion" | "interior" | "estate";

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
  // ─── Beauty, skincare & wellness ─────────────────────────────────────
  photo("beauty-spf", "beauty", 1000, 1500, {
    uk: "Предметна зйомка: сонцезахисний крем на шкірі, деталь у м’якому світлі",
    en: "Product shoot: sunscreen on skin, close detail in soft light",
    he: "צילום מוצר: קרם הגנה על העור, פרט קרוב באור רך",
    ro: "Ședință de produs: cremă de protecție solară pe piele, detaliu în lumină difuză",
  }),
  photo("beauty-gel", "beauty", 1000, 1500, {
    uk: "Предметна зйомка: гель для тіла в руці моделі на тлі шкіри",
    en: "Product shoot: body gel held against the model’s skin",
    he: "צילום מוצר: ג’ל גוף מוחזק על רקע עורה של הדוגמנית",
    ro: "Ședință de produs: gel de corp ținut pe fundalul pielii modelului",
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
  video("reel-massage", "beauty", 540, 960, {
    uk: "Reels для велнес-студії: процедура масажу — готовий креатив для клієнта",
    en: "Reel for a wellness studio: a massage treatment — a finished creative for the client",
    he: "ריל לסטודיו וולנס: טיפול עיסוי — קריאייטיב מוגמר עבור הלקוח",
    ro: "Reel pentru un studio de wellness: o ședință de masaj — creativ finalizat pentru client",
  }),
  photo("story-massage", "beauty", 720, 1280, {
    uk: "Сторіс для велнес-студії із запрошенням на процедуру",
    en: "Story creative for a wellness studio inviting bookings",
    he: "קריאייטיב סטורי לסטודיו וולנס עם הזמנה לטיפול",
    ro: "Creativ de story pentru un studio de wellness, cu invitație la programare",
  }),

  // ─── Food & hospitality ──────────────────────────────────────────────
  photo("food-pastry", "food", 982, 1500, {
    uk: "Зйомка для кав’ярні: випічка на темному тлі",
    en: "Coffee-shop shoot: pastry on a dark surface",
    he: "צילום לבית קפה: מאפה על משטח כהה",
    ro: "Ședință pentru cafenea: patiserie pe o suprafață închisă",
  }),
  photo("food-cream", "food", 1000, 1500, {
    uk: "Зйомка для кондитерської: кондитер відсаджує крем на десерт",
    en: "Patisserie shoot: a pastry chef piping cream onto a dessert",
    he: "צילום לקונדיטוריה: קונדיטור מזלף קרם על קינוח",
    ro: "Ședință pentru cofetărie: un cofetar toarnă cremă pe un desert",
  }),
  photo("food-interior", "food", 1000, 1500, {
    uk: "Інтер’єрна зйомка залу ресторану",
    en: "Interior shoot of a restaurant dining room",
    he: "צילום פנים של אולם המסעדה",
    ro: "Fotografie de interior a sălii unui restaurant",
  }),
  video("reel-kitchen", "food", 540, 960, {
    uk: "Reels для італійського ресторану: кухар готує страву на кухні",
    en: "Reel for an Italian restaurant: a chef cooking in the kitchen",
    he: "ריל למסעדה איטלקית: שף מבשל במטבח",
    ro: "Reel pentru un restaurant italian: un bucătar gătind în bucătărie",
  }),
  video("reel-bakery", "food", 540, 960, {
    uk: "Відео: процес приготування випічки в турецькій пекарні",
    en: "Video: the baking process at a Turkish bakery",
    he: "וידאו: תהליך האפייה במאפייה טורקית",
    ro: "Video: procesul de coacere într-o brutărie turcească",
  }),
  video("reel-baklava", "food", 540, 960, {
    uk: "Reels для пекарні: подача пахлави — готовий креатив для клієнта",
    en: "Reel for a bakery: serving baklava — a finished creative made for the client",
    he: "ריל למאפייה: הגשת בקלאווה — קריאייטיב מוגמר עבור הלקוח",
    ro: "Reel pentru o brutărie: servirea baclavalei — creativ finalizat pentru client",
  }),
  photo("story-estate", "food", 1000, 1778, {
    uk: "Сторіс для італійського ресторану: сезонне меню літньої веранди",
    en: "Story creative for an Italian restaurant: the summer terrace menu",
    he: "קריאייטיב סטורי למסעדה איטלקית: תפריט המרפסת הקיצית",
    ro: "Creativ de story pentru un restaurant italian: meniul terasei de vară",
  }),
  photo("story-pasta", "food", 1000, 1778, {
    uk: "Сторіс для ресторану: паста й вино у фірмовому оформленні",
    en: "Story creative for a restaurant: pasta and wine in the brand’s own styling",
    he: "קריאייטיב סטורי למסעדה: פסטה ויין בעיצוב המותג",
    ro: "Creativ de story pentru restaurant: paste și vin în stilul brandului",
  }),

  // ─── Fashion & bridal ────────────────────────────────────────────────
  /* Owner's content pass, 23.09.2026: photo and video ALTERNATE here, and
     nowhere else on the page does the order carry meaning like this. The
     group used to run three photographs and then three clips, which on a
     four-column desktop grid meant a row of stills above a row of moving
     tiles — the eye reads that as two different sections. Four photos and
     four clips in strict P-V-P-V order give every row (four across on
     desktop, two on phones) the same mix, so the rhythm survives every
     breakpoint. Keep the alternation when touching this list. */
  photo("fashion-model", "fashion", 1000, 1500, {
    uk: "Фешн-зйомка для бренду одягу: модель у шовковому топі та мереживній спідниці",
    en: "Fashion shoot for a clothing brand: a model in a silk top and a lace skirt",
    he: "צילומי אופנה למותג אופנה: דוגמנית בטופ משי ובחצאית תחרה",
    ro: "Ședință fashion pentru un brand de haine: un model într-un top de mătase și o fustă din dantelă",
  }),
  video("bts-production", "fashion", 540, 960, {
    uk: "Бекстейдж виробництва: дизайнерка перебирає ескізи суконь",
    en: "Behind the scenes of production: the designer going through dress sketches",
    he: "מאחורי הקלעים של הייצור: המעצבת עוברת על סקיצות של שמלות",
    ro: "Din culisele producției: designerul răsfoiește schițele rochiilor",
  }),
  photo("fashion-suit", "fashion", 1000, 1508, {
    uk: "Фешн-зйомка в студії: модель у світлому костюмі бренду одягу",
    en: "Studio fashion shoot: a model in a light suit for a clothing brand",
    he: "צילומי אופנה בסטודיו: דוגמנית בחליפה בהירה עבור מותג אופנה",
    ro: "Ședință fashion în studio: un model într-un costum deschis, pentru un brand de haine",
  }),
  video("reel-bride", "fashion", 540, 960, {
    uk: "Reels для весільного бренду: імідж-ролик салону",
    en: "Reel for a bridal brand: the salon’s image clip",
    he: "ריל למותג כלות: סרטון התדמית של הסלון",
    ro: "Reel pentru un brand de mirese: clipul de imagine al salonului",
  }),
  photo("fashion-production", "fashion", 1000, 1304, {
    uk: "Виробництво одягу: ескізи суконь, перли й фатин на столі дизайнерки",
    en: "Fashion production: dress sketches, pearls and tulle on the designer’s table",
    he: "ייצור אופנה: סקיצות של שמלות, פנינים וטול על שולחן המעצבת",
    ro: "Producție de modă: schițe de rochii, perle și tul pe masa designerului",
  }),
  video("reel-atelier", "fashion", 540, 960, {
    uk: "Reels для весільного бренду: виробництво сукні, робота з деталями",
    en: "Reel for a bridal brand: the dress being made, detail by detail",
    he: "ריל למותג כלות: ייצור השמלה, פרט אחר פרט",
    ro: "Reel pentru un brand de mirese: confecționarea rochiei, detaliu cu detaliu",
  }),
  photo("bridal-atelier", "fashion", 1000, 1500, {
    uk: "Чорно-біла зйомка ательє: швачка працює з весільною сукнею на манекені",
    en: "Black-and-white atelier shoot: a seamstress working on a wedding dress on the form",
    he: "צילום שחור-לבן בסטודיו תפירה: תופרת עובדת על שמלת כלה על הבובה",
    ro: "Ședință alb-negru în atelier: o croitoreasă lucrează la o rochie de mireasă pe manechin",
  }),
  video("bts-crew", "fashion", 540, 960, {
    uk: "Бекстейдж: команда зі студійним світлом на виїзній весільній зйомці",
    en: "Behind the scenes: the crew with studio light on a bridal shoot on location",
    he: "מאחורי הקלעים: הצוות עם תאורת סטודיו בצילומי כלה בחוץ",
    ro: "Din culise: echipa cu lumină de studio la o ședință de nuntă în locație",
  }),

  // ─── Interior, furniture & textile ───────────────────────────────────
  photo("story-curtains", "interior", 1000, 1778, {
    uk: "Сторіс для салону текстилю: добірка штор для дому",
    en: "Story creative for a textile salon: choosing curtains for the home",
    he: "קריאייטיב סטורי לסלון טקסטיל: בחירת וילונות לבית",
    ro: "Creativ de story pentru un salon textil: alegerea draperiilor pentru casă",
  }),
  photo("story-textile", "interior", 1000, 1778, {
    uk: "Сторіс для салону текстилю: штори в оформленні інтер’єру",
    en: "Story creative for a textile salon: curtains as part of the interior",
    he: "קריאייטיב סטורי לסלון טקסטיל: וילונות כחלק מעיצוב הפנים",
    ro: "Creativ de story pentru un salon textil: draperiile ca parte din interior",
  }),
  photo("story-armchair", "interior", 1000, 1778, {
    uk: "Сторіс для салону дизайнерських меблів: крісло в інтер’єрі",
    en: "Story creative for a designer-furniture salon: an armchair in the interior",
    he: "קריאייטיב סטורי לסלון רהיטי עיצוב: כורסה בחלל",
    ro: "Creativ de story pentru un salon de mobilier de design: un fotoliu în interior",
  }),
  photo("story-furniture", "interior", 1000, 1778, {
    uk: "Сторіс для салону меблів: меблі під замовлення в кадрі",
    en: "Story creative for a furniture salon: made-to-order furniture in frame",
    he: "קריאייטיב סטורי לסלון רהיטים: רהיטים בהזמנה אישית בפריים",
    ro: "Creativ de story pentru un salon de mobilă: mobilier la comandă în cadru",
  }),

  // ─── Leisure complex & property ──────────────────────────────────────
  photo("story-kodra", "estate", 1000, 1778, {
    uk: "Сторіс для комплексу відпочинку: запрошення забронювати котедж",
    en: "Story creative for a leisure complex: an invitation to book a cottage",
    he: "קריאייטיב סטורי למתחם נופש: הזמנה להזמין קוטג’",
    ro: "Creativ de story pentru un complex de agrement: invitație la rezervarea unei cabane",
  }),
  photo("story-kodra-dates", "estate", 1000, 1778, {
    uk: "Сторіс для комплексу відпочинку: календар вільних дат на місяць",
    en: "Story creative for a leisure complex: the month’s open dates calendar",
    he: "קריאייטיב סטורי למתחם נופש: לוח התאריכים הפנויים לחודש",
    ro: "Creativ de story pentru un complex de agrement: calendarul datelor libere ale lunii",
  }),
  photo("story-kodra-house", "estate", 1000, 1778, {
    uk: "Сторіс для забудовника: заміський будинок із басейном і садиба з висоти",
    en: "Story creative for a developer: an out-of-town house with a pool and the estate from above",
    he: "קריאייטיב סטורי ליזם: בית כפרי עם בריכה והמתחם ממבט על",
    ro: "Creativ de story pentru un dezvoltator: o casă la țară cu piscină și domeniul văzut de sus",
  }),
  photo("story-kodra-invest", "estate", 1000, 1778, {
    uk: "Сторіс для забудовника: інвестиції в заміську нерухомість",
    en: "Story creative for a developer: investing in out-of-town property",
    he: "קריאייטיב סטורי ליזם: השקעה בנדל״ן כפרי",
    ro: "Creativ de story pentru un dezvoltator: investiția în proprietăți din afara orașului",
  }),
];

export const workGroupOrder: WorkGroupKey[] = ["beauty", "food", "fashion", "interior", "estate"];

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
export const heroVideo = video("hero-street", "fashion", 720, 1280, {
  uk: "Бекстейдж вуличної зйомки в Чернівцях: оператор знімає модель біля фруктової ятки",
  en: "Behind the scenes of a street shoot in Chernivtsi: an operator filming a model by a fruit stall",
  he: "מאחורי הקלעים של צילומי רחוב בצ’רנוביץ: צלם מצלם דוגמנית ליד דוכן פירות",
  ro: "Din culisele unei filmări stradale în Cernăuți: un operator filmează un model lângă o tarabă cu fructe",
});
