/* What went wrong with her Meta key, in plain words, and what to do. Keyed by
   the reason word the API routes put in the redirect: the setup page gets
   `?e=meta_<word>`, the cabinet `?m=<word>`. Nothing she typed is in the URL. */

export const META_MESSAGES: Record<string, string> = {
  token_format:
    "Ключ доступа не похож на настоящий: он длинный, из латинских букв и цифр, обычно начинается с «EAA». Скопируйте его ещё раз целиком (шаг 4) и вставьте заново.",
  account_format:
    "Номер рекламного аккаунта — только цифры (можно с «act_» впереди), например act_1234567890. Возьмите его ещё раз в шаге 5.",
  dataset_format: "Номер пикселя — только цифры, обычно 15–16 штук. Возьмите его ещё раз в шаге 5.",
  bad_key:
    "Meta не узнала этот ключ. Скорее всего, скопировался не весь ключ или не тот. Создайте новый ключ (шаг 4) и вставьте его целиком.",
  expired: "Срок этого ключа истёк. Создайте новый ключ (шаг 4) и выберите срок «Никогда» (Never).",
  no_access:
    "Ключ настоящий, но не видит этот рекламный аккаунт. Проверьте номер аккаунта (шаг 5), что аккаунт назначен пользователю shur-stats (шаг 3) и что при создании ключа стояла галочка ads_read (шаг 4).",
  busy: "Meta просит подождать — слишком много запросов. Попробуйте ещё раз через 10–15 минут.",
  unreachable: "Meta сейчас не отвечает. Попробуйте ещё раз через несколько минут — ничего не сохранено.",
  down: "Ключ сейчас не принимается — ничего не сохранено. Попробуйте позже.",
};

/* pixel_not_in_account: the pixel id she typed is not one of the account's
   pixels (on 27.10 it was the app id from step 1). The redirect carries the
   account's pixels as `px=<id>:<name>` — what Meta answered, not what she
   typed; pixel ids and names are not secret. One pixel → it goes into the
   field. */

export interface PixelHint {
  id: string;
  name: string;
}

const MAX_HINTS = 5;

/** `&px=…&px=…` for the redirect URL, already encoded. */
export function pixelHintQuery(pixels: PixelHint[]): string {
  return pixels
    .slice(0, MAX_HINTS)
    .map((p) => `&px=${encodeURIComponent(`${p.id}:${p.name.slice(0, 80)}`)}`)
    .join("");
}

/** Back from the page's searchParams; anything that is not «digits:name» is dropped. */
export function readPixelHints(px: string | string[] | undefined): PixelHint[] {
  const values = px === undefined ? [] : Array.isArray(px) ? px : [px];
  const hints: PixelHint[] = [];
  for (const value of values.slice(0, MAX_HINTS)) {
    const m = /^(\d{5,25}):(.{0,80})$/.exec(value);
    if (m) hints.push({ id: m[1], name: m[2] });
  }
  return hints;
}

const NOT_A_PIXEL = "Это не номер пикселя, похоже на номер приложения (из шага 1).";

function pixelMessage(hints: PixelHint[]): string {
  const named = (p: PixelHint) => (p.name ? `«${p.name}» — ${p.id}` : p.id);
  if (hints.length === 1) {
    return `${NOT_A_PIXEL} Пиксель вашего аккаунта: ${named(hints[0])}. Мы подставили его в поле — вставьте ещё раз ключ и номер аккаунта и нажмите «Проверить и сохранить».`;
  }
  if (hints.length > 1) {
    return `${NOT_A_PIXEL} Пиксели вашего аккаунта: ${hints.map(named).join("; ")}. Нужен тот, что стоит на сайте shur-shur.com (шаг 5).`;
  }
  return `${NOT_A_PIXEL} У этого рекламного аккаунта Meta не нашла ни одного пикселя — проверьте номер аккаунта (шаг 5) или напишите Игорю.`;
}

/** The text under the form for a reason word; pixel hints only matter for pixel_not_in_account. */
export function metaMessage(word: string, hints: PixelHint[] = []): string | undefined {
  if (word === "pixel_not_in_account") return pixelMessage(hints);
  return Object.hasOwn(META_MESSAGES, word) ? META_MESSAGES[word] : undefined;
}

/** The one pixel to put in the field, if the account has exactly one. */
export function pixelToFill(word: string | undefined, hints: PixelHint[]): string | undefined {
  return word === "pixel_not_in_account" && hints.length === 1 ? hints[0].id : undefined;
}
