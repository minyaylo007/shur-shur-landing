/**
 * Privacy and cookie policy (GDPR art. 13, Romanian law 506/2004 on cookies,
 * Israel's Privacy Protection Law 5741-1981 after amendment 13).
 *
 * PLACEHOLDERS. The controller's legal details are not known to us on
 * 29.09.2026. They are written as `[ЗАПОЛНИТЬ: …]` — loud, in Russian, the
 * same in all four locales, so nobody mistakes them for text. While ANY
 * placeholder is left in a locale, that locale's page is `noindex` and not in
 * the sitemap (`privacyComplete`), and tests/privacy fails if that coupling
 * is ever broken. The page is still reachable from the form notice: a
 * visitor must be able to read what we do with the data even while the
 * company name is a gap.
 */
export const FILL_MARK = "[ЗАПОЛНИТЬ:";

export const fill = (what: string): string => `${FILL_MARK} ${what}]`;

/** Every gap in one place — the four locales use these same values. */
export const gaps = {
  controller: fill("полное юридическое имя контролёра (ФЛП/ТОВ), страна"),
  registration: fill("регистрационный код (ЄДРПОУ/РНОКПП)"),
  address: fill("юридический адрес"),
  email: fill("e-mail для запросов о персональных данных"),
  euRepresentative: fill("представитель в ЕС по ст. 27 GDPR (имя, адрес) — или решение юриста, что не нужен"),
  transferBasis: fill("основание передачи данных в Украину (ст. 46 или 49 GDPR) — проверить у юриста"),
  leadRetention: fill("срок хранения заявок в Telegram и журнале заявок, напр. 24 месяца"),
} as const;

export interface PrivacySection {
  heading: string;
  paragraphs: readonly string[];
  items?: readonly string[];
}

export interface PrivacyCopy {
  meta: { title: string; description: string };
  heading: string;
  /** «Version of …» line. */
  updated: string;
  sections: readonly PrivacySection[];
  back: string;
}

/** True when a locale's policy carries no placeholder at all. */
export function isComplete(copy: PrivacyCopy): boolean {
  return !JSON.stringify(copy).includes(FILL_MARK);
}
